import { describe, expect, it } from "vitest";

import { assertAllowedPath, PathNotAllowedError } from "../src/tools/api.js";

describe("assertAllowedPath", () => {
  it("cho phép GET trong nhóm API đã khai báo", () => {
    expect(() => assertAllowedPath("/tickets", false, "GET")).not.toThrow();
    expect(() => assertAllowedPath("/project-tracker/eoffice/docs", false, "GET")).not.toThrow();
    expect(() => assertAllowedPath("/notification", false, "GET")).not.toThrow();
  });

  it("chặn path lạ, path auth, path có dấu ..", () => {
    expect(() => assertAllowedPath("/admin/secret", false, "GET")).toThrow(PathNotAllowedError);
    expect(() => assertAllowedPath("/auth/login", false, "GET")).toThrow(PathNotAllowedError);
    expect(() => assertAllowedPath("/tickets/../auth/login", false, "GET")).toThrow(
      PathNotAllowedError,
    );
  });

  it("chặn ghi khi chế độ chỉ đọc", () => {
    expect(() => assertAllowedPath("/tickets/1", false, "PATCH")).toThrow(/chỉ đọc/);
  });

  it("chỉ mở ghi cho nhóm an toàn", () => {
    expect(() => assertAllowedPath("/tickets/1", true, "PATCH")).not.toThrow();
    expect(() => assertAllowedPath("/permissions/roles/1", true, "PATCH")).toThrow(
      /chưa mở ghi/,
    );
  });
});

describe("normalizePath chống bypass", () => {
  it("chặn dot-segment đã mã hoá", () => {
    expect(() => assertAllowedPath("/tickets/%2e%2e/auth/login", true, "POST")).toThrow(/auth|\.\./);
    expect(() => assertAllowedPath("/tickets/%2e%2e/permissions/roles", false, "GET")).toThrow(
      /\.\.|cho phép/,
    );
  });

  it("giữ path bình thường", () => {
    expect(() => assertAllowedPath("/tickets/1", true, "PATCH")).not.toThrow();
  });
});

describe("double-encode", () => {
  it("chặn %252e%252e", () => {
    expect(() => assertAllowedPath("/tickets/%252e%252e/auth/login", true, "POST")).toThrow();
  });
});
