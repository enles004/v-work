import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { Config } from "../config.js";
import { AuthError } from "../auth.js";
import { VworkClient, VworkError } from "../client.js";
import { unwrap } from "../format.js";
import { assertAllowedPath } from "./api.js";
import { extractIdentity, filterMyTasks } from "./mine.js";
import {
  docCollection,
  docStatus,
  docTitle,
  extractDocs,
  formatDoc,
  searchDocs,
  summarizeDocs,
} from "./tracker.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

const ok = (text: string): ToolResult => ({ content: [{ type: "text", text }] });
const fail = (text: string): ToolResult => ({ content: [{ type: "text", text }], isError: true });

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function guard(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof VworkError) {
      return fail(`VWork API lỗi${error.status ? ` (HTTP ${error.status})` : ""}: ${error.message}`);
    }
    if (error instanceof AuthError) return fail(`Lỗi đăng nhập VWork: ${error.message}`);
    if (error instanceof Error && error.name === "TimeoutError") {
      return fail("VWork API quá thời gian chờ. Thử lại sau.");
    }
    return fail(`Lỗi: ${(error as Error).message}`);
  }
}

const projectArg = z
  .string()
  .optional()
  .describe('Project id, mặc định lấy từ VWORK_PROJECT (trang tiến độ dùng "eoffice")');

export function registerTools(
  server: McpServer,
  deps: { client: VworkClient; config: Config },
): void {
  const { client, config } = deps;

  server.registerTool(
    "vwork_me",
    {
      description:
        "Xem tài khoản VWork đang đăng nhập và danh sách quyền của mình (permissions/me).",
      inputSchema: z.object({}),
    },
    async () => guard(async () => ok(json(unwrap(await client.get("/permissions/me"))))),
  );

  server.registerTool(
    "vwork_tracker_docs",
    {
      description:
        "Lấy danh sách doc trong bảng tiến độ dự án (project tracker). Trả về tối đa `limit` doc kèm tổng số.",
      inputSchema: z.object({
        project: projectArg,
        limit: z.number().int().min(1).max(500).default(50),
      }),
    },
    async ({ project, limit }) =>
      guard(async () => {
        const body = await client.get(`/project-tracker/${project ?? config.project}/docs`);
        const docs = extractDocs(body);
        const lines = docs.slice(0, limit).map((doc) => formatDoc(doc));
        return ok(
          `Tổng ${docs.length} doc (hiện ${lines.length}).\n\n${lines.join("\n")}`,
        );
      }),
  );

  server.registerTool(
    "vwork_tracker_search",
    {
      description:
        "Tìm task/doc trong bảng tiến độ theo từ khoá, trạng thái, người phụ trách, collection hoặc chỉ task quá hạn.",
      inputSchema: z.object({
        project: projectArg,
        query: z.string().optional().describe("từ khoá tìm trong mọi trường"),
        status: z.string().optional().describe("lọc theo trạng thái, khớp một phần"),
        assignee: z.string().optional().describe("lọc theo người phụ trách, khớp một phần"),
        collection: z.string().optional().describe("lọc theo collection/loại doc"),
        overdueOnly: z.boolean().default(false).describe("chỉ lấy task quá hạn"),
        limit: z.number().int().min(1).max(200).default(30),
      }),
    },
    async ({ project, limit, ...filters }) =>
      guard(async () => {
        const body = await client.get(`/project-tracker/${project ?? config.project}/docs`);
        const docs = searchDocs(extractDocs(body), { ...filters, limit });
        if (docs.length === 0) return ok("Không tìm thấy doc nào khớp điều kiện.");
        return ok(`${docs.length} kết quả:\n\n${docs.map((doc) => formatDoc(doc)).join("\n")}`);
      }),
  );

  server.registerTool(
    "vwork_tracker_summary",
    {
      description:
        "Tổng hợp bảng tiến độ: số lượng theo collection, trạng thái, người phụ trách; đếm task quá hạn và sắp đến hạn (3 ngày).",
      inputSchema: z.object({ project: projectArg }),
    },
    async ({ project }) =>
      guard(async () => {
        const body = await client.get(`/project-tracker/${project ?? config.project}/docs`);
        return ok(json(summarizeDocs(extractDocs(body))));
      }),
  );

  server.registerTool(
    "vwork_my_tasks",
    {
      description:
        "Task/doc được giao cho CHÍNH tài khoản đang đăng nhập. Tự lấy danh tính từ /permissions/me " +
        "rồi khớp theo tên/username/email/id. Dùng khi người dùng hỏi 'tôi đang có task gì'.",
      inputSchema: z.object({
        project: projectArg,
        status: z.string().optional().describe("lọc theo trạng thái, khớp một phần"),
        includeDone: z.boolean().default(true).describe("gồm cả task đã xong"),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    },
    async ({ project, status, includeDone, limit }) =>
      guard(async () => {
        const [meBody, docsBody] = await Promise.all([
          client.get("/permissions/me"),
          client.get(`/project-tracker/${project ?? config.project}/docs`),
        ]);
        const identity = extractIdentity(meBody);
        const docs = filterMyTasks(extractDocs(docsBody), identity, {
          status,
          includeDone,
          limit,
        });
        const who = identity.name ?? identity.username ?? identity.email ?? "tài khoản hiện tại";
        if (docs.length === 0) {
          return ok(`Tài khoản: ${who}\nKhông có task nào khớp điều kiện.`);
        }
        return ok(
          `Tài khoản: ${who}\n${docs.length} task:\n\n${docs.map((doc) => formatDoc(doc)).join("\n")}`,
        );
      }),
  );

  server.registerTool(
    "vwork_tickets",
    {
      description: "Liệt kê ticket hỗ trợ nội bộ, lọc theo trạng thái và từ khoá.",
      inputSchema: z.object({
        status: z.string().optional(),
        query: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    },
    async ({ status, query, page, limit }) =>
      guard(async () => {
        const body = await client.get("/tickets", { status, q: query, page, limit });
        const data = unwrap<Record<string, unknown>>(body);
        const items = (Array.isArray(data) ? data : (data?.items as unknown[])) ?? [];
        const lines = items.map((item) => {
          const doc = item as Record<string, unknown>;
          return `#${doc.id ?? doc.code ?? "?"} | ${doc.title ?? doc.subject ?? ""} | ${doc.status ?? ""}`;
        });
        return ok(lines.length ? lines.join("\n") : json(body));
      }),
  );

  server.registerTool(
    "vwork_ticket",
    {
      description: "Xem chi tiết một ticket theo id.",
      inputSchema: z.object({ id: z.union([z.string(), z.number()]) }),
    },
    async ({ id }) => guard(async () => ok(json(unwrap(await client.get(`/tickets/${id}`))))),
  );

  server.registerTool(
    "vwork_notifications",
    {
      description: "Xem thông báo chưa đọc và thông báo mới nhất của tài khoản.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(10) }),
    },
    async ({ limit }) =>
      guard(async () => {
        const unread = unwrap(await client.get("/notification/unread-count"));
        const body = await client.get("/notification", { limit });
        return ok(json({ unread, notifications: unwrap(body) }));
      }),
  );

  server.registerTool(
    "vwork_api",
    {
      description:
        "Gọi API VWork tuỳ ý (đã có sẵn auth). GET luôn được phép trong danh sách nhóm API; " +
        "PATCH/POST/PUT/DELETE chỉ khi VWORK_ALLOW_WRITE=true và thuộc nhóm an toàn.",
      inputSchema: z.object({
        method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]).default("GET"),
        path: z.string().describe("vd /tickets, /notification, /project-tracker/eoffice/docs"),
        query: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .optional(),
        body: z.unknown().optional(),
      }),
    },
    async ({ method, path, query, body }) =>
      guard(async () => {
        assertAllowedPath(path, config.allowWrite, method);
        const result = await client.request(method, path, {
          query,
          body: method === "GET" ? undefined : body,
        });
        return ok(json(unwrap(result)));
      }),
  );

  server.registerTool(
    "vwork_project_overview",
    {
      description:
        "Ảnh chụp nhanh: tài khoản hiện tại + tổng hợp tiến độ + ticket đang mở + thông báo chưa đọc.",
      inputSchema: z.object({ project: projectArg }),
    },
    async ({ project }) =>
      guard(async () => {
        const [me, tracker, tickets, unread] = await Promise.allSettled([
          client.get("/permissions/me"),
          client.get(`/project-tracker/${project ?? config.project}/docs`),
          client.get("/tickets", { limit: 5 }),
          client.get("/notification/unread-count"),
        ]);
        return ok(
          json({
            me: me.status === "fulfilled" ? unwrap(me.value) : "không lấy được",
            tracker:
              tracker.status === "fulfilled"
                ? summarizeDocs(extractDocs(tracker.value))
                : "không lấy được",
            tickets: tickets.status === "fulfilled" ? unwrap(tickets.value) : "không lấy được",
            unread: unread.status === "fulfilled" ? unwrap(unread.value) : "không lấy được",
          }),
        );
      }),
  );
}

export { docCollection, docStatus, docTitle };
