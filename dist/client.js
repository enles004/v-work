import { normalizePath } from "./tools/api.js";
export class VworkError extends Error {
    status;
    body;
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = "VworkError";
    }
}
export class VworkClient {
    config;
    auth;
    fetchImpl;
    cache = new Map();
    constructor(config, auth, fetchImpl = fetch) {
        this.config = config;
        this.auth = auth;
        this.fetchImpl = fetchImpl;
    }
    async get(path, query) {
        return this.request("GET", path, { query });
    }
    async request(method, path, options = {}) {
        const upper = method.toUpperCase();
        if (upper !== "GET" && !this.config.allowWrite) {
            throw new VworkError("Đang ở chế độ chỉ đọc. Đặt VWORK_ALLOW_WRITE=true để bật thao tác ghi.", 403);
        }
        if (!path.startsWith("/") || path.includes("://")) {
            throw new VworkError(`đường dẫn API không hợp lệ: ${path}`, 400);
        }
        const queryMark = path.indexOf("?");
        const rawPath = queryMark >= 0 ? path.slice(0, queryMark) : path;
        const inlineQuery = {};
        if (queryMark >= 0) {
            new URLSearchParams(path.slice(queryMark + 1)).forEach((value, key) => {
                inlineQuery[key] = value;
            });
        }
        const url = this.buildUrl(normalizePath(rawPath), { ...inlineQuery, ...options.query });
        if (upper === "GET") {
            const cached = this.cache.get(url);
            if (cached && cached.expiresAt > Date.now())
                return cached.value;
        }
        if (upper !== "GET") {
            // Ghi có thể đã thành công dù response lỗi/không parse được: bỏ cache trước khi gửi.
            this.cache.clear();
        }
        const result = await this.send(upper, url, options);
        if (upper === "GET") {
            if (this.config.cacheTtlMs > 0) {
                this.cache.set(url, {
                    expiresAt: Date.now() + this.config.cacheTtlMs,
                    value: result,
                });
            }
        }
        else {
            // Ghi xong thì dữ liệu cũ trong cache không còn đúng.
            this.cache.clear();
        }
        return result;
    }
    async download(path) {
        const url = this.buildUrl(normalizePath(path));
        let token = await this.auth.accessToken();
        let response = await this.fetchImpl(url, {
            method: "GET",
            headers: { authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(this.config.timeoutMs),
        });
        if (response.status === 401) {
            try {
                token = await this.auth.refresh();
            }
            catch (error) {
                this.auth.invalidate();
                throw new VworkError(`phiên đăng nhập hết hạn: ${error.message}`, 401);
            }
            response = await this.fetchImpl(url, {
                method: "GET",
                headers: { authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(this.config.timeoutMs),
            });
        }
        if (!response.ok) {
            throw new VworkError(`tải file thất bại (HTTP ${response.status})`, response.status);
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        return {
            bytes,
            contentType: response.headers.get("content-type"),
            filename: response.headers.get("content-disposition"),
        };
    }
    clearCache() {
        this.cache.clear();
    }
    async send(method, url, options) {
        let token = await this.auth.accessToken();
        let response = await this.fetchOnce(method, url, token, options);
        if (response.status === 401) {
            try {
                token = await this.auth.refresh();
            }
            catch (error) {
                this.auth.invalidate();
                throw new VworkError(`phiên đăng nhập hết hạn: ${error.message}`, 401);
            }
            response = await this.fetchOnce(method, url, token, options);
        }
        let body = null;
        try {
            body = await response.json();
        }
        catch {
            if (response.ok) {
                throw new VworkError(`VWork trả HTTP ${response.status} nhưng body không phải JSON`, response.status);
            }
        }
        if (!response.ok) {
            const message = body?.message ?? `VWork trả HTTP ${response.status}`;
            throw new VworkError(message, response.status, body);
        }
        return body;
    }
    fetchOnce(method, url, token, options) {
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
    buildUrl(path, query) {
        const url = new URL(`${this.config.baseUrl}${path}`);
        for (const [key, value] of Object.entries(query ?? {})) {
            if (value === undefined || value === null || value === "")
                continue;
            url.searchParams.set(key, String(value));
        }
        return url.toString();
    }
}
