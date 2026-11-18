import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";

import type { Config } from "../src/config.js";
import { registerTools } from "../src/tools/register.js";

type Handler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

function setup() {
  const handlers = new Map<string, Handler>();
  const client = {
    clearCache: vi.fn(),
    get: vi.fn(async (path: string) => {
      if (path.endsWith("/departments")) {
        return { data: [{ _id: "d1", department_name: "Khối Công Nghệ", department_code: "K-CN" }] };
      }
      if (path.endsWith("/folders/all")) {
        return { data: [{ _id: "f1", name: "BA", parent_id: null }] };
      }
      if (path.endsWith("/folders")) {
        return { data: [{ _id: "f1", name: "BA", parent_id: null }] };
      }
      if (path.endsWith("/files")) {
        return {
          data: [
            {
              _id: "file1",
              originalName: "Bao cao tuan.docx",
              size: 2048,
              updatedAt: "2026-11-13T00:00:00Z",
              uploadedBy: { full_name: "Đạt" },
            },
          ],
        };
      }
      return { data: [] };
    }),
    request: vi.fn(),
    download: vi.fn(async () => ({
      bytes: Buffer.from("hello"),
      contentType: "text/plain",
      filename: "inline; filename*=UTF-8''Bao%20cao.txt",
    })),
  };
  const server = {
    registerTool: (name: string, _config: unknown, handler: Handler) => handlers.set(name, handler),
  } as unknown as McpServer;
  const config = { project: "eoffice", allowWrite: false } as unknown as Config;
  registerTools(server, { client: client as never, config });
  return { handlers, client };
}

describe("tool ổ file nội bộ", () => {
  it("liệt kê phòng ban", async () => {
    const { handlers } = setup();
    const result = await handlers.get("vwork_file_departments")!({});
    expect(result.content[0]!.text).toContain("Khối Công Nghệ");
  });

  it("liệt kê thư mục + file của phòng ban", async () => {
    const { handlers } = setup();
    const result = await handlers.get("vwork_dept_files")!({ department: "K-CN" });
    const text = result.content[0]!.text;
    expect(text).toContain("[folder] BA");
    expect(text).toContain("Bao cao tuan.docx");
  });

  it("báo lỗi khi phòng ban không tồn tại", async () => {
    const { handlers } = setup();
    const result = await handlers.get("vwork_dept_files")!({ department: "xyz" });
    expect(result.isError).toBe(true);
  });

  it("in cây thư mục", async () => {
    const { handlers } = setup();
    const result = await handlers.get("vwork_dept_tree")!({ department: "K-CN" });
    expect(result.content[0]!.text).toContain("- BA");
  });

  it("tải file và lưu đúng tên", async () => {
    const { handlers } = setup();
    const dir = await mkdtemp(join(tmpdir(), "vwork-dl-"));
    const result = await handlers.get("vwork_file_download")!({ fileId: "file1", saveDir: dir });
    expect(result.isError).toBeUndefined();
    expect(await readFile(join(dir, "Bao cao.txt"), "utf8")).toBe("hello");
  });
});
