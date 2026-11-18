export const HELP = `v-work — MCP server cho VNFITE Work

CÁCH DÙNG
  v-work [lệnh]

LỆNH
  auth [login]      Đăng nhập VNFITE Work và lưu token
  auth status       Kiểm tra trạng thái đăng nhập
  auth whoami       In hồ sơ tài khoản đang đăng nhập
  auth logout       Xoá token đã lưu

  me                Hồ sơ + số quyền
  tasks             Task trong bảng tiến độ
                    --mine --status "Chưa làm" --todo --overdue --limit 20
  summary           Tổng hợp theo trạng thái / người phụ trách / quá hạn
  tickets           Danh sách ticket (--status, --limit)
  ticket <id>       Chi tiết ticket
  notifications     Thông báo (--limit)
  update <code>     Cập nhật task: --status TEXT --note TEXT
  api <METHOD> <PATH>   Gọi API bất kỳ: --query "k=v,k2=v2" --body '{"a":1}'

  doctor            Chẩn đoán: node, token, kết nối API
  upgrade           Cập nhật code mới nhất rồi reconnect MCP là xong
  serve             Chạy MCP server qua stdio (Claude/Cursor tự gọi)
  help              Hiện trợ giúp này
  version           Hiện phiên bản

  Thêm --json vào bất kỳ lệnh nào để lấy JSON thô.

VÍ DỤ
  npx -y v-work auth
  npx -y v-work tasks --mine --todo
  npx -y v-work summary
  VWORK_ALLOW_WRITE=true npx -y v-work update A01 --status "Đang làm"
  npx -y v-work api GET /tickets --query "status=open,limit=3"
  npx -y v-work tasks --mine --json

CẤU HÌNH MCP CLIENT
  Claude Desktop / Cursor (~/.config/... hoặc .cursor/mcp.json):

    {
      "mcpServers": {
        "vwork": { "command": "npx", "args": ["-y", "v-work"] }
      }
    }

  Claude Code:

    claude mcp add vwork -- npx -y v-work

BIẾN MÔI TRƯỜNG (tuỳ chọn, không bắt buộc)
  VWORK_BASE_URL      Mặc định: https://vWork.vnfite.com.vn
  VWORK_PROJECT       Mặc định: eoffice
  VWORK_ALLOW_WRITE   true để bật thao tác ghi (mặc định chỉ đọc)
  VWORK_TOKEN_FILE    Mặc định: ~/.config/vwork-mcp/tokens.json

TOOL
  vwork_me · vwork_my_tasks · vwork_project_overview · vwork_tracker_docs
  vwork_tracker_search · vwork_tracker_summary · vwork_tickets
  vwork_ticket · vwork_notifications · vwork_update_task · vwork_api
  vwork_file_departments · vwork_dept_files · vwork_dept_tree · vwork_file_download
`;

export const VERSION = "0.1.0";
