import { describe, expect, it } from "vitest";

import {
  buildFolderTree,
  filenameFromDisposition,
  filterByQuery,
  findDepartment,
  formatFile,
  formatSize,
  sanitizeFileName,
} from "../src/tools/files.js";

const departments = [
  { _id: "d1", department_name: "Khối Công Nghệ", department_code: "K-CN" },
  { _id: "d2", department_name: "Khối Kinh Doanh", department_code: "K-KD" },
];

describe("findDepartment", () => {
  it("tìm theo id, mã, tên và tên một phần", () => {
    expect(findDepartment(departments, "d1")?._id).toBe("d1");
    expect(findDepartment(departments, "k-cn")?._id).toBe("d1");
    expect(findDepartment(departments, "Khối Kinh Doanh")?._id).toBe("d2");
    expect(findDepartment(departments, "công nghệ")?._id).toBe("d1");
  });

  it("không thấy trả undefined", () => {
    expect(findDepartment(departments, "abc")).toBeUndefined();
  });
});

describe("format", () => {
  it("size dễ đọc", () => {
    expect(formatSize(717908)).toBe("701KB");
    expect(formatSize(0)).toBe("?");
  });

  it("file có cảnh báo cũ", () => {
    const line = formatFile(
      {
        _id: "f1",
        originalName: "Bao cao.docx",
        size: 1024,
        updatedAt: "2025-01-01T00:00:00Z",
        uploadedBy: { full_name: "Đạt" },
      },
      new Date("2026-11-18T00:00:00Z"),
    );
    expect(line).toContain("Bao cao.docx");
    expect(line).toContain("CŨ >6 tháng");
    expect(line).toContain("id=f1");
  });

  it("lọc theo tên", () => {
    const items = [{ originalName: "Bao cao tuan.docx" }, { originalName: "Khac.pdf" }];
    expect(filterByQuery(items, "báo")).toHaveLength(0);
    expect(filterByQuery(items, "bao cao")).toHaveLength(1);
  });

  it("sanitize tên file", () => {
    expect(sanitizeFileName("../a/b:c.docx")).toBe("b_c.docx");
    expect(sanitizeFileName("..")).toBe("download");
  });

  it("đọc filename UTF-8 từ header", () => {
    expect(
      filenameFromDisposition("inline; filename*=UTF-8''Bao%20cao.docx"),
    ).toBe("Bao cao.docx");
    expect(filenameFromDisposition('attachment; filename="a.pdf"')).toBe("a.pdf");
  });

  it("dựng cây thư mục", () => {
    const tree = buildFolderTree([
      { _id: "f1", name: "BA", parent_id: null },
      { _id: "f2", name: "Con", parent_id: "f1" },
    ]);
    expect(tree).toContain("- BA");
    expect(tree).toContain("  - Con");
  });
});
