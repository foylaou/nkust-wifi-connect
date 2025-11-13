// electron/main.ts
import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { getCurrentSSID } from "./wifi";
import { loginNKUST } from "./nkustAuth";
import { getCredentials, setCredentials, hasCredentials } from "./store";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 禁用沙盒模式以允許執行系統命令
app.commandLine.appendSwitch('no-sandbox');

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let currentWifiStatus = "檢測中...";
let currentLoginStatus = "-";

const createMainWindow = () => {
    const preloadPath = path.join(__dirname, "preload.cjs");

    mainWindow = new BrowserWindow({
        width: 480,
        height: 600,
        show: false,
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false, // 禁用沙盒以允許主進程執行系統命令
        },
    });

    // 當窗口關閉時，清除引用
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (devUrl) {
        void mainWindow.loadURL(devUrl);
        // 開發模式下自動顯示窗口
        mainWindow.show();
        mainWindow.webContents.openDevTools();
    } else {
        // 使用相對路徑，electron 會自動處理 asar 路徑
        void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        if (!hasCredentials()) {
            mainWindow.show()
        }
    }
};

app.whenReady().then(() => {
    // 使用相對路徑，electron 會自動處理 asar 路徑
    const iconPath = path.join(__dirname, "../assets/tray-icon.png");
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon);
    tray.setToolTip("NKUST Wi-Fi 登入小幫手");

    // 建立更新 tray menu 的函數
    const updateTrayMenu = () => {
        if (!tray || tray.isDestroyed()) return;
        const contextMenu = Menu.buildFromTemplate([
            { label: `Wi-Fi 狀態：${currentWifiStatus}` },
            { label: `登入狀態：${currentLoginStatus}` },
            { type: "separator" },
            {
                label: "開啟主視窗",
                click: () => {
                    if (!mainWindow || mainWindow.isDestroyed()) {
                        createMainWindow();
                    } else {
                        mainWindow.show();
                    }
                }
            },
            { label: "退出", click: () => app.quit() },
        ]);
        tray.setContextMenu(contextMenu);
    };

    updateTrayMenu();
    createMainWindow();

    // 定時檢測 SSID 與登入狀態
    async function checkWifi() {
        try {
            console.log("開始檢測 Wi-Fi...");
            const ssid = await getCurrentSSID();
            console.log("檢測到 SSID:", ssid);

            if (!tray || tray.isDestroyed()) {
                console.log("tray 不存在或已銷毀");
                return;
            }

            // 更新狀態變數
            currentWifiStatus = ssid || "(未連線)";

            if (ssid === "NKUST" && hasCredentials()) {
                const { studentId, password } = getCredentials();
                currentLoginStatus = "偵測到 NKUST，正在登入...";
                updateTrayMenu();

                const result = await loginNKUST(studentId, password);
                currentLoginStatus = result;
            } else if (ssid === "NKUST") {
                currentLoginStatus = "未設定帳號密碼";
            } else {
                currentLoginStatus = "非 NKUST";
            }

            // 重新建立並更新 menu
            updateTrayMenu();

            // 更新 React UI
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("wifi-status", { ssid, result: currentLoginStatus });
            }
        } catch (error) {
            console.error("checkWifi error:", error);
            // 更新錯誤狀態
            currentWifiStatus = "檢測失敗";
            currentLoginStatus = "-";
            updateTrayMenu();
        }
    }

    void checkWifi();
    setInterval(checkWifi, 15000);
});

// IPC 給 React 手動觸發登入
ipcMain.handle("manual-login", async () => {
    if (!hasCredentials()) {
        return "請先設定學號和密碼";
    }
    const { studentId, password } = getCredentials();
    return await loginNKUST(studentId, password);
});

// IPC 給 React 儲存憑證
ipcMain.handle("save-credentials", async (_event, studentId: string, password: string) => {
    setCredentials(studentId, password);
    return "憑證已儲存";
});

// IPC 給 React 取得憑證狀態
ipcMain.handle("get-credentials", async () => {
    return getCredentials();
});

app.on("window-all-closed", () => {
    // 不退出應用，保持在系統托盤
});
