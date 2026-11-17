import { describe, expect, it, vi } from "vitest";

import { VworkClient } from "../src/client.js";

function fakeAuth(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    accessToken: vi.fn(async () => "token-1"),
    refresh: vi.fn(async () => "token-2"),
    invalidate: vi.fn(),
    ...overrides,
  };
}

const config = {
  baseUrl: "https://vwork.test",
  timeoutMs: 5_000,
  cacheTtlMs: 30_000,
  allowWrite: false,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("VworkClient", () => {
  it("gọi GET, trả body và cache lại", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: { ok: true } }));
    const client = new VworkClient(config, fakeAuth() as never, fetchImpl as never);

    const first = await client.get("/tickets");
    const second = await client.get("/tickets");

    expect(first).toEqual({ data: { ok: true } });
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gắn query string", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: [] }));
    const client = new VworkClient(config, fakeAuth() as never, fetchImpl as never);

    await client.get("/tickets", { status: "open", page: 2, empty: undefined });

    const url = String((fetchImpl.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("status=open");
    expect(url).toContain("page=2");
    expect(url).not.toContain("empty=");
  });

  it("tự refresh khi 401 rồi thử lại", async () => {
    const auth = fakeAuth();
    const responses = [jsonResponse({ message: "expired" }, 401), jsonResponse({ data: 1 })];
    const fetchImpl = vi.fn(async () => responses.shift()!);
    const client = new VworkClient(config, auth as never, fetchImpl as never);

    const result = await client.get("/tickets");

    expect(result).toEqual({ data: 1 });
    expect(auth.refresh).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("chặn ghi khi chỉ đọc", async () => {
    const fetchImpl = vi.fn();
    const client = new VworkClient(config, fakeAuth() as never, fetchImpl as never);

    await expect(client.request("PATCH", "/tickets/1", { body: {} })).rejects.toThrow(/chỉ đọc/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("chặn path tuyệt đối lạ", async () => {
    const client = new VworkClient(config, fakeAuth() as never, vi.fn() as never);

    await expect(client.get("https://evil.test/x")).rejects.toThrow(/không hợp lệ/);
  });

  it("ném VworkError kèm message của API", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: "không có quyền" }, 403));
    const client = new VworkClient(config, fakeAuth() as never, fetchImpl as never);

    await expect(client.get("/tickets")).rejects.toThrow(/không có quyền/);
  });
});

describe("cache và lỗi body", () => {
  it("xoá cache sau lệnh ghi", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      jsonResponse({ data: { n: fetchImpl.mock.calls.length } }),
    );
    const client = new VworkClient({ ...config, allowWrite: true }, fakeAuth() as never, fetchImpl as never);

    await client.get("/tickets");
    await client.request("PATCH", "/tickets/1", { body: { data: { status: "x" } } });
    await client.get("/tickets");

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("HTTP 200 với body không phải JSON thì báo lỗi", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>oops</html>", { status: 200 }));
    const client = new VworkClient(config, fakeAuth() as never, fetchImpl as never);

    await expect(client.get("/tickets")).rejects.toThrow(/không phải JSON/);
  });
});

describe("write lỗi nhưng cache", () => {
  it("cache bị xoá dù response ghi không parse được", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      n += 1;
      if (url.includes("/tickets") && n === 1) return jsonResponse({ data: { v: "old" } });
      if (url.includes("/tickets/1")) return new Response("<html>ok</html>", { status: 200 });
      return jsonResponse({ data: { v: "new" } });
    });
    const client = new VworkClient({ ...config, allowWrite: true }, fakeAuth() as never, fetchImpl as never);

    await client.get("/tickets");
    await expect(
      client.request("PATCH", "/tickets/1", { body: { data: { status: "x" } } }),
    ).rejects.toThrow();
    await client.get("/tickets");

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("giữ query nhúng trong path", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: [] }));
    const client = new VworkClient(config, fakeAuth() as never, fetchImpl as never);

    await client.get("/tickets?limit=1&status=open");

    const url = String((fetchImpl.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("limit=1");
    expect(url).toContain("status=open");
  });
});

describe("client chặn path traversal đã mã hoá", () => {
  it("không gửi request và không đổi sang /auth", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: 1 }));
    const client = new VworkClient({ ...config, allowWrite: true }, fakeAuth() as never, fetchImpl as never);

    await expect(
      client.request("POST", "/tickets/%252525252e%252525252e/auth/login", { body: {} }),
    ).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
