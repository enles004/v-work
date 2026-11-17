import { describe, expect, it } from "vitest";

import { flagBool, flagNumber, flagString, parseFlags } from "../src/cli/flags.js";

describe("parseFlags", () => {
  it("tách command, positional và flags", () => {
    const args = parseFlags(["tasks", "--mine", "--status", "Chưa làm", "--limit=5"]);
    expect(args.command).toBe("tasks");
    expect(flagBool(args.flags, "mine")).toBe(true);
    expect(flagString(args.flags, "status")).toBe("Chưa làm");
    expect(flagNumber(args.flags, "limit", 30)).toBe(5);
  });

  it("boolean flag không ăn token tiếp theo", () => {
    const args = parseFlags(["tasks", "--mine", "extra"]);
    expect(flagBool(args.flags, "mine")).toBe(true);
    expect(args.positional).toEqual(["extra"]);
  });

  it("positional cho api", () => {
    const args = parseFlags(["api", "GET", "/tickets", "--query", "status=open,limit=3"]);
    expect(args.positional).toEqual(["GET", "/tickets"]);
    expect(flagString(args.flags, "query")).toBe("status=open,limit=3");
  });
});
