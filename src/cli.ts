#!/usr/bin/env node
import { rm } from "node:fs/promises";
import { createInterface } from "node:readline/promises";

import { AuthSession } from "./auth.js";
import { VworkClient } from "./client.js";
import { loadConfig } from "./config.js";
import { extractIdentity } from "./tools/mine.js";
import { startServer } from "./server.js";

const USAGE = `vwork-mcp — MCP server cho VNFITE Work

Cách dùng:
  vwork-mcp                    chạy MCP server qua stdio (mặc định)
  vwork-mcp login              đăng nhập và lưu token vào ~/.config/vwork-mcp/tokens.json
  vwork-mcp status             xem trạng thái token (không gọi mạng)
  vwork-mcp logout             xoá token đã lưu
  vwork-mcp whoami             đăng nhập nếu cần rồi in tài khoản hiện tại
  vwork-mcp --help             hiện trợ giúp
`;

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
  if (!token) {
    console.log(`Chưa đăng nhập. Chạy: vwork-mcp login`);
    console.log(`Token file: ${config.tokenFile}`);
    return;
  }
  console.log(`✅ Có token tại ${config.tokenFile}`);
}

async function commandLogout(): Promise<void> {
  const config = loadConfig();
  await rm(config.tokenFile, { force: true });
  console.log(`Đã xoá token: ${config.tokenFile}`);
}

async function commandWhoami(): Promise<void> {
  const config = loadConfig();
  const client = new VworkClient(config, new AuthSession(config));
  const me = await client.get("/permissions/me");
  console.log(extractIdentity(me));
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "serve";
  switch (command) {
    case "serve":
      await startServer();
      return;
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
    case "--help":
    case "-h":
    case "help":
      process.stdout.write(USAGE);
      return;
    default:
      process.stderr.write(`Lệnh không hợp lệ: ${command}\n\n${USAGE}`);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(`❌ ${(error as Error).message}`);
  process.exit(1);
});
