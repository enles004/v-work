import type { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";

import type { Config } from "../src/config.js";
import { registerTools } from "../src/tools/register.js";

interface Registered {
  name: string;
  description?: string;
  inputSchema?: unknown;
  handler: unknown;
}

function capture(): Registered[] {
  const calls: Registered[] = [];
  const fake = {
    registerTool: (name: string, config: Record<string, unknown>, handler: unknown) => {
      calls.push({
        name,
        description: config.description as string | undefined,
        inputSchema: config.inputSchema,
        handler,
      });
    },
  } as unknown as McpServer;
  const config = { project: "eoffice", allowWrite: false } as unknown as Config;
  registerTools(fake, { client: {} as never, config });
  return calls;
}

describe("đăng ký MCP tool", () => {
  const tools = capture();

  it("đủ 11 tool, tên duy nhất và có tiền tố vwork_", () => {
    expect(tools).toHaveLength(15);
    const names = tools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^vwork_[a-z_]+$/);
  });

  it("mỗi tool có description rõ ràng và inputSchema", () => {
    for (const tool of tools) {
      expect(tool.description, tool.name).toBeTruthy();
      expect((tool.description ?? "").length, tool.name).toBeGreaterThan(30);
      expect(tool.inputSchema, tool.name).toBeDefined();
      expect(typeof tool.handler, tool.name).toBe("function");
    }
  });

  it("có đủ bộ tool cốt lõi", () => {
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "vwork_me",
        "vwork_my_tasks",
        "vwork_tracker_search",
        "vwork_tracker_summary",
        "vwork_tickets",
        "vwork_update_task",
        "vwork_notifications",
        "vwork_api",
        "vwork_file_departments",
        "vwork_dept_files",
        "vwork_dept_tree",
        "vwork_file_download",
      ]),
    );
  });
});
