import { homedir } from "node:os";
import { join } from "node:path";

export interface Department {
  _id?: string;
  department_name?: string;
  department_code?: string;
}

export interface FolderEntry {
  _id?: string;
  name?: string;
  parent_id?: string | null;
  createdAt?: string;
}

export interface FileEntry {
  _id?: string;
  originalName?: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  folder_id?: string | null;
  createdAt?: string;
  updatedAt?: string;
  uploadedBy?: { full_name?: string; username?: string };
}

export function findDepartment(
  departments: Department[],
  reference: string,
): Department | undefined {
  const ref = reference.trim().toLowerCase();
  return departments.find(
    (dept) =>
      dept._id?.toLowerCase() === ref ||
      dept.department_code?.toLowerCase() === ref ||
      dept.department_name?.toLowerCase() === ref,
  ) ?? departments.find((dept) => dept.department_name?.toLowerCase().includes(ref));
}

export function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "?";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)}${units[unit]}`;
}

export function formatFile(file: FileEntry, now = new Date()): string {
  const name = file.originalName ?? file.filename ?? "(không tên)";
  const uploader = file.uploadedBy?.full_name ?? file.uploadedBy?.username ?? "?";
  const date = (file.updatedAt ?? file.createdAt ?? "").slice(0, 10);
  const age = file.updatedAt ?? file.createdAt;
  const days = age ? Math.floor((now.getTime() - new Date(age).getTime()) / 86_400_000) : null;
  const stale = days !== null && days > 180 ? " · CŨ >6 tháng" : "";
  return `[file] ${name} · ${formatSize(file.size)} · ${uploader} · ${date}${stale}\n        id=${file._id ?? "?"}`;
}

export function formatFolder(folder: FolderEntry): string {
  return `[folder] ${folder.name ?? "(không tên)"}\n        id=${folder._id ?? "?"}${
    folder.parent_id ? ` · parent=${folder.parent_id}` : ""
  }`;
}

export function filterByQuery<T extends { name?: string; originalName?: string; filename?: string }>(
  items: T[],
  query?: string,
): T[] {
  const needle = query?.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) =>
    (item.originalName ?? item.name ?? item.filename ?? "").toLowerCase().includes(needle),
  );
}

export function sanitizeFileName(name: string): string {
  // Chỉ lấy phần tên cuối, bỏ qua đường dẫn và "..".
  const base = (name ?? "")
    .split(/[\\/]+/)
    .filter((part) => part && part !== "." && part !== "..")
    .pop();
  const cleaned = (base ?? "").replace(/[:*?"<>|]/g, "_").trim();
  return cleaned || "download";
}

export function filenameFromDisposition(header: string | null): string | undefined {
  if (!header) return undefined;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* bỏ qua */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1];
}

export function defaultDownloadDir(): string {
  return join(homedir(), "Downloads", "vwork");
}

export function buildFolderTree(folders: FolderEntry[]): string {
  const byParent = new Map<string | null, FolderEntry[]>();
  for (const folder of folders) {
    const key = folder.parent_id ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), folder]);
  }
  const lines: string[] = [];
  const walk = (parent: string | null, depth: number): void => {
    for (const folder of byParent.get(parent) ?? []) {
      lines.push(`${"  ".repeat(depth)}- ${folder.name ?? "(không tên)"} (id=${folder._id ?? "?"})`);
      walk(folder._id ?? null, depth + 1);
    }
  };
  walk(null, 0);
  return lines.length ? lines.join("\n") : "(không có thư mục)";
}
