import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { AuthSession } from "./auth.js";
import { VworkClient } from "./client.js";
import { loadConfig } from "./config.js";
import { registerTools } from "./tools/register.js";
export async function startServer() {
    const config = loadConfig();
    const auth = new AuthSession(config);
    const client = new VworkClient(config, auth);
    const server = new McpServer({ name: "vwork-mcp", version: "0.1.0" });
    registerTools(server, { client, config });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // stdio: mọi log phải ra stderr, stdout dành riêng cho JSON-RPC.
    console.error(`[vwork-mcp] sẵn sàng · base=${config.baseUrl} · project=${config.project} · write=${config.allowWrite}`);
}
if (process.argv[1]?.endsWith("server.js") || process.argv[1]?.endsWith("server.ts")) {
    startServer().catch((error) => {
        console.error(`[vwork-mcp] lỗi khởi động: ${error.message}`);
        process.exit(1);
    });
}
