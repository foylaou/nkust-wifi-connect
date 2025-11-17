<div align="center">

# 🌐 NKUST Wi-Fi 自動登入小幫手

**一個專為高雄科技大學（NKUST）校園 Wi-Fi 設計的自動登入桌面應用程式**

[![License](https://img.shields.io/badge/license-Personal%20Use-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/foylaou/nkust-wifi-connect/releases)
[![Electron](https://img.shields.io/badge/Electron-39-47848F.svg?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev/)

</div>

---

## 📸 應用程式截圖

<div align="center">
<img width="160" height="176" alt="托盤圖示" src="https://github.com/user-attachments/assets/3fef3333-674b-4577-874f-5b339113bdb4" />
<img width="213" height="266" alt="主視窗" src="https://github.com/user-attachments/assets/9a9df824-e110-43b7-a934-95527d21e869" />
<img width="480" height="837" alt="登入介面" src="https://github.com/user-attachments/assets/ac678d10-1e81-46ce-a290-ccd0d8989e33" />
</div>

---

## ✨ 功能特點

- 🔍 **自動偵測** - 智慧偵測 NKUST Wi-Fi 網路
- 🔐 **自動登入** - 無需手動操作,自動完成認證
- 💾 **本地儲存** - 安全的本地憑證加密儲存
- 🖥️ **系統托盤** - 常駐後台,不佔用桌面空間
- 🎯 **手動控制** - 支援手動登入功能
- 🌍 **跨平台** - 支援 Windows、macOS、Linux

---

## 📦 安裝與使用

### 下載安裝包

前往 [Releases 頁面](https://github.com/foylaou/nkust-wifi-connect/releases) 下載最新版本。

### 開發環境設定
```bash
# 1. 克隆專案
git clone https://github.com/foylaou/nkust-wifi-connect.git
cd nkust-wifi-connect

# 2. 安裝依賴
pnpm install

# 3. 運行開發模式
pnpm dev
```

### 構建應用程式
```bash
# 構建應用程式
pnpm build

# 運行構建後的應用
pnpm preview
```

---

## 📖 使用說明

1. **初次設定**
   - 點擊系統托盤圖示,選擇「開啟主視窗」
   - 輸入您的 NKUST 學號和密碼
   - 點擊「儲存設定」完成配置

2. **自動登入**
   - 連接到 NKUST Wi-Fi 時,應用程式會自動執行登入
   - 登入成功後會在托盤顯示通知

3. **手動登入**
   - 如需手動登入,可點擊托盤選單中的「手動登入」
   - 或在主視窗點擊「手動登入」按鈕

---

## 🛠️ 技術架構

| 技術層 | 使用技術 |
|--------|----------|
| **前端框架** | React 19 + TypeScript |
| **樣式方案** | Tailwind CSS |
| **桌面框架** | Electron 39 |
| **構建工具** | Vite 7 |
| **狀態管理** | React Hooks |
| **資料儲存** | electron-store |

---

## 📁 專案結構
```
nkust-wifi-connect/
├── 📂 src/                    # React 前端程式碼
│   ├── 📄 App.tsx            # 主應用程式元件
│   └── 📄 main.tsx           # React 入口點
├── 📂 electron/              # Electron 主程序程式碼
│   ├── 📄 main.ts            # Electron 主程序
│   ├── 📄 preload.ts         # IPC 橋接層
│   ├── 📄 nkustAuth.ts       # NKUST 認證邏輯
│   ├── 📄 wifi.ts            # Wi-Fi SSID 偵測
│   └── 📄 store.ts           # 憑證儲存管理
├── 📂 assets/                # 應用程式資源
│   └── 🖼️ tray-icon.png      # 托盤圖示
└── 📂 scripts/               # 建置腳本
    └── 📄 generate-icons.js  # 圖示生成工具
```

---

## 🔒 安全性說明

> 本應用程式非常重視您的隱私和安全

- ✅ 憑證以 **加密方式** 儲存在本地裝置
- ✅ **不會** 將憑證傳送到任何第三方伺服器
- ✅ 僅在偵測到 NKUST Wi-Fi 時執行登入操作
- ✅ 所有資料處理均在 **本地裝置** 完成

---

## 🤝 貢獻

歡迎提交 Issue 或 Pull Request 來改進此專案。

---

## 📄 授權

本專案僅供 **學習和個人使用**。

---

<div align="center">

**Made with ❤️ by NKUST Students**

如果這個專案對你有幫助,請給個 ⭐️ 吧!

</div>
