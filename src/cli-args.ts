export type Command =
  | { kind: "serve" }
  | { kind: "login" }
  | { kind: "status" }
  | { kind: "logout" }
  | { kind: "whoami" }
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "cli"; name: string }
  | { kind: "invalid"; value: string };

export const CLI_COMMANDS = new Set([
  "me",
  "tasks",
  "summary",
  "tickets",
  "ticket",
  "notifications",
  "update",
  "api",
  "doctor",
  "upgrade",
]);

export function parseCommand(argv: string[]): Command {
  const [first, second] = argv;
  if (!first) return { kind: "serve" };

  if (first === "auth") {
    const rest = argv.slice(1);
    if (rest.some((token) => token === "--help" || token === "-h")) return { kind: "help" };
    const positional = rest.filter((token) => !token.startsWith("-"));
    const unknownFlags = rest.filter(
      (token) => token.startsWith("-") && token !== "--json",
    );
    if (unknownFlags.length > 0 || positional.length > 1) {
      return { kind: "invalid", value: `auth ${rest.join(" ")}`.trim() };
    }
    switch (second) {
      case undefined:
      case "login":
        return { kind: "login" };
      case "status":
        return { kind: "status" };
      case "logout":
        return { kind: "logout" };
      case "whoami":
        return { kind: "whoami" };
      case "--help":
      case "-h":
      case "help":
        return { kind: "help" };
      default:
        return { kind: "invalid", value: `auth ${second}` };
    }
  }

  switch (first) {
    case "serve":
      return { kind: "serve" };
    case "login":
    case "status":
    case "logout":
    case "whoami":
      return { kind: first };
    case "--help":
    case "-h":
    case "help":
      return { kind: "help" };
    case "--version":
    case "-v":
    case "version":
      return { kind: "version" };
    default:
      if (CLI_COMMANDS.has(first)) return { kind: "cli", name: first };
      return { kind: "invalid", value: first };
  }
}
