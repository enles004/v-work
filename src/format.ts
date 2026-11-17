export type Json = Record<string, unknown>;

export function unwrap<T = unknown>(body: unknown): T {
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    for (const key of ["docs", "items", "list", "results", "data", "tickets"]) {
      const candidate = (value as Json)[key];
      if (Array.isArray(candidate)) return candidate;
    }
  }
  return [];
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function fieldOf(doc: unknown, names: string[]): unknown {
  if (!doc || typeof doc !== "object") return undefined;
  const wanted = names.map(normalizeKey);
  for (const [key, value] of Object.entries(doc as Json)) {
    if (wanted.includes(normalizeKey(key))) return value;
  }
  return undefined;
}

export function nestedFieldOf(doc: unknown, names: string[]): unknown {
  const direct = fieldOf(doc, names);
  if (direct !== undefined) return direct;
  if (!doc || typeof doc !== "object") return undefined;
  for (const value of Object.values(doc as Json)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = fieldOf(value, names);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

export function textOf(doc: unknown): string {
  const parts: string[] = [];
  const walk = (value: unknown, depth: number): void => {
    if (depth > 3 || value === null || value === undefined) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      parts.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 20)) walk(item, depth + 1);
      return;
    }
    if (typeof value === "object") {
      for (const item of Object.values(value as Json)) walk(item, depth + 1);
    }
  };
  walk(doc, 0);
  return parts.join(" ").toLowerCase();
}

export function toIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function truncate(value: string, max = 4000): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}
