import { asArray, fieldOf, nestedFieldOf, textOf, toIsoDate } from "../format.js";
const DONE_STATUSES = new Set([
    "done",
    "completed",
    "complete",
    "closed",
    "resolved",
    "hoanthanh",
    "hoàn thành",
    "xong",
]);
const STATUS_FIELDS = ["status", "state", "stage", "trangthai", "trạng thái"];
const ASSIGNEE_FIELDS = [
    "assignee",
    "assignees",
    "assignedTo",
    "owner",
    "owners",
    "pic",
    "nguoiphutrach",
    "người phụ trách",
    "member",
];
const TITLE_FIELDS = [
    "feature",
    "title",
    "name",
    "subject",
    "summary",
    "text",
    "tenduan",
    "tentask",
    "tên",
];
const DUE_FIELDS = [
    "dueDate",
    "due_date",
    "due",
    "deadline",
    "endDate",
    "end_date",
    "finishDate",
    "ngayketthuc",
    "ngày kết thúc",
];
const PROGRESS_FIELDS = ["progress", "percent", "percentage", "phantram", "phần trăm"];
export function extractDocs(body) {
    const data = body && typeof body === "object" && "data" in body
        ? body.data
        : body;
    return asArray(data);
}
export function isDoneStatus(status) {
    return DONE_STATUSES.has(status.trim().toLowerCase());
}
export function docStatus(doc) {
    const value = nestedFieldOf(doc, STATUS_FIELDS);
    if (typeof value === "string" && value.trim())
        return value.trim();
    if (value && typeof value === "object") {
        const nested = fieldOf(value, ["name", "label", "value", "code"]);
        if (typeof nested === "string" && nested.trim())
            return nested.trim();
    }
    return "không rõ";
}
export function docAssignee(doc) {
    const value = nestedFieldOf(doc, ASSIGNEE_FIELDS);
    if (typeof value === "string" && value.trim())
        return value.trim();
    if (Array.isArray(value)) {
        return value
            .map((item) => typeof item === "string"
            ? item
            : String(fieldOf(item, ["name", "fullName", "username", "email"]) ?? ""))
            .filter(Boolean)
            .join(", ");
    }
    if (value && typeof value === "object") {
        const name = fieldOf(value, ["name", "fullName", "username", "email"]);
        if (typeof name === "string")
            return name;
    }
    return "chưa gán";
}
export function docCode(doc) {
    const value = nestedFieldOf(doc, ["code", "doc_id", "docId", "key", "id"]);
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
export function docTitle(doc) {
    const value = nestedFieldOf(doc, TITLE_FIELDS);
    if (typeof value === "string" && value.trim())
        return value.trim();
    return docCode(doc) || "(không tên)";
}
export function docCollection(doc) {
    const value = fieldOf(doc, ["collection", "collectionName", "type", "entity"]);
    return typeof value === "string" ? value : "khác";
}
export function docDue(doc) {
    return toIsoDate(nestedFieldOf(doc, DUE_FIELDS));
}
export function docProgress(doc) {
    const value = nestedFieldOf(doc, PROGRESS_FIELDS);
    if (typeof value === "number")
        return value <= 1 ? Math.round(value * 100) : value;
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value.replace("%", "").trim());
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
export function isOverdue(doc, now) {
    if (DONE_STATUSES.has(docStatus(doc).toLowerCase()))
        return false;
    const due = docDue(doc);
    return due !== null && due.getTime() < now.getTime();
}
export function searchDocs(docs, filters) {
    const now = filters.now ?? new Date();
    const query = filters.query?.trim().toLowerCase();
    const status = filters.status?.trim().toLowerCase();
    const assignee = filters.assignee?.trim().toLowerCase();
    const collection = filters.collection?.trim().toLowerCase();
    const limit = filters.limit ?? 50;
    return docs
        .filter((doc) => {
        if (query && !textOf(doc).includes(query))
            return false;
        if (status && !docStatus(doc).toLowerCase().includes(status))
            return false;
        if (assignee && !docAssignee(doc).toLowerCase().includes(assignee))
            return false;
        if (collection && !docCollection(doc).toLowerCase().includes(collection))
            return false;
        if (filters.overdueOnly && !isOverdue(doc, now))
            return false;
        return true;
    })
        .slice(0, limit);
}
export function summarizeDocs(docs, now = new Date()) {
    const byCollection = {};
    const byStatus = {};
    const byAssignee = {};
    let overdue = 0;
    let dueSoon = 0;
    const soon = now.getTime() + 3 * 24 * 60 * 60 * 1000;
    for (const doc of docs) {
        const collection = docCollection(doc);
        byCollection[collection] = (byCollection[collection] ?? 0) + 1;
        const status = docStatus(doc);
        byStatus[status] = (byStatus[status] ?? 0) + 1;
        for (const person of docAssignee(doc).split(/\s*[,+]\s*/)) {
            byAssignee[person] = (byAssignee[person] ?? 0) + 1;
        }
        if (isOverdue(doc, now))
            overdue += 1;
        else {
            const due = docDue(doc);
            if (due && due.getTime() <= soon && !DONE_STATUSES.has(status.toLowerCase())) {
                dueSoon += 1;
            }
        }
    }
    return { total: docs.length, byCollection, byStatus, byAssignee, overdue, dueSoon };
}
export function docPriority(doc) {
    const value = nestedFieldOf(doc, ["prio", "priority", "do_uutien"]);
    return typeof value === "string" ? value : "";
}
export function docRelease(doc) {
    const value = nestedFieldOf(doc, ["release", "version", "sprint"]);
    return typeof value === "string" ? value : "";
}
export function isBlocked(doc) {
    return nestedFieldOf(doc, ["blocked", "isBlocked"]) === true;
}
export function formatDoc(doc, now = new Date()) {
    const due = docDue(doc);
    const progress = docProgress(doc);
    const code = docCode(doc);
    const flags = [
        docPriority(doc) || null,
        docRelease(doc) || null,
        due ? `hạn ${due.toISOString().slice(0, 10)}` : null,
        progress === null ? null : `${progress}%`,
        isBlocked(doc) ? "BLOCKED" : null,
        isOverdue(doc, now) ? "QUÁ HẠN" : null,
    ].filter(Boolean);
    return [
        `[${docCollection(doc)}${code ? `/${code}` : ""}] ${docTitle(doc)}`,
        `trạng thái: ${docStatus(doc)}`,
        `phụ trách: ${docAssignee(doc)}`,
        flags.length ? flags.join(" · ") : null,
    ]
        .filter(Boolean)
        .join(" | ");
}
