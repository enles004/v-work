import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { AuthSession } from "../src/auth.js";

async function tempConfig() {
  const dir = await mkdtemp(join(tmpdir(), "vwork-mcp-test-"));
  return {
    baseUrl: "https://vwork.test",
    username: "u",
    password: "p",
    timeoutMs: 5_000,
    tokenFile: join(dir, "tokens.json"),
  };
}

function loginResponse(access = "a1", refresh = "r1"): Response {
  return new Response(JSON.stringify({ data: { accessToken: access, refreshToken: refresh } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("AuthSession", () => {
  it("đăng nhập và lưu token xuống file", async () => {
    const config = await tempConfig();
    const fetchImpl = vi.fn(async () => loginResponse());
    const auth = new AuthSession(config, fetchImpl as never);

    const token = await auth.accessToken();

    expect(token).toBe("a1");
    const saved = JSON.parse(await readFile(config.tokenFile, "utf8"));
    expect(saved).toEqual({ accessToken: "a1", refreshToken: "r1" });
  });

  it("refresh dùng chung một request khi gọi song song", async () => {
    const config = await tempConfig();
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return calls === 1 ? loginResponse() : loginResponse("a2", "r2");
    });
    const auth = new AuthSession(config, fetchImpl as never);
    await auth.accessToken();

    const [first, second] = await Promise.all([auth.refresh(), auth.refresh()]);

    expect(first).toBe("a2");
    expect(second).toBe("a2");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("ném lỗi khi sai tài khoản", async () => {
    const config = await tempConfig();
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "Sai tài khoản" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
    );
    const auth = new AuthSession(config, fetchImpl as never);

    await expect(auth.login()).rejects.toThrow(/đăng nhập thất bại/);
  });
});


describe("AuthSession chưa đăng nhập", () => {
  it("báo lỗi hướng dẫn chạy login", async () => {
    const config = await tempConfig();
    const auth = new AuthSession({ ...config, username: undefined, password: undefined }, vi.fn() as never);

    await expect(auth.accessToken()).rejects.toThrow(/vwork-mcp login/);
  });
});
