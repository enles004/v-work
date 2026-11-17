export function unwrap(body) {
    if (body && typeof body === "object" && "data" in body) {
        return body.data;
    }
    return body;
}
export function asArray(value) {
    if (Array.isArray(value))
        return value;
    if (value && typeof value === "object") {
        for (const key of ["docs", "items", "list", "results", "data", "tickets"]) {
            const candidate = value[key];
            if (Array.isArray(candidate))
                return candidate;
        }
    }
    return [];
}
function normalizeKey(key) {
    return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}
export function fieldOf(doc, names) {
    if (!doc || typeof doc !== "object")
        return undefined;
    const wanted = names.map(normalizeKey);
    for (const [key, value] of Object.entries(doc)) {
        if (wanted.includes(normalizeKey(key)))
            return value;
    }
    return undefined;
}
export function nestedFieldOf(doc, names) {
    if (!doc || typeof doc !== "object")
        return undefined;
    // Doc của vWork bọc dữ liệu thật trong `data`; envelope (doc_id, version) không được che nó.
    const payload = doc.data;
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        const inner = fieldOf(payload, names);
        if (inner !== undefined)
            return inner;
    }
    const direct = fieldOf(doc, names);
    if (direct !== undefined)
        return direct;
    for (const value of Object.values(doc)) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
            const nested = fieldOf(value, names);
            if (nested !== undefined)
                return nested;
        }
    }
    return undefined;
}
export function textOf(doc) {
    const parts = [];
    const walk = (value, depth) => {
        if (depth > 3 || value === null || value === undefined)
            return;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            parts.push(String(value));
            return;
        }
        if (Array.isArray(value)) {
            for (const item of value.slice(0, 20))
                walk(item, depth + 1);
            return;
        }
        if (typeof value === "object") {
            for (const item of Object.values(value))
                walk(item, depth + 1);
        }
    };
    walk(doc, 0);
    return parts.join(" ").toLowerCase();
}
export function toIsoDate(value) {
    if (typeof value !== "string" && typeof value !== "number")
        return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
export function truncate(value, max = 4000) {
    return value.length <= max ? value : `${value.slice(0, max)}…`;
}
