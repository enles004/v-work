import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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

describe("xoay token giữa nhiều process", () => {
  it("session thứ hai đọc token mới từ disk trước khi refresh", async () => {
    const config = await tempConfig();
    let valid = "r1";
    const backend = vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (url.endsWith("/auth/login")) return loginResponse("a1", "r1");
      if (body.refreshToken !== valid) {
        return new Response(JSON.stringify({ message: "stale" }), { status: 401 });
      }
      const nextNumber = Number(String(valid).slice(1)) + 1;
      valid = `r${nextNumber}`;
      return loginResponse(`a${nextNumber}`, valid);
    });

    const first = new AuthSession(config, backend as never);
    await first.accessToken();
    const second = new AuthSession(config, backend as never);
    await second.loadTokens();

    await first.refresh(); // disk: r2
    await expect(second.refresh()).resolves.toBe("a3");
    expect(valid).toBe("r3");
  });
});

describe("lỗi ghi token", () => {
  it("login báo lỗi thay vì giả vờ thành công", async () => {
    const base = await tempConfig();
    const blocker = `${base.tokenFile}.blocker`;
    await writeFile(blocker, "x"); // file đứng chỗ thư mục -> không thể tạo token file
    const config = { ...base, tokenFile: `${blocker}/tokens.json` };
    const auth = new AuthSession(config, vi.fn(async () => loginResponse()) as never);

    await expect(auth.login()).rejects.toThrow(/không ghi được token file/);
  });
});
