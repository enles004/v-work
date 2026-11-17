import { describe, expect, it } from "vitest";

import {
  extractDocs,
  searchDocs,
  summarizeDocs,
  docStatus,
  docAssignee,
} from "../src/tools/tracker.js";

const now = new Date("2026-11-17T00:00:00Z");

const docs = [
  {
    collection: "tasks",
    doc_id: "t1",
    title: "Làm báo cáo tuần",
    status: "in_progress",
    assignee: { name: "Phước" },
    due_date: "2026-11-10T00:00:00Z",
  },
  {
    collection: "tasks",
    doc_id: "t2",
    title: "Review API vwork",
    status: "done",
    assignee: "An",
    due_date: "2026-11-01T00:00:00Z",
  },
  {
    collection: "milestones",
    doc_id: "m1",
    title: "Release v2",
    status: "todo",
    assignees: [{ fullName: "Phước" }, { fullName: "Bình" }],
    deadline: "2026-11-18T00:00:00Z",
  },
];

describe("extractDocs", () => {
  it("lấy docs từ envelope data.docs", () => {
    expect(extractDocs({ data: { docs } })).toHaveLength(3);
  });
});

describe("searchDocs", () => {
  it("lọc theo từ khoá", () => {
    expect(searchDocs(docs, { query: "báo cáo", now }).map((d) => d.doc_id)).toEqual(["t1"]);
  });

  it("lọc theo trạng thái", () => {
    expect(searchDocs(docs, { status: "done", now }).map((d) => d.doc_id)).toEqual(["t2"]);
  });

  it("lọc theo người phụ trách trong object và array", () => {
    expect(searchDocs(docs, { assignee: "phước", now })).toHaveLength(2);
  });

  it("chỉ task quá hạn và bỏ qua task done", () => {
    expect(searchDocs(docs, { overdueOnly: true, now }).map((d) => d.doc_id)).toEqual(["t1"]);
  });

  it("lọc theo collection", () => {
    expect(searchDocs(docs, { collection: "milestones", now }).map((d) => d.doc_id)).toEqual([
      "m1",
    ]);
  });

  it("tôn trọng limit", () => {
    expect(searchDocs(docs, { limit: 1, now })).toHaveLength(1);
  });
});

describe("summarizeDocs", () => {
  it("đếm theo collection, status, assignee, quá hạn", () => {
    const summary = summarizeDocs(docs, now);
    expect(summary.total).toBe(3);
    expect(summary.byCollection.tasks).toBe(2);
    expect(summary.byStatus.in_progress).toBe(1);
    expect(summary.byAssignee["Phước"]).toBe(2);
    expect(summary.overdue).toBe(1);
    expect(summary.dueSoon).toBe(1);
  });
});

describe("field helpers", () => {
  it("đọc status và assignee dạng object/array", () => {
    expect(docStatus(docs[0]!)).toBe("in_progress");
    expect(docAssignee(docs[2]!)).toBe("Phước, Bình");
  });
});

describe("schema thật của vwork", () => {
  const doc = {
    collection: "tasks",
    doc_id: "A01",
    data: {
      code: "A01",
      feature: "Đăng nhập bằng tài khoản VNFITE Work",
      status: "Chưa làm",
      owner: "Chiến",
      owners: ["Chiến"],
      due: "2026-11-26",
      prio: "P0",
      release: "R1",
      blocked: false,
    },
  };

  it("title lấy từ feature, code lấy từ data.code", async () => {
    const { docTitle, docCode, formatDoc } = await import("../src/tools/tracker.js");
    expect(docTitle(doc)).toContain("Đăng nhập");
    expect(docCode(doc)).toBe("A01");
    const line = formatDoc(doc, new Date("2026-11-17T00:00:00Z"));
    expect(line).toContain("P0");
    expect(line).toContain("R1");
    expect(line).toContain("2026-11-26");
  });
});

describe("owners và envelope", () => {
  it("đọc owners khi không có owner", async () => {
    const { docAssignee } = await import("../src/tools/tracker.js");
    expect(docAssignee({ data: { owners: ["Linh", "Phước"] } })).toBe("Linh, Phước");
  });

  it("ưu tiên data.code hơn doc_id ngoài envelope", async () => {
    const { docCode, formatDoc } = await import("../src/tools/tracker.js");
    const doc = { doc_id: "uuid-001", version: 2, data: { code: "A01", release: "R1", feature: "X" } };
    expect(docCode(doc)).toBe("A01");
    expect(formatDoc(doc)).toContain("R1");
  });
});
