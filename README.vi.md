# FB Active Status

[English](README.md) | Tiếng Việt

![Popup FB Active Status bằng tiếng Việt](docs/images/popup-vi.png)

Extension Chrome (Manifest V3) làm Facebook và Messenger hiện "Hoạt động 41 phút trước" thay cho "Đang hoạt động", vẫn giữ dòng thời gian hoạt động gần nhất.

## Sao không tắt Trạng thái hoạt động của Facebook?

Nút tắt Trạng thái hoạt động của Facebook ẩn luôn dòng "Hoạt động 41 phút trước". Extension này chặn ba endpoint WebSocket mang dữ liệu presence, nên Facebook lùi về dòng thời gian hoạt động gần nhất và vẫn hiện dòng đó.

## Minh họa

Trước khi dùng, trạng thái hiển thị "Đang hoạt động".

![Trạng thái Đang hoạt động trước khi dùng extension](docs/images/dang-hoat-dong.png)

Sau khi dùng, trạng thái hiển thị thời gian hoạt động gần đây.

![Trạng thái Hoạt động 41 phút trước sau khi dùng extension](docs/images/hoat-dong-truoc-do.png)

## Cài đặt

1. Tải [file ZIP của extension](https://github.com/wakupparalyzed/FB-Active-Status/releases/download/v1.0.0/fb-active-status-v1.0.0.zip) và giải nén ra một thư mục.
2. Mở `chrome://extensions` trong Chrome.
3. Bật Developer mode, rồi chọn Load unpacked.
4. Chọn thư mục đã giải nén có chứa `manifest.json`, không chọn file ZIP.
5. Mở một tab Facebook hoặc Messenger rồi tải lại tab đó. Tab đã mở trước khi bật chặn vẫn giữ hành vi cũ.

## Dành cho developer

Cài Node.js 20 trở lên, rồi build từ mã nguồn:

```powershell
npm install
npm run build
```

Bản build nằm trong `dist/`, nạp thư mục này bằng Load unpacked khi phát triển. Dùng `npm run typecheck` để kiểm tra TypeScript mà không tạo output.

## Cấu trúc chính

- `src/`: mã TypeScript và CSS nguồn.
- `public/`: manifest, popup, rules và asset cục bộ. Build sinh lại `popup.css` và `fonts/`, không chỉnh tay vào hai thư mục này.
- `dist/`: extension sau khi build, không chỉnh trực tiếp.
- `release/`: file ZIP mà `publish-release.ps1` đẩy lên GitHub Releases.

## Extension làm gì

- Chặn các endpoint WebSocket realtime `gateway.facebook.com/ws/realtime`, `gateway.facebook.com/ws/streamcontroller` và `mqtt-mini.facebook.com`. Luật chặn nằm trong `public/rules/facebook-realtime.json`.
- Bật hoặc tắt chặn ngay trong popup.
- Tải lại các tab Facebook và Messenger đang mở.
- Chuyển ngôn ngữ popup giữa VI và EN.
- Theo theme hệ thống, hoặc ép theme sáng/tối.

## Ảnh hưởng đã biết

Ba endpoint bị chặn còn mang dữ liệu khác, nên Facebook và Messenger có thể hoạt động khác đi. Hãy thử trên tài khoản của bạn trước khi dùng lâu dài. Extension cài tay chạy ở developer mode, nên Chrome hiện cảnh báo cho extension này.

## Giấy phép

[MIT](LICENSE) © wakupparalyzed
