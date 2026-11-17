import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { Config } from "./config.js";

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

type FetchLike = typeof fetch;

function jwtExpiresAt(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class AuthSession {
  private tokens: Tokens | null = null;
  private refreshing: Promise<string> | null = null;

  constructor(
    private readonly config: Pick<Config, "baseUrl" | "username" | "password" | "tokenFile" | "timeoutMs">,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async accessToken(): Promise<string> {
    if (!this.tokens) await this.loadTokens();
    if (this.tokens && !this.expiresSoon(this.tokens.accessToken)) {
      return this.tokens.accessToken;
    }
    if (this.tokens?.refreshToken) {
      try {
        return await this.refresh();
      } catch {
        this.tokens = null;
      }
    }
    if (!this.config.username || !this.config.password) {
      throw new AuthError(
        "chưa đăng nhập. Chạy `vwork-mcp login` (hoặc đặt VWORK_USERNAME/VWORK_PASSWORD).",
      );
    }
    return this.login();
  }

  async login(): Promise<string> {
    if (!this.config.username || !this.config.password) {
      throw new AuthError("thiếu VWORK_USERNAME/VWORK_PASSWORD để đăng nhập");
    }
    const response = await this.fetchImpl(`${this.config.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: this.config.username,
        password: this.config.password,
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new AuthError(
        `đăng nhập thất bại (HTTP ${response.status}): ${(body as { message?: string })?.message ?? ""}`,
      );
    }
    const data = (body as { data?: Tokens } | null)?.data ?? (body as unknown as Tokens);
    if (!data?.accessToken || !data?.refreshToken) {
      throw new AuthError("phản hồi đăng nhập thiếu accessToken/refreshToken");
    }
    await this.persist({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken;
  }

  async refresh(): Promise<string> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      // Đọc lại từ disk: process khác (CLI/MCP) có thể vừa xoay token.
      const tokens = (await this.loadTokens()) ?? this.tokens;
      if (!tokens?.refreshToken) throw new AuthError("không có refreshToken");

      const response = await this.fetchImpl(`${this.config.baseUrl}/auth/refreshToken`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new AuthError(`refresh thất bại (HTTP ${response.status})`);
      }
      const data = (body as { data?: Tokens } | null)?.data ?? (body as unknown as Tokens);
      if (!data?.accessToken || !data?.refreshToken) {
        throw new AuthError("phản hồi refresh thiếu token");
      }
      await this.persist({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return data.accessToken;
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  invalidate(): void {
    this.tokens = null;
  }

  private expiresSoon(token: string): boolean {
    const expiresAt = jwtExpiresAt(token);
    if (expiresAt === null) return false;
    return expiresAt - Date.now() < 60_000;
  }

  private async persist(tokens: Tokens): Promise<void> {
    try {
      await mkdir(dirname(this.config.tokenFile), { recursive: true });
      await writeFile(this.config.tokenFile, JSON.stringify(tokens), { mode: 0o600 });
      await chmod(this.config.tokenFile, 0o600);
    } catch (error) {
      throw new AuthError(
        `không ghi được token file ${this.config.tokenFile}: ${(error as Error).message}`,
      );
    }
    this.tokens = tokens;
  }

  async loadTokens(): Promise<Tokens | null> {
    try {
      const raw = await readFile(this.config.tokenFile, "utf8");
      const parsed = JSON.parse(raw) as Tokens;
      if (parsed?.accessToken && parsed?.refreshToken) {
        this.tokens = parsed;
        return parsed;
      }
    } catch {
      // chưa có token trên disk là bình thường
    }
    return null;
  }
}
