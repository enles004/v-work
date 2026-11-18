import { homedir } from "node:os";
import { join } from "node:path";
export function findDepartment(departments, reference) {
    const ref = reference.trim().toLowerCase();
    return departments.find((dept) => dept._id?.toLowerCase() === ref ||
        dept.department_code?.toLowerCase() === ref ||
        dept.department_name?.toLowerCase() === ref) ?? departments.find((dept) => dept.department_name?.toLowerCase().includes(ref));
}
export function formatSize(bytes) {
    if (!bytes || bytes <= 0)
        return "?";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)}${units[unit]}`;
}
export function formatFile(file, now = new Date()) {
    const name = file.originalName ?? file.filename ?? "(không tên)";
    const uploader = file.uploadedBy?.full_name ?? file.uploadedBy?.username ?? "?";
    const date = (file.updatedAt ?? file.createdAt ?? "").slice(0, 10);
    const age = file.updatedAt ?? file.createdAt;
    const days = age ? Math.floor((now.getTime() - new Date(age).getTime()) / 86_400_000) : null;
    const stale = days !== null && days > 180 ? " · CŨ >6 tháng" : "";
    return `[file] ${name} · ${formatSize(file.size)} · ${uploader} · ${date}${stale}\n        id=${file._id ?? "?"}`;
}
export function formatFolder(folder) {
    return `[folder] ${folder.name ?? "(không tên)"}\n        id=${folder._id ?? "?"}${folder.parent_id ? ` · parent=${folder.parent_id}` : ""}`;
}
export function filterByQuery(items, query) {
    const needle = query?.trim().toLowerCase();
    if (!needle)
        return items;
    return items.filter((item) => (item.originalName ?? item.name ?? item.filename ?? "").toLowerCase().includes(needle));
}
export function sanitizeFileName(name) {
    // Chỉ lấy phần tên cuối, bỏ qua đường dẫn và "..".
    const base = (name ?? "")
        .split(/[\\/]+/)
        .filter((part) => part && part !== "." && part !== "..")
        .pop();
    const cleaned = (base ?? "").replace(/[:*?"<>|]/g, "_").trim();
    return cleaned || "download";
}
export function filenameFromDisposition(header) {
    if (!header)
        return undefined;
    const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (utf8?.[1]) {
        try {
            return decodeURIComponent(utf8[1]);
        }
        catch {
            /* bỏ qua */
        }
    }
    const plain = /filename="?([^";]+)"?/i.exec(header);
    return plain?.[1];
}
export function defaultDownloadDir() {
    return join(homedir(), "Downloads", "vwork");
}
export function buildFolderTree(folders) {
    const byParent = new Map();
    for (const folder of folders) {
        const key = folder.parent_id ?? null;
        byParent.set(key, [...(byParent.get(key) ?? []), folder]);
    }
    const lines = [];
    const walk = (parent, depth) => {
        for (const folder of byParent.get(parent) ?? []) {
            lines.push(`${"  ".repeat(depth)}- ${folder.name ?? "(không tên)"} (id=${folder._id ?? "?"})`);
            walk(folder._id ?? null, depth + 1);
        }
    };
    walk(null, 0);
    return lines.length ? lines.join("\n") : "(không có thư mục)";
}
