# NKUST Wi-Fi 自動登入助手

一個專為高雄科技大學（NKUST）校園 Wi-Fi 設計的自動登入桌面應用程式。

## 功能特點

- 自動偵測 NKUST Wi-Fi 網路
- 自動登入校園 Wi-Fi
- 系統托盤常駐，後台運行
- 安全的本地憑證儲存
- 手動登入功能
- 跨平台支援（Windows、macOS、Linux）

## 安裝與使用

### 開發模式

```bash
# 安裝依賴
pnpm install

# 運行開發模式
pnpm dev
```

### 構建應用程式

```bash
# 構建應用程式
pnpm build

# 運行構建後的應用
pnpm preview
```

## 使用說明

1. 首次使用時，請點擊托盤圖示選擇「開啟主視窗」
2. 在主視窗中輸入您的學號和密碼
3. 點擊「儲存設定」
4. 當連接到 NKUST Wi-Fi 時，應用程式會自動登入
5. 您也可以隨時點擊「手動登入」按鈕進行登入

## 技術架構

- **前端**: React 19 + TypeScript + Tailwind CSS
- **後端**: Electron 39
- **構建工具**: Vite 7
- **狀態管理**: React Hooks
- **資料儲存**: electron-store

## 專案結構

```
nkust-wifi-connect/
├── src/                # React 前端程式碼
│   ├── App.tsx        # 主應用程式元件
│   └── main.tsx       # React 入口點
├── electron/          # Electron 主程序程式碼
│   ├── main.ts        # Electron 主程序
│   ├── preload.ts     # IPC 橋接
│   ├── nkustAuth.ts   # NKUST 認證邏輯
│   ├── wifi.ts        # Wi-Fi SSID 偵測
│   └── store.ts       # 憑證儲存管理
├── assets/            # 應用程式資源
│   └── tray-icon.png  # 托盤圖示
└── scripts/           # 建置腳本
    └── generate-icons.js
```

## 安全性說明

- 憑證以加密方式儲存在本地
- 不會將憑證傳送到任何第三方伺服器
- 僅在偵測到 NKUST Wi-Fi 時執行登入

## 授權

本專案僅供學習和個人使用。

## 開發者

使用 Claude Code 協助開發