import { describe, expect, it } from "vitest";

import { parseCommand } from "../src/cli-args.js";

describe("parseCommand", () => {
  it("không tham số → serve (cho MCP client)", () => {
    expect(parseCommand([])).toEqual({ kind: "serve" });
  });

  it("auth không phụ → login", () => {
    expect(parseCommand(["auth"])).toEqual({ kind: "login" });
    expect(parseCommand(["auth", "login"])).toEqual({ kind: "login" });
  });

  it("auth status/logout/whoami", () => {
    expect(parseCommand(["auth", "status"])).toEqual({ kind: "status" });
    expect(parseCommand(["auth", "logout"])).toEqual({ kind: "logout" });
    expect(parseCommand(["auth", "whoami"])).toEqual({ kind: "whoami" });
  });

  it("giữ alias cũ", () => {
    expect(parseCommand(["login"])).toEqual({ kind: "login" });
    expect(parseCommand(["serve"])).toEqual({ kind: "serve" });
  });

  it("help", () => {
    expect(parseCommand(["--help"])).toEqual({ kind: "help" });
    expect(parseCommand(["auth", "--help"])).toEqual({ kind: "help" });
  });

  it("version", () => {
    expect(parseCommand(["--version"])).toEqual({ kind: "version" });
    expect(parseCommand(["-v"])).toEqual({ kind: "version" });
  });

  it("lệnh lạ → invalid", () => {
    expect(parseCommand(["auth", "foo"])).toEqual({ kind: "invalid", value: "auth foo" });
    expect(parseCommand(["xyz"])).toEqual({ kind: "invalid", value: "xyz" });
  });
});

describe("auth flags", () => {
  it("auth <sub> --help trả help", () => {
    expect(parseCommand(["auth", "login", "--help"])).toEqual({ kind: "help" });
    expect(parseCommand(["auth", "logout", "--help"])).toEqual({ kind: "help" });
  });

  it("auth với flag lạ bị từ chối", () => {
    expect(parseCommand(["auth", "--bogus"])).toEqual({ kind: "invalid", value: "auth --bogus" });
    expect(parseCommand(["auth", "login", "extra"])).toEqual({
      kind: "invalid",
      value: "auth login extra",
    });
  });
});
