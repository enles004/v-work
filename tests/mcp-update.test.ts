import type { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";

import type { Config } from "../src/config.js";
import { registerTools } from "../src/tools/register.js";

type Handler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

function captureHandlers(allowWrite: boolean) {
  const handlers = new Map<string, Handler>();
  const client = {
    clearCache: vi.fn(),
    get: vi.fn(async () => ({
      data: {
        docs: [
          { collection: "tasks", doc_id: "E01", data: { code: "E01", status: "Chưa làm" } },
        ],
      },
    })),
    request: vi.fn(async () => ({
      data: {
        collection: "tasks",
        doc_id: "E01",
        data: { code: "E01", status: "Đang làm" },
      },
    })),
  };
  const server = {
    registerTool: (name: string, _config: unknown, handler: Handler) => {
      handlers.set(name, handler);
    },
  } as unknown as McpServer;
  const config = { project: "eoffice", allowWrite } as unknown as Config;
  registerTools(server, { client: client as never, config });
  return { handlers, client };
}

describe("vwork_update_task handler", () => {
  it("PATCH đúng body {data:{status}} và clear cache", async () => {
    const { handlers, client } = captureHandlers(true);

    const result = await handlers.get("vwork_update_task")!({ reference: "E01", status: "Đang làm" });

    expect(result.isError).toBeUndefined();
    expect(client.request).toHaveBeenCalledWith(
      "PATCH",
      "/project-tracker/eoffice/docs/tasks/E01",
      { body: { data: { status: "Đang làm" } } },
    );
    expect(client.clearCache).toHaveBeenCalledTimes(2);
  });

  it("chế độ chỉ đọc thì không gọi API", async () => {
    const { handlers, client } = captureHandlers(false);

    const result = await handlers.get("vwork_update_task")!({ reference: "E01", status: "Đang làm" });

    expect(result.isError).toBe(true);
    expect(client.request).not.toHaveBeenCalled();
  });

  it("không có field thay đổi thì báo lỗi", async () => {
    const { handlers, client } = captureHandlers(true);

    const result = await handlers.get("vwork_update_task")!({ reference: "E01" });

    expect(result.isError).toBe(true);
    expect(client.request).not.toHaveBeenCalled();
  });
});
