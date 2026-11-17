import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
function jwtExpiresAt(token) {
    const parts = token.split(".");
    if (parts.length !== 3)
        return null;
    try {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
        return typeof payload.exp === "number" ? payload.exp * 1000 : null;
    }
    catch {
        return null;
    }
}
export class AuthError extends Error {
    constructor(message) {
        super(message);
        this.name = "AuthError";
    }
}
export class AuthSession {
    config;
    fetchImpl;
    tokens = null;
    refreshing = null;
    constructor(config, fetchImpl = fetch) {
        this.config = config;
        this.fetchImpl = fetchImpl;
    }
    async accessToken() {
        if (!this.tokens)
            await this.loadTokens();
        if (this.tokens && !this.expiresSoon(this.tokens.accessToken)) {
            return this.tokens.accessToken;
        }
        if (this.tokens?.refreshToken) {
            try {
                return await this.refresh();
            }
            catch {
                this.tokens = null;
            }
        }
        if (!this.config.username || !this.config.password) {
            throw new AuthError("chưa đăng nhập. Chạy `vwork-mcp login` (hoặc đặt VWORK_USERNAME/VWORK_PASSWORD).");
        }
        return this.login();
    }
    async login() {
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
            throw new AuthError(`đăng nhập thất bại (HTTP ${response.status}): ${body?.message ?? ""}`);
        }
        const data = body?.data ?? body;
        if (!data?.accessToken || !data?.refreshToken) {
            throw new AuthError("phản hồi đăng nhập thiếu accessToken/refreshToken");
        }
        await this.persist({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        return data.accessToken;
    }
    async refresh() {
        if (this.refreshing)
            return this.refreshing;
        this.refreshing = (async () => {
            // Đọc lại từ disk: process khác (CLI/MCP) có thể vừa xoay token.
            const tokens = (await this.loadTokens()) ?? this.tokens;
            if (!tokens?.refreshToken)
                throw new AuthError("không có refreshToken");
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
            const data = body?.data ?? body;
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
    invalidate() {
        this.tokens = null;
    }
    expiresSoon(token) {
        const expiresAt = jwtExpiresAt(token);
        if (expiresAt === null)
            return false;
        return expiresAt - Date.now() < 60_000;
    }
    async persist(tokens) {
        try {
            await mkdir(dirname(this.config.tokenFile), { recursive: true });
            await writeFile(this.config.tokenFile, JSON.stringify(tokens), { mode: 0o600 });
            await chmod(this.config.tokenFile, 0o600);
        }
        catch (error) {
            throw new AuthError(`không ghi được token file ${this.config.tokenFile}: ${error.message}`);
        }
        this.tokens = tokens;
    }
    async loadTokens() {
        try {
            const raw = await readFile(this.config.tokenFile, "utf8");
            const parsed = JSON.parse(raw);
            if (parsed?.accessToken && parsed?.refreshToken) {
                this.tokens = parsed;
                return parsed;
            }
        }
        catch {
            // chưa có token trên disk là bình thường
        }
        return null;
    }
}
