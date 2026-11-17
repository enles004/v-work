const BOOLEAN_FLAGS = new Set([
    "json",
    "mine",
    "overdue",
    "todo",
    "unread",
    "all",
    "help",
]);
export function parseFlags(argv) {
    const [command = "", ...rest] = argv;
    const positional = [];
    const flags = {};
    for (let index = 0; index < rest.length; index += 1) {
        const token = rest[index];
        if (!token.startsWith("--")) {
            positional.push(token);
            continue;
        }
        const raw = token.slice(2);
        const equals = raw.indexOf("=");
        const key = equals >= 0 ? raw.slice(0, equals) : raw;
        if (equals >= 0) {
            flags[key] = raw.slice(equals + 1);
            continue;
        }
        const next = rest[index + 1];
        if (BOOLEAN_FLAGS.has(key) || next === undefined || next.startsWith("--")) {
            flags[key] = true;
            continue;
        }
        flags[key] = next;
        index += 1;
    }
    return { command, positional, flags };
}
export function flagString(flags, key) {
    const value = flags[key];
    return typeof value === "string" ? value : undefined;
}
export function flagNumber(flags, key, fallback) {
    const value = flags[key];
    const parsed = typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
export function flagBool(flags, key) {
    return flags[key] === true || flags[key] === "true";
}
export function assertKnownFlags(flags, allowed, command) {
    for (const key of Object.keys(flags)) {
        if (!allowed.includes(key)) {
            throw new Error(`flag không hợp lệ: --${key}. Xem: v-work ${command} --help`);
        }
    }
}
