import { AuthSession } from "../auth.js";
import { VworkClient } from "../client.js";
import { loadConfig, type Config } from "../config.js";
import { unwrap } from "../format.js";
import { extractIdentity, filterMyTasks } from "../tools/mine.js";
import {
  docStatus,
  extractDocs,
  formatDoc,
  isDoneStatus,
  isOverdue,
  summarizeDocs,
} from "../tools/tracker.js";
import { flagBool, flagNumber, flagString, parseFlags } from "./flags.js";

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function parseQuery(value: string | undefined): Record<string, string> {
  if (!value) return {};
  if (value.trim().startsWith("{")) {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]));
  }
  return Object.fromEntries(
    value
      .split(",")
      .map((pair) => pair.split("="))
      .filter((parts) => parts.length === 2)
      .map(([k, v]) => [k!.trim(), v!.trim()]),
  );
}

async function resolveClient(): Promise<{ client: VworkClient; config: Config }> {
  const config = loadConfig();
  return { client: new VworkClient(config, new AuthSession(config)), config };
}

export async function runCli(argv: string[]): Promise<void> {
  const args = parseFlags(argv);
  const wantJson = flagBool(args.flags, "json");
  const { client, config } = await resolveClient();

  switch (args.command) {
    case "me": {
      const [profile, permissions] = await Promise.all([
        client.get("/user/getUserInfo"),
        client.get("/permissions/me"),
      ]);
      if (wantJson) {
        process.stdout.write(`${json({ profile: unwrap(profile), permissions: unwrap(permissions) })}\n`);
        return;
      }
      const identity = extractIdentity(profile);
      const perms = unwrap<{ permissions?: string[] }>(permissions)?.permissions ?? [];
      console.log(`Tài khoản : ${identity.name ?? identity.username ?? "?"}`);
      console.log(`Username  : ${identity.username ?? "?"}`);
      console.log(`Email     : ${identity.email ?? "(trống)"}`);
      console.log(`Quyền     : ${perms.length}`);
      return;
    }

    case "tasks": {
      const docs = extractDocs(await client.get(`/project-tracker/${config.project}/docs`));
      const identity = extractIdentity(await client.get("/user/getUserInfo"));
      const limit = flagNumber(args.flags, "limit", 30);
      const status = flagString(args.flags, "status");
      const mine = flagBool(args.flags, "mine");
      const overdue = flagBool(args.flags, "overdue");
      const todoOnly = flagBool(args.flags, "todo");

      let selected = mine
        ? filterMyTasks(docs, identity, { status, includeDone: !todoOnly, limit: 5000 })
        : docs;
      if (status) {
        selected = selected.filter((doc) => docStatus(doc).toLowerCase().includes(status.toLowerCase()));
      }
      if (todoOnly) selected = selected.filter((doc) => !isDoneStatus(docStatus(doc)));
      if (overdue) selected = selected.filter((doc) => isOverdue(doc, new Date()));

      const shown = selected.slice(0, limit);
      if (wantJson) {
        process.stdout.write(`${json(shown)}\n`);
        return;
      }
      console.log(
        `${mine ? "Task của bạn" : "Task"}: ${selected.length} (hiện ${shown.length})` +
          (mine ? ` · ${identity.name ?? identity.username}` : ""),
      );
      for (const doc of shown) console.log(formatDoc(doc));
      return;
    }

    case "summary": {
      const docs = extractDocs(await client.get(`/project-tracker/${config.project}/docs`));
      const summary = summarizeDocs(docs);
      if (wantJson) {
        process.stdout.write(`${json(summary)}\n`);
        return;
      }
      console.log(`Tổng: ${summary.total} doc · quá hạn: ${summary.overdue} · sắp hạn: ${summary.dueSoon}`);
      console.log("\nTheo trạng thái:");
      for (const [key, value] of Object.entries(summary.byStatus)) console.log(`  ${key}: ${value}`);
      console.log("\nTheo người phụ trách:");
      for (const [key, value] of Object.entries(summary.byAssignee)) console.log(`  ${key}: ${value}`);
      return;
    }

    case "tickets": {
      const body = await client.get("/tickets", {
        status: flagString(args.flags, "status"),
        limit: flagNumber(args.flags, "limit", 20),
      });
      const data = unwrap<unknown>(body);
      const items = (Array.isArray(data) ? data : ((data as { items?: unknown[] })?.items ?? [])) as Array<
        Record<string, unknown>
      >;
      if (wantJson) {
        process.stdout.write(`${json(items)}\n`);
        return;
      }
      for (const item of items) {
        console.log(
          `${item.code ?? item.id} | ${item.title ?? ""} | ${item.status ?? ""}`.slice(0, 200),
        );
      }
      return;
    }

    case "ticket": {
      const id = args.positional[0];
      if (!id) throw new Error("dùng: v-work ticket <id>");
      const body = await client.get(`/tickets/${id}`);
      process.stdout.write(`${json(unwrap(body))}\n`);
      return;
    }

    case "notifications": {
      const body = await client.get("/notification", { limit: flagNumber(args.flags, "limit", 10) });
      const unread = unwrap<{ count?: number }>(await client.get("/notification/unread-count"));
      const items = unwrap<unknown>(body);
      if (wantJson) {
        process.stdout.write(`${json({ unread, notifications: items })}\n`);
        return;
      }
      console.log(`Chưa đọc: ${unread?.count ?? 0}`);
      for (const item of (Array.isArray(items) ? items : []) as Array<Record<string, unknown>>) {
        console.log(`- ${item.title ?? ""}: ${item.body ?? ""}`.slice(0, 200));
      }
      return;
    }

    case "api": {
      const [method, path] = args.positional;
      if (!method || !path) {
        throw new Error('dùng: v-work api <METHOD> <PATH> [--query "k=v,k2=v2"] [--body JSON]');
      }
      const bodyRaw = flagString(args.flags, "body");
      const result = await client.request(method.toUpperCase(), path, {
        query: parseQuery(flagString(args.flags, "query")),
        body: bodyRaw ? JSON.parse(bodyRaw) : undefined,
      });
      process.stdout.write(`${json(wantJson ? result : unwrap(result))}\n`);
      return;
    }

    default:
      throw new Error(`lệnh CLI không hỗ trợ: ${args.command}`);
  }
}
