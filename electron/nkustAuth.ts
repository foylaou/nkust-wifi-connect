// electron/nkustAuth.ts
import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * 登入 NKUST 校園 Wi-Fi
 * @param username 學號
 * @param password 密碼
 * @returns 登入結果字串
 */
export async function loginNKUST(username: string, password: string): Promise<string> {
    try {
        // 確保用戶名是完整的電子郵件格式
        const fullUsername = username.includes("@") ? username : `${username}@nkust.edu.tw`;
        console.log("[NKUST] username =", fullUsername);

        // 使用 curl 一次性完成整個登入流程（獲取 magic + 登入）
        // 使用 bash 腳本來確保在同一個會話中完成
        const loginScript = `
            # 獲取 magic 值
            MAGIC=$(curl -s http://www.google.com | grep -oE 'fgtauth\\?[0-9a-f]+' | cut -d'?' -f2)

            if [ -z "$MAGIC" ]; then
                echo "STATUS:ALREADY_CONNECTED"
                exit 0
            fi

            echo "MAGIC:$MAGIC" >&2

            # 使用獲取到的 magic 立即登入
            # 重要：POST 到根路徑 /，而不是 /fgtauth?magic
            LOGIN_URL="http://172.16.62.1:1000/"
            echo "\\nLOGIN_URL: $LOGIN_URL" >&2
            echo "POST_DATA: username=${fullUsername}&password=***&magic=$MAGIC&4Tredir=http://www.google.com/" >&2

            # 輸出完整的 curl 命令供調試
            echo "\\nFULL_CURL_COMMAND:" >&2
            echo "curl -i -X POST \\"$LOGIN_URL\\" \\\\" >&2
            echo "  -d \\"username=${fullUsername}\\" \\\\" >&2
            echo "  -d \\"password=${password}\\" \\\\" >&2
            echo "  -d \\"magic=$MAGIC\\" \\\\" >&2
            echo "  -d \\"4Tredir=http://www.google.com/\\"" >&2

            echo "\\nSENDING_LOGIN_REQUEST" >&2

            # 使用完整路徑的 curl，避免 PATH 問題
            CURL_PATH=$(which curl)
            echo "Using curl at: $CURL_PATH" >&2

            # 簡化 curl 命令，匹配用戶成功的手動執行
            # 使用 -i 顯示響應頭，-w 獲取狀態碼
            LOGIN_RESP=$("$CURL_PATH" -i -w "\\nHTTP_CODE:%{http_code}" \\
                -X POST "$LOGIN_URL" \\
                -d "username=${fullUsername}" \\
                -d "password=${password}" \\
                -d "magic=$MAGIC" \\
                -d "4Tredir=http://www.google.com/" 2>&1)

            CURL_EXIT_CODE=$?

            echo "\\nCURL_EXIT_CODE: $CURL_EXIT_CODE" >&2
            echo "\\nLOGIN_RESPONSE_FULL:" >&2
            echo "$LOGIN_RESP" | head -30 >&2

            # 檢查 HTTP 狀態碼
            if echo "$LOGIN_RESP" | grep -qE "HTTP_CODE:(302|303)"; then
                echo "\\nLOGIN_SUCCESS_BY_HTTP_CODE" >&2

                # 等待 1 秒並驗證網路連線
                sleep 1
                if curl -s --max-time 3 http://www.google.com | grep -qi "<!doctype html"; then
                    echo "\\nINTERNET_OK" >&2
                    exit 0
                fi
            fi

            # 如果 HTTP 狀態碼不是 302/303，多次檢查網路（可能認證系統較慢）
            echo "\\nHTTP_CODE_NOT_302_OR_303_CHECKING_INTERNET_ANYWAY" >&2
            for i in 1 2 3; do
                echo "Checking attempt $i..." >&2
                sleep 1

                if curl -s --max-time 3 http://www.google.com | grep -qi "<!doctype html"; then
                    echo "\\nINTERNET_OK" >&2
                    exit 0
                fi
            done

            # 登入失敗
            echo "\\nINTERNET_FAIL" >&2
        `;

        console.log("[NKUST] Executing login script");
        const { stdout, stderr } = await execAsync(loginScript, {
            timeout: 15000,
            shell: '/bin/bash'
        });

        console.log("[NKUST] Script stderr:", stderr);
        console.log("[NKUST] Script stdout:", stdout.substring(0, 300));

        // 檢查是否已連線網際網路
        if (stdout.includes("STATUS:ALREADY_CONNECTED")) {
            return "已連線網際網路，無需登入。";
        }

        // 最重要的檢查：登入後是否能訪問外網
        if (stderr.includes("INTERNET_OK")) {
            console.log("[NKUST] Internet access confirmed - Login successful!");
            return "登入成功 ✅";
        }

        if (stderr.includes("INTERNET_FAIL")) {
            console.log("[NKUST] No internet access after login attempt");
            // 繼續檢查 HTTP 狀態碼
        }

        // 解析 HTTP 響應
        const match = stdout.match(/HTTP_CODE:(\d+)/);
        const statusCode = match ? parseInt(match[1]) : 0;
        const body = stdout.replace(/HTTP_CODE:\d+/, '').trim();

        console.log("[NKUST] Login response status:", statusCode);

        const loginResp = { status: statusCode, headers: {}, body };

        // 登入成功的標誌：返回 302/303 重定向
        if ([302, 303].includes(loginResp.status)) {
            // Step 3. 驗證網路是否開通
            const test = await axios.get("http://neverssl.com", { timeout: 3000, validateStatus: () => true });
            if (test.status === 200) return "登入成功 ✅";
            return "登入成功，但 DNS 尚未刷新 ⚠️";
        }

        // 檢查其他可能的成功狀態
        if (loginResp.status === 200) {
            // 有時候服務器會返回 200，檢查內容
            const bodyText = loginResp.body.toLowerCase();
            if (bodyText.includes("success") || bodyText.includes("成功")) {
                return "登入成功 ✅";
            }
        }

        return `登入失敗 (HTTP ${loginResp.status})`;
    } catch (err) {
        const error = err as Error;
        const errorMsg = error?.message || String(err);
        console.error("[NKUST] Login error:", err);
        if (errorMsg.includes("socket hang up")) {
            return "無法連線到校園網伺服器 (請確認已連接 NKUST Wi-Fi)";
        }
        if (errorMsg.includes("timeout")) {
            return "連線逾時 (請確認已連接 NKUST Wi-Fi)";
        }
        if (errorMsg.includes("ECONNREFUSED")) {
            return "校園網伺服器拒絕連線";
        }
        return "登入過程發生錯誤：" + errorMsg;
    }
}
