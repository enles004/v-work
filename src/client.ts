import type { Config } from "./config.js";
import { AuthError, AuthSession } from "./auth.js";
import { normalizePath } from "./tools/api.js";

type FetchLike = typeof fetch;

export class VworkError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "VworkError";
  }
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  timeoutMs?: number;
}

export class VworkClient {
  private readonly cache = new Map<string, { expiresAt: number; value: unknown }>();

  constructor(
    private readonly config: Pick<Config, "baseUrl" | "timeoutMs" | "cacheTtlMs" | "allowWrite">,
    private readonly auth: AuthSession,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async get<T = unknown>(path: string, query?: RequestOptions["query"]): Promise<T> {
    return this.request<T>("GET", path, { query });
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const upper = method.toUpperCase();
    if (upper !== "GET" && !this.config.allowWrite) {
      throw new VworkError(
        "Đang ở chế độ chỉ đọc. Đặt VWORK_ALLOW_WRITE=true để bật thao tác ghi.",
        403,
      );
    }
    if (!path.startsWith("/") || path.includes("://")) {
      throw new VworkError(`đường dẫn API không hợp lệ: ${path}`, 400);
    }

    const url = this.buildUrl(normalizePath(path), options.query);
    if (upper === "GET") {
      const cached = this.cache.get(url);
      if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    }

    const result = await this.send<T>(upper, url, options);
    if (upper === "GET") {
      if (this.config.cacheTtlMs > 0) {
        this.cache.set(url, {
          expiresAt: Date.now() + this.config.cacheTtlMs,
          value: result,
        });
      }
    } else {
      // Ghi xong thì dữ liệu cũ trong cache không còn đúng.
      this.cache.clear();
    }
    return result;
  }

  clearCache(): void {
    this.cache.clear();
  }

  private async send<T>(method: string, url: string, options: RequestOptions): Promise<T> {
    let token = await this.auth.accessToken();
    let response = await this.fetchOnce(method, url, token, options);

    if (response.status === 401) {
      try {
        token = await this.auth.refresh();
      } catch (error) {
        this.auth.invalidate();
        throw new VworkError(
          `phiên đăng nhập hết hạn: ${(error as AuthError).message}`,
          401,
        );
      }
      response = await this.fetchOnce(method, url, token, options);
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      if (response.ok) {
        throw new VworkError(
          `VWork trả HTTP ${response.status} nhưng body không phải JSON`,
          response.status,
        );
      }
    }
    if (!response.ok) {
      const message =
        (body as { message?: string } | null)?.message ?? `VWork trả HTTP ${response.status}`;
      throw new VworkError(message, response.status, body);
    }
    return body as T;
  }

  private fetchOnce(
    method: string,
    url: string,
    token: string,
    options: RequestOptions,
  ): Promise<Response> {
    return this.fetchImpl(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(options.timeoutMs ?? this.config.timeoutMs),
    });
  }

  private buildUrl(
    path: string,
    query?: RequestOptions["query"],
  ): string {
    const url = new URL(`${this.config.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }
}
