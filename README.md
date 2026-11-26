<a id="readme-top"></a>

[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]

<br />
<div align="center">
<h3 align="center">v-work</h3>

  <p align="center">
    MCP server cho VNFITE Work — để AI đọc tiến độ dự án, ticket, thông báo và tài liệu nội bộ bằng tài khoản của bạn.
    <br />
    <a href="https://github.com/enles004/v-work"><strong>Xem mã nguồn »</strong></a>
    <br />
    <br />
    <a href="https://github.com/enles004/v-work/issues/new?labels=bug">Báo lỗi</a>
    &middot;
    <a href="https://github.com/enles004/v-work/issues/new?labels=enhancement">Đề xuất tính năng</a>
  </p>
</div>

<details>
  <summary>Mục lục</summary>
  <ol>
    <li>
      <a href="#giới-thiệu">Giới thiệu</a>
      <ul>
        <li><a href="#công-nghệ">Công nghệ</a></li>
      </ul>
    </li>
    <li>
      <a href="#bắt-đầu">Bắt đầu</a>
      <ul>
        <li><a href="#yêu-cầu">Yêu cầu</a></li>
        <li><a href="#cài-đặt">Cài đặt</a></li>
      </ul>
    </li>
    <li><a href="#sử-dụng">Sử dụng</a></li>
    <li><a href="#đóng-góp">Đóng góp</a></li>
    <li><a href="#giấy-phép">Giấy phép</a></li>
    <li><a href="#liên-hệ">Liên hệ</a></li>
  </ol>
</details>

## Giới thiệu

**v-work** là một MCP (Model Context Protocol) server cho **VNFITE Work**. Nó cho phép các trợ lý AI như Claude đọc dữ liệu vWork và trả lời những câu hỏi như:

- "Tuần này tôi có task nào quá hạn?"
- "Tổng hợp tiến độ dự án, ai đang nhiều việc nhất?"
- "Tài liệu phòng ban Công Nghệ có gì mới?"
- "Ticket nào đang mở cho khách hàng X?"

Tính năng chính:

- Tiến độ dự án: task của bạn, tìm kiếm, tổng hợp, quá hạn / sắp đến hạn.
- Ticket hỗ trợ và thông báo chưa đọc.
- Ổ file nội bộ: duyệt phòng ban, thư mục và tải file về máy.
- Gọi được các API còn lại của vWork qua một tool chung.
- Mặc định **chỉ đọc**; muốn ghi phải bật rõ ràng.

Chạy local qua stdio, không mở port, không gửi dữ liệu đi đâu ngoài `vWork.vnfite.com.vn`.

<p align="right">(<a href="#readme-top">về đầu trang</a>)</p>

### Công nghệ

* [![Node.js][Node.js]][Node-url]
* [![TypeScript][TypeScript]][TypeScript-url]
* [![MCP][MCP]][MCP-url]

<p align="right">(<a href="#readme-top">về đầu trang</a>)</p>

## Bắt đầu

### Yêu cầu

* Node.js 20 trở lên, kèm npm
* Tài khoản VNFITE Work

### Cài đặt

Không cần clone hay build thủ công.

1. Đăng nhập một lần (hỏi username / password, password được ẩn)
   ```sh
   npx -y github:enles004/v-work auth
   ```
2. Thêm vào MCP client (Claude Desktop, Cursor, VS Code…)
   ```json
   {
     "mcpServers": {
       "vwork": {
         "command": "npx",
         "args": ["-y", "github:enles004/v-work"]
       }
     }
   }
   ```
   Với Claude Code:
   ```sh
   claude mcp add vwork -- npx -y github:enles004/v-work
   ```
3. Kết nối lại MCP (gõ `/mcp` trong Claude) để thấy danh sách tool.

Nếu muốn gõ `vwork` trực tiếp, cài global:

```sh
npm i -g https://github.com/enles004/v-work/archive/refs/heads/master.tar.gz
vwork auth
```

Khi đó cấu hình MCP là `{ "command": "vwork" }`.

Token lưu `chmod 600` tại `~/.config/vwork-mcp/tokens.json` (Linux), `~/Library/Application Support/vwork-mcp/tokens.json` (macOS) hoặc `%APPDATA%\vwork-mcp\tokens.json` (Windows), tự làm mới khi hết hạn.

<p align="right">(<a href="#readme-top">về đầu trang</a>)</p>

## Sử dụng

### Tool cho AI

| Tool | Việc |
|---|---|
| `vwork_me` | tài khoản + quyền hiện tại |
| `vwork_my_tasks` | task được giao cho chính bạn |
| `vwork_project_overview` | ảnh chụp nhanh: tiến độ, ticket, thông báo chưa đọc |
| `vwork_tracker_docs` | danh sách doc trong bảng tiến độ |
| `vwork_tracker_search` | tìm theo từ khoá / trạng thái / người phụ trách / quá hạn |
| `vwork_tracker_summary` | đếm theo trạng thái, người phụ trách, quá hạn, sắp đến hạn |
| `vwork_tickets`, `vwork_ticket` | danh sách và chi tiết ticket |
| `vwork_notifications` | thông báo chưa đọc + mới nhất |
| `vwork_update_task` | cập nhật status / note của task (cần bật ghi) |
| `vwork_file_departments`, `vwork_dept_files`, `vwork_dept_tree` | ổ file nội bộ theo phòng ban |
| `vwork_file_download` | tải file về `~/Downloads/vwork` (tối đa 50MB) |
| `vwork_api` | gọi API bất kỳ trong allowlist |

### Dòng lệnh

Cùng một chương trình dùng được như CLI (`vwork` hoặc `npx -y github:enles004/v-work`):

```sh
vwork auth status              # kiểm tra đăng nhập
vwork tasks --mine --todo      # task của tôi chưa xong
vwork tasks --overdue          # task quá hạn
vwork summary                  # tổng hợp tiến độ
vwork tickets --limit 10       # ticket
vwork notifications            # thông báo
vwork api GET /tickets --query "status=open,limit=3"
```

Thêm `--json` để in JSON thô, `vwork <lệnh> --help` để xem chi tiết.

### Cấu hình và quyền ghi

Mặc định đã dùng được ngay (prod, project `eoffice`, chỉ đọc). Chỉ khi cần đổi mới đặt biến môi trường trong cấu hình MCP client:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `VWORK_BASE_URL` | `https://vWork.vnfite.com.vn` | địa chỉ API |
| `VWORK_PROJECT` | `eoffice` | project |
| `VWORK_ALLOW_WRITE` | `false` | `true` để cho phép sửa task / gọi API ghi |

Quyền ghi chỉ mở cho `/project-tracker`, `/tickets`, `/notification`; `/auth/*` và `/permissions/*` luôn bị chặn.

### Cập nhật

Chạy `vwork upgrade` (bản global) hoặc `npx -y --prefer-online github:enles004/v-work`, rồi kết nối lại MCP.

<p align="right">(<a href="#readme-top">về đầu trang</a>)</p>

## Đóng góp

Mọi đóng góp đều được hoan nghênh.

1. Fork dự án
2. Tạo nhánh tính năng (`git checkout -b feature/TenTinhNang`)
3. Commit thay đổi (`git commit -m 'Thêm TenTinhNang'`)
4. Push lên nhánh (`git push origin feature/TenTinhNang`)
5. Mở Pull Request

Chạy `npm install` rồi `npm test` (mock toàn bộ HTTP, không gọi mạng) trước khi gửi.

<p align="right">(<a href="#readme-top">về đầu trang</a>)</p>

## Giấy phép

Phát hành theo giấy phép MIT. Xem `LICENSE` để biết thêm.

<p align="right">(<a href="#readme-top">về đầu trang</a>)</p>

## Liên hệ

Project: [https://github.com/enles004/v-work](https://github.com/enles004/v-work)

<p align="right">(<a href="#readme-top">về đầu trang</a>)</p>

[stars-shield]: https://img.shields.io/github/stars/enles004/v-work.svg?style=for-the-badge
[stars-url]: https://github.com/enles004/v-work/stargazers
[issues-shield]: https://img.shields.io/github/issues/enles004/v-work.svg?style=for-the-badge
[issues-url]: https://github.com/enles004/v-work/issues
[license-shield]: https://img.shields.io/github/license/enles004/v-work.svg?style=for-the-badge
[license-url]: https://github.com/enles004/v-work/blob/master/LICENSE
[Node.js]: https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white
[Node-url]: https://nodejs.org/
[TypeScript]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[MCP]: https://img.shields.io/badge/MCP-000000?style=for-the-badge&logo=modelcontextprotocol&logoColor=white
[MCP-url]: https://modelcontextprotocol.io/
