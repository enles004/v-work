import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

const base = { VWORK_USERNAME: "u", VWORK_PASSWORD: "p" };

describe("loadConfig", () => {
  it("áp dụng mặc định prod", () => {
    const config = loadConfig(base as NodeJS.ProcessEnv);
    expect(config.baseUrl).toBe("https://vWork.vnfite.com.vn");
    expect(config.project).toBe("eoffice");
    expect(config.allowWrite).toBe(false);
    expect(config.cacheTtlMs).toBe(30_000);
  });

  it("bỏ dấu / cuối baseUrl", () => {
    expect(loadConfig({ ...base, VWORK_BASE_URL: "https://x.test/" } as NodeJS.ProcessEnv).baseUrl).toBe(
      "https://x.test",
    );
  });

  it("bật write khi env true", () => {
    expect(loadConfig({ ...base, VWORK_ALLOW_WRITE: "true" } as NodeJS.ProcessEnv).allowWrite).toBe(
      true,
    );
  });

  it("username/password là tuỳ chọn (dùng token file)", () => {
    const config = loadConfig({} as NodeJS.ProcessEnv);
    expect(config.username).toBeUndefined();
    expect(config.tokenFile).toContain("tokens.json");
  });
});

describe("đường dẫn token theo OS", () => {
  it("linux dùng ~/.config", async () => {
    const { defaultTokenFile } = await import("../src/config.js");
    expect(defaultTokenFile("linux", {}, "/home/u")).toBe(
      "/home/u/.config/vwork-mcp/tokens.json",
    );
  });

  it("macOS dùng Application Support", async () => {
    const { defaultTokenFile } = await import("../src/config.js");
    expect(defaultTokenFile("darwin", {}, "/Users/u")).toBe(
      "/Users/u/Library/Application Support/vwork-mcp/tokens.json",
    );
  });

  it("windows dùng APPDATA", async () => {
    const { defaultTokenFile } = await import("../src/config.js");
    expect(defaultTokenFile("win32", { APPDATA: "C:\\Users\\u\\AppData\\Roaming" }, "C:\\Users\\u")).toContain(
      "vwork-mcp",
    );
  });
});
