export interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

const BOOLEAN_FLAGS = new Set(["json", "mine", "overdue", "todo", "unread", "all"]);

export function parseFlags(argv: string[]): ParsedArgs {
  const [command = "", ...rest] = argv;
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]!;
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const key = rawKey ?? "";
    if (inlineValue !== undefined) {
      flags[key] = inlineValue;
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

export function flagString(flags: ParsedArgs["flags"], key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

export function flagNumber(flags: ParsedArgs["flags"], key: string, fallback: number): number {
  const value = flags[key];
  const parsed = typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function flagBool(flags: ParsedArgs["flags"], key: string): boolean {
  return flags[key] === true || flags[key] === "true";
}
