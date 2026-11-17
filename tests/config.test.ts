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

  it("thiếu username thì lỗi", () => {
    expect(() => loadConfig({ VWORK_PASSWORD: "p" } as NodeJS.ProcessEnv)).toThrow();
  });
});
