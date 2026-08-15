# Eye Care Focus AI

Ứng dụng desktop hỗ trợ chăm sóc mắt, quản lý tập trung và các tính năng AI liên quan. Project được phát triển bằng `React + Vite + TypeScript + Electron`.

## Yêu cầu môi trường

- `Node.js` 20 trở lên
- `npm` 10 trở lên
- Windows để build ra file `.exe`

Kiểm tra phiên bản:

```bash
node -v
npm -v
```

## Cài đặt project

Clone source code:

```bash
git clone <YOUR_GITHUB_REPO_URL>
cd PomoDojo
```

Cài dependencies để tạo thư mục `node_modules`:

```bash
npm install
```

Sau khi chạy xong, project sẽ có thư mục:

```text
node_modules/
```

Lưu ý:

- Không cần upload `node_modules` lên GitHub
- Chỉ cần có `package.json` và `package-lock.json`, người khác chạy `npm install` là tạo lại được

## Chạy project ở chế độ phát triển

Chạy bản web:

```bash
npm run dev
```

Chạy bản desktop bằng Electron:

```bash
npm run dev:desktop
```

## Build project

Build frontend và Electron:

```bash
npm run build
```

Sau khi build xong sẽ có các thư mục:

```text
dist/
dist-electron/
```

## Tạo file release

Đây là bước quan trọng nhất để tạo sản phẩm desktop có thể gửi cho người khác dùng.

Chạy:

```bash
npm run dist
```

Sau khi hoàn tất, project sẽ sinh ra thư mục:

```text
release/
```

Trong đó thường có:

- `win-unpacked/`: bản app đã unpack để test nhanh
- `*.exe`: file cài đặt Windows
- `*portable.exe`: bản chạy luôn không cần cài
- `*.zip`: bản nén của ứng dụng

## File nên dùng để demo hoặc gửi cho người khác

Nếu muốn người khác cài app như bình thường:

- gửi file `Setup.exe`

Nếu muốn chạy luôn không cần cài:

- gửi file `portable.exe`

Nếu muốn test nhanh sau khi build:

- chạy file `.exe` bên trong `release/win-unpacked/`

## Cấu trúc thư mục chính

```text
PomoDojo/
├─ electron/
│  ├─ main.js
│  └─ preload.js
├─ src/
├─ dist/
├─ dist-electron/
├─ release/
├─ package.json
├─ package-lock.json
└─ vite.config.js
```

## Một số lệnh hữu ích

Xóa file build cũ:

```bash
npm run clean
```

Cài lại dependencies:

```bash
npm install
```

Build lại bản desktop:

```bash
npm run dist
```

## Lưu ý khi upload lên GitHub

Nên đưa các file sau lên Git:

- source code trong `src/`
- thư mục `electron/`
- `package.json`
- `package-lock.json`
- `vite.config.js`
- `README.md`

Không nên đưa lên Git:

- `node_modules/`
- `dist/`
- `dist-electron/`
- `release/`
- `.env`

Ví dụ `.gitignore`:

```gitignore
node_modules
dist
dist-electron
release
.env
```

## Quy trình nhanh nhất để người khác chạy project

```bash
git clone <YOUR_GITHUB_REPO_URL>
cd PomoDojo
npm install
npm run dist
```

Sau đó mở thư mục `release/` để lấy file `.exe`.
