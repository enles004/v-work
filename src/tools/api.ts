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

export class PathNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathNotAllowedError";
  }
}

/** Chuẩn hoá path trước khi kiểm allowlist: chặn absolute URL và dot-segment đã mã hoá. */
export function normalizePath(path: string): string {
  if (!path.startsWith("/") || path.includes("://")) {
    throw new PathNotAllowedError(`đường dẫn không hợp lệ: ${path}`);
  }
  const url = new URL(path, "http://localhost");
  let decoded = url.pathname;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    throw new PathNotAllowedError(`đường dẫn mã hoá không hợp lệ: ${path}`);
  }
  if (decoded.includes("..") || decoded.includes("\\")) {
    throw new PathNotAllowedError(`đường dẫn chứa ../ không được phép: ${path}`);
  }
  return decoded;
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
