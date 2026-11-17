export const CLI_HELP = {
    auth: `v-work auth [login|status|whoami|logout]

  login    Đăng nhập và lưu token (mặc định)
  status   Kiểm tra đã đăng nhập chưa
  whoami   In hồ sơ tài khoản
  logout   Xoá token

Ví dụ:
  npx -y v-work auth
  npx -y v-work auth whoami`,
    me: `v-work me [--json]

In hồ sơ tài khoản đang đăng nhập (họ tên, username, email, số quyền).`,
    tasks: `v-work tasks [--mine] [--status <text>] [--todo] [--overdue] [--limit N] [--json]

  --mine          chỉ task được giao cho bạn
  --status TEXT   lọc theo trạng thái (khớp một phần)
  --todo          bỏ task đã xong
  --overdue       chỉ task quá hạn
  --limit N       số dòng tối đa (mặc định 30)
  --json          in JSON thô

Ví dụ:
  v-work tasks --mine --todo
  v-work tasks --status "Chưa làm" --limit 10`,
    summary: `v-work summary [--json]

Tổng hợp bảng tiến độ: tổng doc, quá hạn, sắp hạn, theo trạng thái và người phụ trách.`,
    tickets: `v-work tickets [--status <text>] [--limit N] [--json]

Danh sách ticket hỗ trợ. --status lọc trạng thái, --limit mặc định 20.`,
    ticket: `v-work ticket <id>

Xem chi tiết một ticket theo id.`,
    notifications: `v-work notifications [--limit N] [--json]

Số thông báo chưa đọc và danh sách thông báo mới nhất.`,
    update: `v-work update <code|collection/docId> [--status TEXT] [--note TEXT] [--json]

Cập nhật một task trong bảng tiến độ. API chỉ cho sửa: status, note
(các field code/feature/owner/due/prio/release là bất biến).
Cần bật ghi: VWORK_ALLOW_WRITE=true.

Ví dụ:
  VWORK_ALLOW_WRITE=true v-work update A01 --status "Đang làm"
  VWORK_ALLOW_WRITE=true v-work update tasks/E02 --note "chờ review"`,
    api: `v-work api <METHOD> <PATH> [--query "k=v,k2=v2"] [--body '<json>'] [--json]

Gọi API VWork bất kỳ (đã có auth). GET luôn được phép trong allowlist;
PATCH/POST/PUT/DELETE cần VWORK_ALLOW_WRITE=true và thuộc nhóm an toàn.

Ví dụ:
  v-work api GET /tickets --query "status=open,limit=3"
  v-work api GET /project-tracker/eoffice/docs`,
};
export function helpFor(command) {
    return CLI_HELP[command];
}
