import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { AuthError } from "../auth.js";
import { VworkError } from "../client.js";
import { unwrap } from "../format.js";
import { assertAllowedPath } from "./api.js";
import { extractIdentity, filterMyTasks } from "./mine.js";
import { buildFolderTree, defaultDownloadDir, filenameFromDisposition, filterByQuery, findDepartment, formatFile, formatFolder, sanitizeFileName, } from "./files.js";
import { buildChanges, findDoc, hasChanges } from "./update.js";
import { docCollection, docStatus, docTitle, extractDocs, formatDoc, isOverdue, searchDocs, summarizeDocs, } from "./tracker.js";
const ok = (text) => ({ content: [{ type: "text", text }] });
const fail = (text) => ({ content: [{ type: "text", text }], isError: true });
function json(value) {
    return JSON.stringify(value, null, 2);
}
async function guard(fn) {
    try {
        return await fn();
    }
    catch (error) {
        if (error instanceof VworkError) {
            return fail(`VWork API lỗi${error.status ? ` (HTTP ${error.status})` : ""}: ${error.message}`);
        }
        if (error instanceof AuthError)
            return fail(`Lỗi đăng nhập VWork: ${error.message}`);
        if (error instanceof Error && error.name === "TimeoutError") {
            return fail("VWork API quá thời gian chờ. Thử lại sau.");
        }
        return fail(`Lỗi: ${error.message}`);
    }
}
const projectArg = z
    .string()
    .optional()
    .describe('Project id, mặc định lấy từ VWORK_PROJECT (trang tiến độ dùng "eoffice")');
export function registerTools(server, deps) {
    const { client, config } = deps;
    server.registerTool("vwork_me", {
        description: "Xem hồ sơ tài khoản VWork đang đăng nhập (họ tên, username, phòng ban) và danh sách quyền.",
        inputSchema: z.object({}),
    }, async () => guard(async () => {
        const [profile, permissions] = await Promise.all([
            client.get("/user/getUserInfo"),
            client.get("/permissions/me"),
        ]);
        return ok(json({ profile: unwrap(profile), permissions: unwrap(permissions) }));
    }));
    server.registerTool("vwork_tracker_docs", {
        description: "Lấy danh sách doc trong bảng tiến độ dự án (project tracker). Trả về tối đa `limit` doc kèm tổng số.",
        inputSchema: z.object({
            project: projectArg,
            limit: z.number().int().min(1).max(500).default(50),
        }),
    }, async ({ project, limit }) => guard(async () => {
        const body = await client.get(`/project-tracker/${project ?? config.project}/docs`);
        const docs = extractDocs(body);
        const lines = docs.slice(0, limit).map((doc) => formatDoc(doc));
        return ok(`Tổng ${docs.length} doc (hiện ${lines.length}).\n\n${lines.join("\n")}`);
    }));
    server.registerTool("vwork_tracker_search", {
        description: "Tìm task/doc trong bảng tiến độ theo từ khoá, trạng thái, người phụ trách, collection hoặc chỉ task quá hạn.",
        inputSchema: z.object({
            project: projectArg,
            query: z.string().optional().describe("từ khoá tìm trong mọi trường"),
            status: z.string().optional().describe("lọc theo trạng thái, khớp một phần"),
            assignee: z.string().optional().describe("lọc theo người phụ trách, khớp một phần"),
            collection: z.string().optional().describe("lọc theo collection/loại doc"),
            overdueOnly: z.boolean().default(false).describe("chỉ lấy task quá hạn"),
            limit: z.number().int().min(1).max(200).default(30),
        }),
    }, async ({ project, limit, ...filters }) => guard(async () => {
        const body = await client.get(`/project-tracker/${project ?? config.project}/docs`);
        const docs = searchDocs(extractDocs(body), { ...filters, limit });
        if (docs.length === 0)
            return ok("Không tìm thấy doc nào khớp điều kiện.");
        return ok(`${docs.length} kết quả:\n\n${docs.map((doc) => formatDoc(doc)).join("\n")}`);
    }));
    server.registerTool("vwork_tracker_summary", {
        description: "Tổng hợp bảng tiến độ: số lượng theo collection, trạng thái, người phụ trách; đếm task quá hạn và sắp đến hạn (3 ngày).",
        inputSchema: z.object({ project: projectArg }),
    }, async ({ project }) => guard(async () => {
        const body = await client.get(`/project-tracker/${project ?? config.project}/docs`);
        return ok(json(summarizeDocs(extractDocs(body))));
    }));
    server.registerTool("vwork_my_tasks", {
        description: "Task/doc được giao cho CHÍNH tài khoản đang đăng nhập. Tự lấy danh tính từ /user/getUserInfo " +
            "rồi khớp theo tên/username/email/id. Dùng khi người dùng hỏi 'tôi đang có task gì'.",
        inputSchema: z.object({
            project: projectArg,
            status: z.string().optional().describe("lọc theo trạng thái, khớp một phần"),
            includeDone: z.boolean().default(true).describe("gồm cả task đã xong"),
            overdueOnly: z.boolean().default(false).describe("chỉ task quá hạn"),
            limit: z.number().int().min(1).max(200).default(50),
        }),
    }, async ({ project, status, includeDone, overdueOnly, limit }) => guard(async () => {
        const [meBody, docsBody] = await Promise.all([
            client.get("/user/getUserInfo"),
            client.get(`/project-tracker/${project ?? config.project}/docs`),
        ]);
        const identity = extractIdentity(meBody);
        let docs = filterMyTasks(extractDocs(docsBody), identity, {
            status,
            includeDone,
            limit: 5000,
        });
        if (overdueOnly)
            docs = docs.filter((doc) => isOverdue(doc, new Date()));
        docs = docs.slice(0, limit);
        const who = identity.name ?? identity.username ?? identity.email ?? "tài khoản hiện tại";
        if (docs.length === 0) {
            return ok(`Tài khoản: ${who}\nKhông có task nào khớp điều kiện.`);
        }
        return ok(`Tài khoản: ${who}\n${docs.length} task:\n\n${docs.map((doc) => formatDoc(doc)).join("\n")}`);
    }));
    server.registerTool("vwork_update_task", {
        description: "Cập nhật một task/doc trong bảng tiến độ (theo code A01/E02 hoặc collection/doc_id). " +
            "Chỉ gửi field cần đổi. Yêu cầu VWORK_ALLOW_WRITE=true.",
        inputSchema: z.object({
            reference: z.string().describe("code (vd A01) hoặc collection/doc_id (vd tasks/E02)"),
            project: projectArg,
            status: z.string().optional().describe("trạng thái mới, vd Đang làm"),
            note: z.string().optional().describe("ghi chú"),
        }),
    }, async ({ reference, project, status, note }) => guard(async () => {
        if (!config.allowWrite) {
            return fail("Đang ở chế độ chỉ đọc. Đặt VWORK_ALLOW_WRITE=true để cập nhật.");
        }
        const changes = buildChanges({ status, note });
        if (!hasChanges(changes))
            return fail("không có field nào cần cập nhật");
        const docsPath = `/project-tracker/${project ?? config.project}/docs`;
        client.clearCache();
        const docs = extractDocs(await client.get(docsPath));
        const doc = findDoc(docs, reference);
        if (!doc)
            return fail(`không tìm thấy task ${reference}`);
        const saved = await client.request("PATCH", `/project-tracker/${project ?? config.project}/docs/${doc.collection}/${doc.doc_id}`, { body: { data: changes } });
        client.clearCache();
        return ok(`✅ Đã cập nhật ${doc.collection}/${doc.doc_id}\n${formatDoc(unwrap(saved) ?? doc)}`);
    }));
    server.registerTool("vwork_tickets", {
        description: "Liệt kê ticket hỗ trợ nội bộ, lọc theo trạng thái và từ khoá.",
        inputSchema: z.object({
            status: z.string().optional(),
            query: z.string().optional(),
            page: z.number().int().min(1).default(1),
            limit: z.number().int().min(1).max(100).default(20),
        }),
    }, async ({ status, query, page, limit }) => guard(async () => {
        const body = await client.get("/tickets", { status, q: query, page, limit });
        const data = unwrap(body);
        const items = (Array.isArray(data) ? data : data?.items) ?? [];
        const lines = items.map((item) => {
            const doc = item;
            return `#${doc.id ?? doc.code ?? "?"} | ${doc.title ?? doc.subject ?? ""} | ${doc.status ?? ""}`;
        });
        return ok(lines.length ? lines.join("\n") : json(body));
    }));
    server.registerTool("vwork_ticket", {
        description: "Xem chi tiết một ticket theo id.",
        inputSchema: z.object({ id: z.union([z.string(), z.number()]) }),
    }, async ({ id }) => guard(async () => ok(json(unwrap(await client.get(`/tickets/${id}`))))));
    server.registerTool("vwork_notifications", {
        description: "Xem thông báo chưa đọc và thông báo mới nhất của tài khoản.",
        inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(10) }),
    }, async ({ limit }) => guard(async () => {
        const unread = unwrap(await client.get("/notification/unread-count"));
        const body = await client.get("/notification", { limit });
        return ok(json({ unread, notifications: unwrap(body) }));
    }));
    server.registerTool("vwork_file_departments", {
        description: "Liệt kê các phòng ban có ổ file nội bộ mà bạn được xem (Ổ file nội bộ > Tài liệu phòng ban). " +
            "Trả về id, tên và mã phòng ban để dùng cho các tool file khác.",
        inputSchema: z.object({
            query: z.string().optional().describe("lọc theo tên hoặc mã phòng ban"),
        }),
    }, async ({ query }) => guard(async () => {
        const body = await client.get("/internal-files/departments");
        const departments = unwrap(body) ?? [];
        const needle = query?.trim().toLowerCase();
        const filtered = needle
            ? departments.filter((dept) => dept.department_name?.toLowerCase().includes(needle) ||
                dept.department_code?.toLowerCase().includes(needle))
            : departments;
        if (filtered.length === 0)
            return ok("Không có phòng ban nào khớp.");
        return ok(filtered
            .map((dept) => `- ${dept.department_name ?? "?"} (${dept.department_code ?? "?"})\n  id=${dept._id ?? "?"}`)
            .join("\n"));
    }));
    server.registerTool("vwork_dept_files", {
        description: "Xem thư mục và file trong ổ file nội bộ của một phòng ban (Tài liệu phòng ban). " +
            "Truyền `department` là id/tên/mã phòng ban; `folderId` để vào thư mục con; `query` để tìm theo tên file.",
        inputSchema: z.object({
            department: z.string().describe("id, mã (K-CN) hoặc tên phòng ban"),
            folderId: z.string().optional().describe("id thư mục con (bỏ trống = thư mục gốc)"),
            query: z.string().optional().describe("tìm theo tên file/thư mục"),
            limit: z.number().int().min(1).max(300).default(50),
        }),
    }, async ({ department, folderId, query, limit }) => guard(async () => {
        const deptBody = await client.get("/internal-files/departments");
        const departments = unwrap(deptBody) ?? [];
        const dept = findDepartment(departments, department);
        if (!dept?._id) {
            const names = departments.map((item) => item.department_name).join(", ");
            return fail(`không tìm thấy phòng ban ${JSON.stringify(department)}. Có: ${names}`);
        }
        const foldersBody = await client.get(`/internal-files/${dept._id}/folders`, {
            parent_id: folderId,
        });
        const filesBody = await client.get(`/internal-files/${dept._id}/files`, {
            folder_id: folderId,
        });
        const folders = filterByQuery((unwrap(foldersBody) ?? []), query);
        const files = filterByQuery((unwrap(filesBody) ?? []), query);
        const lines = [
            `📁 ${dept.department_name} (${dept.department_code ?? "?"}) · ${folders.length} thư mục · ${files.length} file`,
            folderId ? `đang ở folder ${folderId}` : "đang ở thư mục gốc",
        ];
        const max = limit ?? 50;
        const shownFolders = folders.slice(0, max);
        const shownFiles = files.slice(0, Math.max(0, max - shownFolders.length));
        if (shownFolders.length) {
            lines.push("", ...shownFolders.map((folder) => formatFolder(folder)));
        }
        if (shownFiles.length) {
            lines.push("", ...shownFiles.map((file) => formatFile(file)));
        }
        if (!shownFolders.length && !shownFiles.length) {
            lines.push("", "Không có mục nào khớp.");
        }
        return ok(lines.join("\n"));
    }));
    server.registerTool("vwork_dept_tree", {
        description: "In cây thư mục đầy đủ của ổ file nội bộ một phòng ban (Tài liệu phòng ban), kèm id để mở tiếp.",
        inputSchema: z.object({ department: z.string().describe("id, mã hoặc tên phòng ban") }),
    }, async ({ department }) => guard(async () => {
        const deptBody = await client.get("/internal-files/departments");
        const departments = unwrap(deptBody) ?? [];
        const dept = findDepartment(departments, department);
        if (!dept?._id)
            return fail(`không tìm thấy phòng ban ${JSON.stringify(department)}`);
        const folders = unwrap(await client.get(`/internal-files/${dept._id}/folders/all`)) ?? [];
        return ok(`📁 ${dept.department_name}\n${buildFolderTree(folders)}`);
    }));
    server.registerTool("vwork_file_download", {
        description: "Tải một file trong ổ file nội bộ về máy (mặc định ~/Downloads/vwork) và trả về đường dẫn. " +
            "Dùng id file lấy từ vwork_dept_files. Giới hạn 50MB.",
        inputSchema: z.object({
            fileId: z.string().describe("id file (_id) trong danh sách file"),
            saveDir: z.string().optional().describe("thư mục lưu, mặc định ~/Downloads/vwork"),
        }),
    }, async ({ fileId, saveDir }) => guard(async () => {
        const result = await client.download(`/internal-files/file/${fileId}/view`);
        const MAX = 50 * 1024 * 1024;
        if (result.bytes.length > MAX) {
            return fail(`file ${(result.bytes.length / 1024 / 1024).toFixed(1)}MB vượt giới hạn 50MB`);
        }
        const fromHeader = filenameFromDisposition(result.filename);
        const name = sanitizeFileName(fromHeader ?? `${fileId}`);
        const dir = saveDir ?? defaultDownloadDir();
        await mkdir(dir, { recursive: true });
        const fullPath = join(dir, name);
        await writeFile(fullPath, result.bytes);
        return ok(`✅ Đã tải ${name} (${(result.bytes.length / 1024).toFixed(0)}KB)\n${fullPath}`);
    }));
    server.registerTool("vwork_api", {
        description: "Gọi API VWork tuỳ ý (đã có sẵn auth). GET luôn được phép trong danh sách nhóm API; " +
            "PATCH/POST/PUT/DELETE chỉ khi VWORK_ALLOW_WRITE=true và thuộc nhóm an toàn.",
        inputSchema: z.object({
            method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]).default("GET"),
            path: z.string().describe("vd /tickets, /notification, /project-tracker/eoffice/docs"),
            query: z
                .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
                .optional(),
            body: z.unknown().optional(),
        }),
    }, async ({ method, path, query, body }) => guard(async () => {
        assertAllowedPath(path, config.allowWrite, method);
        const result = await client.request(method, path, {
            query,
            body: method === "GET" ? undefined : body,
        });
        return ok(json(unwrap(result)));
    }));
    server.registerTool("vwork_project_overview", {
        description: "Ảnh chụp nhanh: tài khoản hiện tại + tổng hợp tiến độ + ticket đang mở + thông báo chưa đọc.",
        inputSchema: z.object({ project: projectArg }),
    }, async ({ project }) => guard(async () => {
        const [me, tracker, tickets, unread] = await Promise.allSettled([
            client.get("/user/getUserInfo"),
            client.get(`/project-tracker/${project ?? config.project}/docs`),
            client.get("/tickets", { limit: 5 }),
            client.get("/notification/unread-count"),
        ]);
        return ok(json({
            me: me.status === "fulfilled" ? unwrap(me.value) : "không lấy được",
            tracker: tracker.status === "fulfilled"
                ? summarizeDocs(extractDocs(tracker.value))
                : "không lấy được",
            tickets: tickets.status === "fulfilled" ? unwrap(tickets.value) : "không lấy được",
            unread: unread.status === "fulfilled" ? unwrap(unread.value) : "không lấy được",
        }));
    }));
}
export { docCollection, docStatus, docTitle };
