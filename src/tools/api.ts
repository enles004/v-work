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

export function assertAllowedPath(path: string, allowWrite: boolean, method: string): void {
  if (!path.startsWith("/") || path.includes("://") || path.includes("..")) {
    throw new PathNotAllowedError(`đường dẫn không hợp lệ: ${path}`);
  }
  if (path.startsWith("/auth/")) {
    throw new PathNotAllowedError("không được gọi API auth qua tool generic");
  }
  const upper = method.toUpperCase();
  if (upper === "GET") {
    if (!READ_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      throw new PathNotAllowedError(
        `đường dẫn nằm ngoài danh sách cho phép: ${path}. ` +
          `Cho phép: ${READ_PREFIXES.join(", ")}`,
      );
    }
    return;
  }
  if (!allowWrite) {
    throw new PathNotAllowedError("chế độ chỉ đọc: bật VWORK_ALLOW_WRITE=true để gọi API ghi");
  }
  if (!WRITE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    throw new PathNotAllowedError(
      `chưa mở ghi cho nhóm này: ${path}. Cho phép ghi: ${WRITE_PREFIXES.join(", ")}`,
    );
  }
}
