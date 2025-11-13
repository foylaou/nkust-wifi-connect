// electron/wifi.ts
import { exec } from "child_process";
import { exec as sudoExec } from "sudo-prompt";
import os from 'node:os';

// --- 輔助函式 1: 執行 zsh 指令來取得 SSID ---
function getSsidWithIpconfig(): Promise<string | null> {
// 在 ${...} 前面加上反斜線 \
    const command = `for i in \${(o)$(ifconfig -lX "en[0-9]")};do ipconfig getsummary \${i} | awk '/ SSID/ {print $NF}';done 2> /dev/null`;

    return new Promise((resolve) => {
        exec(command, { shell: '/bin/zsh' }, (err, stdout) => {
            if (err) {
                console.error("ipconfig exec failed:", err.message);
                return resolve(null);
            }
            const ssid = stdout.trim();
            // 如果 ssid 是空的，也回傳 null
            resolve(ssid || null);
        });
    });
}

// --- 輔助函式 2: 執行 sudo-prompt 來設定 verbose ---
function runVerboseSudo(): Promise<void> {
    const options = {
        // 🚨 關鍵：請將 'Your Electron App Name' 換成您 App 的真正名稱
        // 這會顯示在密碼提示窗上，例如："nkust-wifi-connect" 正要求管理員權限
        name: 'nkust-wifi-connect'
    };
    const command = 'ipconfig setverbose 1';

    return new Promise((resolve, reject) => {
        sudoExec(command, options, (error, _stdout, stderr) => {
            if (error) {
                // 使用者取消了提示，或密碼錯誤
                return reject(new Error("User cancelled or password incorrect."));
            }
            if (stderr) {
                console.warn("sudo ipconfig stderr:", stderr);
            }
            // sudo 指令執行成功
            resolve();
        });
    });
}

// --- 輔助函式 3: 取得 Windows SSID ---
function getWindowsSSID(): Promise<string | null> {
    return new Promise((resolve) => {
        exec("netsh wlan show interfaces", { windowsHide: true }, (err, stdout) => {
            if (err || !stdout) return resolve(null);
            const match = stdout.match(/^\s*SSID\s*[:\uFF1A]\s*(.+)$/m);
            resolve(match ? match[1].trim() : null);
        });
    });
}

// --- 輔助函式 4: 取得 Linux SSID ---
function getLinuxSSID(): Promise<string | null> {
    return new Promise((resolve) => {
        exec("nmcli -t -f active,ssid dev wifi | egrep '^yes' | cut -d: -f2", (err, stdout) => {
            if (err || !stdout) return resolve(null);
            const ssid = stdout.trim().split("\n")[0];
            resolve(ssid || null);
        });
    });
}


/**
 * 取得目前連線中的 Wi-Fi SSID
 * @returns Promise<string | null>
 */
export async function getCurrentSSID(): Promise<string | null> {
    const platform = os.platform();

    switch (platform) {
        case "darwin": {
            // macOS
            // 1. 第一次嘗試 (不使用 sudo)
            let ssid = await getSsidWithIpconfig();
            if (ssid) {
                return ssid; // 成功！
            }

            // 2. 第一次嘗試失敗，觸發 sudo-prompt
            console.warn("Could not get SSID. Prompting for admin to run `ipconfig setverbose 1`...");

            try {
                // 這會跳出系統密碼視窗
                await runVerboseSudo();

                // 3. Sudo 成功後，第二次嘗試
                console.log("sudo-prompt success. Retrying to get SSID...");
                ssid = await getSsidWithIpconfig();
                return ssid; // 無論是 null 還是 SSID，都回傳

            } catch (err :unknown) {
                // 使用者點了「取消」或密碼錯誤
                console.error("sudo-prompt failed:", err);
                return null;
            }
        }

        case "win32":
            // Windows
            return getWindowsSSID();

        case "linux":
            // Linux
            return getLinuxSSID();

        default:
            // 其他系統
            return null;
    }
}

