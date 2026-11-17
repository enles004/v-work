import { fieldOf, nestedFieldOf, unwrap } from "../format.js";
import { docAssignee, docStatus, isDoneStatus } from "./tracker.js";
export function identityAliases(identity) {
    return [identity.name, identity.shortName, identity.username, identity.email]
        .filter((value) => Boolean(value))
        .map((value) => value.toLowerCase());
}
const NAME_FIELDS = ["fullName", "full_name", "name", "displayName", "display_name"];
const ID_FIELDS = ["id", "accountId", "account_id", "userId", "user_id", "employeeId"];
function pickString(source, fields) {
    const value = fieldOf(source, fields);
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
export function extractIdentity(me) {
    const body = unwrap(me);
    const root = body && typeof body === "object" ? body : {};
    const account = (root.account ??
        root.user ??
        root.profile ??
        root.me ??
        root);
    const name = pickString(account, NAME_FIELDS) ?? pickString(root, NAME_FIELDS);
    const tokens = (name ?? "").trim().split(/\s+/);
    return {
        name,
        // Task trong vWork ghi owner bằng tên gọi ("Phước"), không phải họ tên đầy đủ.
        shortName: tokens.length > 1 ? tokens[tokens.length - 1] : undefined,
        username: pickString(account, ["username", "userName"]) ?? pickString(root, ["username"]),
        email: pickString(account, ["email", "emailAddress"]) ?? pickString(root, ["email"]),
        id: pickString(account, ID_FIELDS) ?? pickString(root, ID_FIELDS),
    };
}
function assigneeIds(doc) {
    const value = nestedFieldOf(doc, ["assignee", "assignees", "members", "pic"]);
    const collect = (item) => {
        if (Array.isArray(item))
            return item.flatMap(collect);
        if (item && typeof item === "object") {
            const id = fieldOf(item, ID_FIELDS);
            return typeof id === "string" ? [id] : [];
        }
        return [];
    };
    const direct = fieldOf(doc, ID_FIELDS);
    return [...collect(value), ...(typeof direct === "string" ? [direct] : [])];
}
export function filterMyTasks(docs, identity, filters = {}) {
    const nameAliases = [identity.name, identity.shortName]
        .filter((value) => Boolean(value))
        .map((value) => value.toLowerCase());
    const accountAliases = [identity.username, identity.email]
        .filter((value) => Boolean(value))
        .map((value) => value.toLowerCase());
    const status = filters.status?.trim().toLowerCase();
    const includeDone = filters.includeDone ?? true;
    const limit = filters.limit ?? 50;
    return docs
        .filter((doc) => {
        const assigneeText = docAssignee(doc).toLowerCase();
        const segments = assigneeText
            .split(/\s*[,+]\s*/)
            .map((segment) => segment.trim())
            .filter(Boolean);
        // Tên phải khớp nguyên token ("Phước" không khớp "Phước Anh");
        // username/email thì so khớp chuỗi vì là định danh duy nhất.
        const byName = segments.some((segment) => nameAliases.includes(segment));
        const byAccount = segments.some((segment) => accountAliases.includes(segment));
        const byText = byName || byAccount;
        const byId = identity.id ? assigneeIds(doc).includes(identity.id) : false;
        if (!byText && !byId)
            return false;
        if (!includeDone && isDoneStatus(docStatus(doc)))
            return false;
        if (status && !docStatus(doc).toLowerCase().includes(status))
            return false;
        return true;
    })
        .slice(0, limit);
}
