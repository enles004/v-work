import "dotenv/config";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const isUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const boolFromEnv = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") return undefined;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  });

const intFromEnv = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === "") return fallback;
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0) {
        ctx.addIssue({ code: "custom", message: `giá trị không hợp lệ: ${value}` });
        return z.NEVER;
      }
      return parsed;
    });

export const configSchema = z.object({
  baseUrl: z
    .string()
    .default("https://vWork.vnfite.com.vn")
    .refine(isUrl, "VWORK_BASE_URL phải là URL hợp lệ")
    .transform((value) => value.replace(/\/+$/, "")),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  project: z.string().min(1).default("eoffice"),
  allowWrite: boolFromEnv.transform((value) => value ?? false),
  cacheTtlMs: intFromEnv(30_000),
  timeoutMs: intFromEnv(20_000),
  tokenFile: z
    .string()
    .default(join(homedir(), ".config", "vwork-mcp", "tokens.json")),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return configSchema.parse({
    baseUrl: env.VWORK_BASE_URL,
    username: env.VWORK_USERNAME,
    password: env.VWORK_PASSWORD,
    project: env.VWORK_PROJECT,
    allowWrite: env.VWORK_ALLOW_WRITE,
    cacheTtlMs: env.VWORK_CACHE_TTL_MS,
    timeoutMs: env.VWORK_TIMEOUT_MS,
    tokenFile: env.VWORK_TOKEN_FILE,
  });
}
