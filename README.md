# vwork-mcp

MCP server (Node.js + TypeScript) cho **VNFITE Work** — cho phép AI đọc tiến độ dự án,
ticket, thông báo và gọi các API khác của vWork bằng tài khoản của bạn.

Chạy local qua **stdio**, không mở port, không gửi dữ liệu đi đâu ngoài `vWork.vnfite.com.vn`.

## Vì sao bọc API thay vì crawl HTML

Trang `/workplace/tien-do-du-an` là SPA React (Vite). Dữ liệu đi qua REST API:

```
Base:  https://vWork.vnfite.com.vn
Auth:  POST /auth/login {username,password} → accessToken + refreshToken (xoay vòng)
Data:  GET  /project-tracker/eoffice/docs
       GET  /project-tracker/eoffice/me
       PATCH /project-tracker/eoffice/docs/{collection}/{docId}
       POST /project-tracker/eoffice/import
```

Bản đồ đầy đủ: **157 endpoint / 10 nhóm** (project-tracker, tickets, notification, customer,
customer-care, customer-call, user/department, workplace files, permissions, ai-assistant).
Tool `vwork_api` phủ các endpoint còn lại mà không cần viết từng tool.

## Cài đặt

```bash
npm install
npm run build

cp .env.example .env
# điền VWORK_USERNAME / VWORK_PASSWORD

npm run auth:check   # đăng nhập thử + in tài khoản, số doc, field mẫu
```

`auth:check` in ra `✅ Đăng nhập OK: {name, username, email, id}`. Lần đầu chạy sẽ
lưu token vào `~/.config/vwork-mcp/tokens.json` (chmod 600); các lần sau tự dùng
token và tự refresh, không cần đăng nhập lại.

## Cấu hình client

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`
hoặc `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "vwork": {
      "command": "node",
      "args": ["/home/faris/code/My_Workspace/vwork-mcp/dist/server.js"],
      "env": {
        "VWORK_USERNAME": "your.username",
        "VWORK_PASSWORD": "your.password",
        "VWORK_PROJECT": "eoffice"
      }
    }
  }
}
```

**Cursor / VS Code** (`.cursor/mcp.json` hoặc `.vscode/mcp.json`): cùng cấu trúc trên.

Debug bằng MCP Inspector:

```bash
npm run inspect
```

## Tools

| Tool | Việc |
|---|---|
| `vwork_me` | tài khoản + quyền hiện tại |
| `vwork_my_tasks` | **task được giao cho chính bạn** (tự resolve danh tính) |
| `vwork_project_overview` | ảnh chụp nhanh: tài khoản, tổng hợp tiến độ, ticket, thông báo chưa đọc |
| `vwork_tracker_docs` | danh sách doc trong bảng tiến độ |
| `vwork_tracker_search` | tìm theo từ khoá / trạng thái / người phụ trách / collection / quá hạn |
| `vwork_tracker_summary` | đếm theo collection, trạng thái, người phụ trách, quá hạn, sắp đến hạn |
| `vwork_tickets` | danh sách ticket hỗ trợ |
| `vwork_ticket` | chi tiết ticket |
| `vwork_notifications` | thông báo chưa đọc + mới nhất |
| `vwork_api` | gọi API bất kỳ trong allowlist (GET luôn được; ghi phải bật) |

Câu hỏi mẫu:

- "Tuần này tôi có task nào quá hạn?"
- "Tổng hợp tiến độ dự án eoffice, ai đang nhiều việc nhất?"
- "Ticket nào đang mở cho khách hàng X?"
- "Có thông báo chưa đọc nào không?"

## An toàn

- Mặc định **chỉ đọc**: `VWORK_ALLOW_WRITE=false`. Bật `true` mới cho PATCH/POST/PUT/DELETE.
- Ghi chỉ mở cho `/project-tracker`, `/tickets`, `/notification`; `/auth/*` và `/permissions/*` luôn bị chặn.
- Token lưu tại `~/.config/vwork-mcp/tokens.json` (chmod 600), tự refresh và xoay vòng.
- Password chỉ nằm trong env của MCP client — không commit, không log.
- Cache GET 30s để tránh spam API khi AI hỏi liên tiếp.

## Phát triển

```bash
npm test        # 26 test, mock toàn bộ HTTP, không gọi mạng
npm run build
npm run dev     # tsx, dùng khi debug
```

Cấu trúc:

```
src/
  config.ts        # env → Config (zod)
  auth.ts          # login / refresh / token store
  client.ts        # HTTP client: auth, retry 401, cache, timeout
  format.ts        # helper đọc JSON không phụ thuộc schema
  tools/
    api.ts         # allowlist cho tool generic
    tracker.ts     # search / summarize / format doc
    register.ts    # đăng ký 9 tool
  server.ts        # entrypoint stdio
```
