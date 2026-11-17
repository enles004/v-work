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
