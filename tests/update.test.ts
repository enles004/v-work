import { describe, expect, it } from "vitest";

import { findDoc, hasChanges, mergeTaskData } from "../src/tools/update.js";

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

describe("mergeTaskData", () => {
  it("chỉ ghi đè field được truyền", () => {
    const merged = mergeTaskData(
      { status: "Chưa làm", owner: "Phước", note: "cũ" },
      { status: "Đang làm", note: undefined },
    );
    expect(merged).toEqual({ status: "Đang làm", owner: "Phước", note: "cũ" });
  });

  it("hasChanges phát hiện rỗng", () => {
    expect(hasChanges({})).toBe(false);
    expect(hasChanges({ status: "" })).toBe(false);
    expect(hasChanges({ status: "Đang làm" })).toBe(true);
  });
});
