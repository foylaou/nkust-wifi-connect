# GitHub Actions 自動打包說明

此專案使用 GitHub Actions 自動打包跨平台的 Electron 應用程式。

## 觸發方式

### 1. 自動觸發（推薦）

當你推送一個以 `v` 開頭的 tag 時，會自動觸發打包並創建 GitHub Release：

```bash
# 創建 tag
git tag v1.0.0

# 推送 tag 到 GitHub
git push origin v1.0.0
```

### 2. 手動觸發

在 GitHub 網頁上：
1. 進入 **Actions** 頁面
2. 選擇 **Build and Release** workflow
3. 點擊 **Run workflow** 按鈕
4. 選擇分支並運行

## 打包產物

每個平台會產生以下檔案：

### macOS
- `nkust-wifi-connect-{version}-arm64.dmg` - Apple Silicon (M1/M2/M3) 安裝檔
- `nkust-wifi-connect-{version}-x64.dmg` - Intel Mac 安裝檔
- `nkust-wifi-connect-{version}-arm64-mac.zip` - Apple Silicon 壓縮檔
- `nkust-wifi-connect-{version}-x64-mac.zip` - Intel Mac 壓縮檔

### Windows
- `nkust-wifi-connect Setup {version}-x64.exe` - Windows x64 安裝程式
- `nkust-wifi-connect Setup {version}-arm64.exe` - Windows ARM64 安裝程式
- `nkust-wifi-connect-{version}-win-x64.zip` - Windows x64 壓縮檔
- `nkust-wifi-connect-{version}-win-arm64.zip` - Windows ARM64 壓縮檔

### Linux
- `nkust-wifi-connect-{version}-x64.AppImage` - Linux x64 AppImage
- `nkust-wifi-connect-{version}-arm64.AppImage` - Linux ARM64 AppImage
- `nkust-wifi-connect_{version}_amd64.deb` - Debian/Ubuntu x64 安裝包
- `nkust-wifi-connect_{version}_arm64.deb` - Debian/Ubuntu ARM64 安裝包

## Workflow 架構

```
build.yml
├── build job (3 個平行任務)
│   ├── macOS (x64 + arm64)
│   ├── Windows (x64 + arm64)
│   └── Linux (x64 + arm64)
└── release job
    └── 創建 GitHub Release (僅在推送 tag 時執行)
```

## 本地測試打包

在推送到 GitHub 之前，可以在本地測試打包：

```bash
# 打包所有平台（僅在對應的 OS 上有效）
pnpm run build

# 或者單獨打包特定平台
pnpm electron-builder --mac --x64 --arm64
pnpm electron-builder --win --x64 --arm64
pnpm electron-builder --linux --x64 --arm64
```

## 注意事項

1. **macOS 簽名**：如果需要簽名，需要在 GitHub Secrets 中設置：
   - `CSC_LINK`：證書文件（base64 編碼）
   - `CSC_KEY_PASSWORD`：證書密碼

2. **Windows 簽名**：需要在 GitHub Secrets 中設置：
   - `CSC_LINK`：證書文件（base64 編碼）
   - `CSC_KEY_PASSWORD`：證書密碼

3. **跨平台限制**：
   - macOS 只能在 macOS runner 上打包
   - Windows 只能在 Windows runner 上打包
   - Linux 可以在任何 runner 上打包

4. **ARM64 支持**：
   - macOS ARM64：完全支持
   - Windows ARM64：實驗性支持
   - Linux ARM64：需要 QEMU 模擬器（已在 workflow 中配置）

## 疑難排解

### 問題：打包失敗
- 檢查 `package.json` 中的 `build` 配置是否正確
- 確保所有依賴都已正確安裝
- 查看 Actions 日誌中的具體錯誤訊息

### 問題：Release 沒有創建
- 確保推送了以 `v` 開頭的 tag
- 檢查 GitHub repository 的 Actions 權限設置
- 確保 `GITHUB_TOKEN` 有足夠的權限

### 問題：某個平台的打包失敗但不影響其他平台
- 使用了 `fail-fast: false`，所以某個平台失敗不會影響其他平台
- 可以查看失敗的 job 日誌來修復問題