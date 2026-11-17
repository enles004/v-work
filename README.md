# v-work

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

### Qua npx (sau khi publish)

```bash
npx -y v-work auth      # đăng nhập một lần
npx -y v-work auth status
```

Config MCP client:

```json
{
  "mcpServers": {
    "vwork": {
      "command": "npx",
      "args": ["-y", "v-work"]
    }
  }
}
```

Nếu chưa publish lên npm, có thể chạy trực tiếp từ GitHub:

```bash
npx -y github:enles004/v-work auth
```

### Từ source

```bash
npm install
npm run build

node dist/cli.js auth      # hỏi username/password một lần
node dist/cli.js auth status
```

**Không cần file `.env`.** Mặc định đã có sẵn:

- base URL: `https://vWork.vnfite.com.vn` (prod)
- project: `eoffice`
- chỉ đọc, cache 30s, timeout 20s

Chỉ khi cần đổi mặc định (ví dụ UAT) mới dùng biến môi trường `VWORK_BASE_URL`,
`VWORK_PROJECT`, `VWORK_ALLOW_WRITE` trong config của MCP client.

`login` hỏi username/password (password ẩn), lưu token vào
`~/.config/v-work/tokens.json` (chmod 600). Server dùng token này và tự refresh;
khi hết hạn hoàn toàn thì chạy `login` lại.

Cách khác (không khuyến nghị): đặt `VWORK_USERNAME`/`VWORK_PASSWORD` trong env của
MCP client — server tự đăng nhập. Password sẽ nằm trong config client.

`npm run auth:check` vẫn dùng để xem tài khoản + cấu trúc doc thật.

## Cấu hình client

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`
hoặc `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "vwork": {
      "command": "node",
      "args": ["/home/faris/code/My_Workspace/v-work/dist/cli.js"]
    }
  }
}
```

**Cursor / VS Code** (`.cursor/mcp.json` hoặc `.vscode/mcp.json`): cùng cấu trúc trên.

**Claude Code**:

```bash
claude mcp add vwork -- node /home/faris/code/My_Workspace/v-work/dist/cli.js
/mcp     # xem server đã kết nối + danh sách tool
```

Lưu ý: `/mcp` trong Claude và `opencode mcp auth` chỉ có flow OAuth cho server **remote
HTTP**. Server stdio (như server này) không có flow đó — auth nằm ở CLI `login` + token file.

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
| `vwork_update_task` | cập nhật status/note của task (cần `VWORK_ALLOW_WRITE=true`) |
| `vwork_api` | gọi API bất kỳ trong allowlist (GET luôn được; ghi phải bật) |

Câu hỏi mẫu:

- "Tuần này tôi có task nào quá hạn?"
- "Tổng hợp tiến độ dự án eoffice, ai đang nhiều việc nhất?"
- "Ticket nào đang mở cho khách hàng X?"
- "Có thông báo chưa đọc nào không?"

## An toàn

- Mặc định **chỉ đọc**: `VWORK_ALLOW_WRITE=false`. Bật `true` mới cho PATCH/POST/PUT/DELETE.
- Ghi chỉ mở cho `/project-tracker`, `/tickets`, `/notification`; `/auth/*` và `/permissions/*` luôn bị chặn.
- Token lưu tại `~/.config/v-work/tokens.json` (chmod 600), tự refresh và xoay vòng.
- Password chỉ nằm trong env của MCP client — không commit, không log.
- Cache GET 30s để tránh spam API khi AI hỏi liên tiếp.

## Phát triển

```bash
npm test        # mock toàn bộ HTTP, không gọi mạng
npm run build
npm run dev     # tsx, dùng khi debug
```

CLI:

```bash
node dist/cli.js            # chạy server (mặc định)
node dist/cli.js login      # đăng nhập, lưu token
node dist/cli.js status     # kiểm tra token
node dist/cli.js whoami     # in tài khoản hiện tại
node dist/cli.js logout     # xoá token
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
    register.ts    # đăng ký 11 tool
  server.ts        # entrypoint stdio
```
