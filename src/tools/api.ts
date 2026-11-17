export const READ_PREFIXES = [
  "/project-tracker",
  "/tickets",
  "/notification",
  "/permissions/me",
  "/permissions/catalog",
  "/user",
  "/department",
  "/employment-status",
  "/hrm-dashboard",
  "/customer",
  "/customer-care",
  "/customer-call",
  "/shared-folders",
  "/internal-files",
  "/ai",
];

// Chỉ mở cho các nhóm an toàn; mọi nhóm khác vẫn phải dùng tool chuyên dụng.
export const WRITE_PREFIXES = ["/project-tracker", "/tickets", "/notification"];

const percentEncoded = /%[0-9a-f]{2}/i;

export class PathNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathNotAllowedError";
  }
}

/** Chuẩn hoá path trước khi kiểm allowlist: chặn absolute URL và dot-segment đã mã hoá. */
export function normalizePath(path: string): string {
  if (!path.startsWith("/") || path.includes("://") || path.includes("\\")) {
    throw new PathNotAllowedError(`đường dẫn không hợp lệ: ${path}`);
  }

  // Decode tới khi ổn định để không còn lớp mã hoá nào lọt qua allowlist.
  let decoded = path;
  for (let depth = 0; depth < 10; depth += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      throw new PathNotAllowedError(`đường dẫn mã hoá không hợp lệ: ${path}`);
    }
    if (next === decoded) break;
    decoded = next;
  }

  if (percentEncoded.test(decoded)) {
    throw new PathNotAllowedError(`đường dẫn còn mã hoá sau khi decode: ${path}`);
  }
  if (decoded.split("/").some((segment) => segment === ".." || segment === ".")) {
    throw new PathNotAllowedError(`đường dẫn chứa dot-segment (../): ${path}`);
  }

  // Invariant: path được kiểm phải đúng bằng path sẽ gọi (new URL không được đổi nó).
  const canonical = new URL(decoded, "http://localhost").pathname;
  if (canonical !== decoded) {
    throw new PathNotAllowedError(`path không ổn định: ${path}`);
  }
  return canonical;
}

export function assertAllowedPath(path: string, allowWrite: boolean, method: string): void {
  const normalized = normalizePath(path);
  if (normalized.startsWith("/auth/")) {
    throw new PathNotAllowedError("không được gọi API auth qua tool generic");
  }
  const upper = method.toUpperCase();
  if (upper === "GET") {
    if (!READ_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
      throw new PathNotAllowedError(
        `đường dẫn nằm ngoài danh sách cho phép: ${normalized}. ` +
          `Cho phép: ${READ_PREFIXES.join(", ")}`,
      );
    }
    return;
  }
  if (!allowWrite) {
    throw new PathNotAllowedError("chế độ chỉ đọc: bật VWORK_ALLOW_WRITE=true để gọi API ghi");
  }
  if (!WRITE_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
    throw new PathNotAllowedError(
      `chưa mở ghi cho nhóm này: ${normalized}. Cho phép ghi: ${WRITE_PREFIXES.join(", ")}`,
    );
  }
}
