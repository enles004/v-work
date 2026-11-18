#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

import { AuthSession } from "./auth.js";
import { VworkClient } from "./client.js";
import { loadConfig } from "./config.js";
import { parseCommand } from "./cli-args.js";
import { runCli } from "./cli/commands.js";
import { HELP, VERSION } from "./help.js";
import { extractIdentity } from "./tools/mine.js";
import { startServer } from "./server.js";


async function promptHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(question);
    rl.close();
    return answer;
  }

  return new Promise<string>((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.resume();
    stdin.setRawMode?.(true);
    let value = "";

    const cleanup = (): void => {
      stdin.setRawMode?.(false);
      stdin.pause();
      stdin.off("data", onData);
    };

    const onData = (buffer: Buffer): void => {
      for (const char of buffer.toString("utf8")) {
        if (char === "\r" || char === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          process.exit(130);
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    stdin.on("data", onData);
  });
}

async function commandLogin(): Promise<void> {
  const config = loadConfig();
  let username = config.username;
  if (!username) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    username = (await rl.question("VWORK username: ")).trim();
    rl.close();
  }
  if (!username) throw new Error("thiếu username");

  const password = config.password ?? (await promptHidden("VWORK password: "));
  if (!password) throw new Error("thiếu password");

  const session = new AuthSession({ ...config, username, password });
  await session.login();
  console.log(`✅ Đã đăng nhập ${username}. Token lưu tại ${config.tokenFile}`);
}

async function commandStatus(): Promise<void> {
  const config = loadConfig();
  const session = new AuthSession(config);
  const token = await session.loadTokens();
  if (process.argv.includes("--json")) {
    process.stdout.write(
      `${JSON.stringify({ loggedIn: Boolean(token), tokenFile: config.tokenFile, baseUrl: config.baseUrl, project: config.project })}\n`,
    );
    return;
  }
  if (!token) {
    console.log("Chưa đăng nhập. Chạy: npx -y v-work auth");
    console.log(`Token file: ${config.tokenFile}`);
    return;
  }
  console.log(`✅ Đã đăng nhập. Token: ${config.tokenFile}`);
  console.log(`Base: ${config.baseUrl} · project: ${config.project}`);
}

async function commandLogout(): Promise<void> {
  const config = loadConfig();
  await rm(config.tokenFile, { force: true });
  console.log(`Đã xoá token: ${config.tokenFile}`);
}

async function commandWhoami(): Promise<void> {
  const config = loadConfig();
  const client = new VworkClient(config, new AuthSession(config));
  const me = await client.get("/user/getUserInfo");
  const identity = extractIdentity(me);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(identity)}\n`);
    return;
  }
  console.log(identity);
}

const TARBALL =
  "https://github.com/enles004/v-work/archive/refs/heads/master.tar.gz";

function runStep(command: string, args: string[], cwd?: string): void {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} thất bại (exit ${result.status})`);
  }
}

async function commandUpgrade(asJson: boolean): Promise<void> {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const isRepo = existsSync(join(repoRoot, ".git"));
  if (isRepo) {
    console.log(`Cập nhật từ repo ${repoRoot} …`);
    runStep("git", ["pull", "--ff-only"], repoRoot);
    runStep("npm", ["install", "--silent"], repoRoot);
    runStep("npm", ["run", "build"], repoRoot);
  } else {
    console.log("Cập nhật bản cài global từ GitHub …");
    runStep("npm", ["i", "-g", TARBALL]);
  }
  if (asJson) {
    process.stdout.write(`${JSON.stringify({ updated: true, mode: isRepo ? "repo" : "global" })}\n`);
    return;
  }
  console.log("✅ Đã cập nhật. Reconnect MCP trong Claude (/mcp) là dùng bản mới.");
}

async function main(): Promise<void> {
  const command = parseCommand(process.argv.slice(2));

  switch (command.kind) {
    case "login":
      await commandLogin();
      return;
    case "status":
      await commandStatus();
      return;
    case "logout":
      await commandLogout();
      return;
    case "whoami":
      await commandWhoami();
      return;
    case "help":
      process.stdout.write(HELP);
      return;
    case "version":
      process.stdout.write(`v-work ${VERSION}\n`);
      return;
    case "cli":
      if (command.name === "upgrade") {
        await commandUpgrade(process.argv.includes("--json"));
        return;
      }
      await runCli(process.argv.slice(2));
      return;
    case "invalid":
      process.stderr.write(`Lệnh không hợp lệ: ${command.value}\n\n${HELP}`);
      process.exit(1);
      return;
    case "serve": {
      // Chạy tay trong terminal thì in trạng thái; MCP client spawn qua pipe thì chạy server.
      if (process.stdin.isTTY) {
        await commandStatus();
        process.stdout.write(`\n${HELP}`);
        return;
      }
      await startServer();
    }
  }
}

main().catch((error) => {
  console.error(`❌ ${(error as Error).message}`);
  process.exit(1);
});
