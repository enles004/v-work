import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { runCli } from "../src/cli/commands.js";

async function tokenFile(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vwork-cli-"));
  const file = join(dir, "tokens.json");
  await writeFile(file, JSON.stringify({ accessToken: "a1", refreshToken: "r1" }));
  return file;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.VWORK_TOKEN_FILE;
  delete process.env.VWORK_ALLOW_WRITE;
});

describe("v-work api", () => {
  it("chặn path ngoài allowlist trước khi gọi mạng", async () => {
    process.env.VWORK_TOKEN_FILE = await tokenFile();
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);

    await expect(runCli(["api", "GET", "/admin/secret"])).rejects.toThrow(/cho phép/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("chặn ghi khi chưa bật allow-write", async () => {
    process.env.VWORK_TOKEN_FILE = await tokenFile();
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);

    await expect(runCli(["api", "PATCH", "/tickets/1"])).rejects.toThrow(/chỉ đọc/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
