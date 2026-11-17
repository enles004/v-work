#!/usr/bin/env node
import { rm } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { AuthSession } from "./auth.js";
import { VworkClient } from "./client.js";
import { loadConfig } from "./config.js";
import { parseCommand } from "./cli-args.js";
import { runCli } from "./cli/commands.js";
import { HELP, VERSION } from "./help.js";
import { extractIdentity } from "./tools/mine.js";
import { startServer } from "./server.js";
async function promptHidden(question) {
    if (!process.stdin.isTTY) {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await rl.question(question);
        rl.close();
        return answer;
    }
    return new Promise((resolve) => {
        process.stdout.write(question);
        const stdin = process.stdin;
        stdin.resume();
        stdin.setRawMode?.(true);
        let value = "";
        const cleanup = () => {
            stdin.setRawMode?.(false);
            stdin.pause();
            stdin.off("data", onData);
        };
        const onData = (buffer) => {
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
async function commandLogin() {
    const config = loadConfig();
    let username = config.username;
    if (!username) {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        username = (await rl.question("VWORK username: ")).trim();
        rl.close();
    }
    if (!username)
        throw new Error("thiếu username");
    const password = config.password ?? (await promptHidden("VWORK password: "));
    if (!password)
        throw new Error("thiếu password");
    const session = new AuthSession({ ...config, username, password });
    await session.login();
    console.log(`✅ Đã đăng nhập ${username}. Token lưu tại ${config.tokenFile}`);
}
async function commandStatus() {
    const config = loadConfig();
    const session = new AuthSession(config);
    const token = await session.loadTokens();
    if (process.argv.includes("--json")) {
        process.stdout.write(`${JSON.stringify({ loggedIn: Boolean(token), tokenFile: config.tokenFile, baseUrl: config.baseUrl, project: config.project })}\n`);
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
async function commandLogout() {
    const config = loadConfig();
    await rm(config.tokenFile, { force: true });
    console.log(`Đã xoá token: ${config.tokenFile}`);
}
async function commandWhoami() {
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
async function main() {
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
    console.error(`❌ ${error.message}`);
    process.exit(1);
});
