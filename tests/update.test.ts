import { describe, expect, it } from "vitest";

import { buildChanges, findDoc, hasChanges } from "../src/tools/update.js";

const docs = [
  { collection: "tasks", doc_id: "E01", data: { code: "E01", status: "Chưa làm", owner: "Phước" } },
  { collection: "tasks", doc_id: "E02", data: { code: "E02", status: "Đang làm", owner: "Chiến" } },
];

describe("findDoc", () => {
  it("tìm theo code", () => {
    expect(findDoc(docs, "e01")?.doc_id).toBe("E01");
  });

  it("tìm theo collection/doc_id", () => {
    expect(findDoc(docs, "tasks/E02")?.doc_id).toBe("E02");
  });

  it("không thấy thì undefined", () => {
    expect(findDoc(docs, "ZZZ")).toBeUndefined();
  });
});

describe("buildChanges", () => {
  it("chỉ gửi field được truyền", () => {
    expect(buildChanges({ status: "Đang làm" })).toEqual({ status: "Đang làm" });
    expect(buildChanges({ note: "" })).toEqual({ note: "" });
  });

  it("bỏ status rỗng", () => {
    expect(hasChanges(buildChanges({ status: "   " }))).toBe(false);
    expect(hasChanges(buildChanges({ status: "Đang làm" }))).toBe(true);
  });
});
