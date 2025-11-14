// electron/nkustAuth.ts
import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * 格式化使用者名稱為完整的電子郵件格式
 */
export function formatUsername(username: string): string {
    return username.includes("@") ? username : `${username}@nkust.edu.tw`;
}

/**
 * 生成獲取 Google 重定向頁面內容的腳本
 * 使用 -v 顯示詳細信息，-i 包含響應頭
 */
export function generateFetchGoogleScript(): string {
    return `curl -v -i http://www.google.com`;
}

/**
 * 執行獲取 Google 頁面內容
 * 注意：使用 -v -i 時，stderr 包含詳細連線信息，stdout 包含響應頭和body
 */
export async function fetchGooglePage(): Promise<{ stdout: string; stderr: string }> {
    try {
        const script = generateFetchGoogleScript();
        const result = await execAsync(script, {
            timeout: 10000,
            shell: '/bin/bash'
        });
        return result;
    } catch (err) {
        console.error("[NKUST] Fetch Google page error:", err);
        return { stdout: "", stderr: "" };
    }
}

/**
 * 從 curl -v -i 的輸出中提取響應體
 * curl -v -i 的輸出格式：
 * - stderr: 包含 verbose 信息（連線過程）
 * - stdout: 包含響應頭 + 空行 + 響應體
 *
 * @param stdout curl 的標準輸出（包含響應頭和body）
 * @returns 響應體內容
 */
export function extractResponseBody(stdout: string): string {
    if (!stdout) {
        return "";
    }

    // 找到 HTTP 響應頭結束的位置（連續兩個換行符）
    // HTTP 響應格式：
    // HTTP/1.1 200 OK
    // Header1: value1
    // Header2: value2
    //
    // <body content>

    const lines = stdout.split('\n');
    let bodyStartIndex = -1;

    // 尋找空行（響應頭結束標記）
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '' && i > 0) {
            // 確認前一行看起來像 HTTP 響應頭
            if (lines[i - 1].includes(':') || lines[i - 1].startsWith('HTTP/')) {
                bodyStartIndex = i + 1;
                break;
            }
        }
    }

    if (bodyStartIndex === -1 || bodyStartIndex >= lines.length) {
        // 如果找不到標準分隔，嘗試直接返回最後一行（可能是 HTML）
        const lastLine = lines[lines.length - 1].trim();
        if (lastLine.startsWith('<html') || lastLine.includes('fgtauth')) {
            return lastLine;
        }
        return "";
    }

    // 從 body 開始位置到結尾
    return lines.slice(bodyStartIndex).join('\n').trim();
}

/**
 * 從 HTML 內容中提取 magic 值
 * 支援多種格式：
 * 1. JavaScript redirect: window.location="http://172.16.62.1:1000/fgtauth?154a94cae96912c2"
 * 2. 直接 URL: fgtauth?154a94cae96912c2
 * 3. Meta refresh: <meta http-equiv="refresh" content="0;url=http://172.16.62.1:1000/fgtauth?xxxxx">
 *
 * @param html HTML 內容
 * @returns magic 值（十六進制字串），如果找不到返回 null
 */
export function extractMagicFromHtml(html: string): string | null {
    if (!html) {
        return null;
    }

    console.log("[NKUST] Attempting to extract magic from HTML...");
    console.log("[NKUST] HTML content:", html.substring(0, 300));

    // 方法 1: 從 JavaScript window.location 中提取
    // 格式: window.location="http://172.16.62.1:1000/fgtauth?154a94cae96912c2"
    const jsRedirectMatch = html.match(/window\.location\s*=\s*["']https?:\/\/[^"']*\/fgtauth\?([0-9a-f]+)["']/i);
    if (jsRedirectMatch && jsRedirectMatch[1]) {
        console.log("[NKUST] ✓ Extracted magic from JavaScript redirect:", jsRedirectMatch[1]);
        return jsRedirectMatch[1];
    }

    // 方法 2: 從任何 fgtauth? 後面提取
    // 格式: fgtauth?154a94cae96912c2 或 /fgtauth?154a94cae96912c2
    const fgtauthMatch = html.match(/fgtauth\?([0-9a-f]+)/i);
    if (fgtauthMatch && fgtauthMatch[1]) {
        console.log("[NKUST] ✓ Extracted magic from fgtauth pattern:", fgtauthMatch[1]);
        return fgtauthMatch[1];
    }

    // 方法 3: 從 meta refresh 中提取
    // 格式: <meta http-equiv="refresh" content="0;url=http://172.16.62.1:1000/fgtauth?xxxxx">
    const metaRefreshMatch = html.match(/<meta[^>]+content=["'][^"']*url=[^"']*\/fgtauth\?([0-9a-f]+)[^"']*["']/i);
    if (metaRefreshMatch && metaRefreshMatch[1]) {
        console.log("[NKUST] ✓ Extracted magic from meta refresh:", metaRefreshMatch[1]);
        return metaRefreshMatch[1];
    }

    // 方法 4: 從 href 屬性中提取
    // 格式: <a href="http://172.16.62.1:1000/fgtauth?xxxxx">
    const hrefMatch = html.match(/href=["']https?:\/\/[^"']*\/fgtauth\?([0-9a-f]+)["']/i);
    if (hrefMatch && hrefMatch[1]) {
        console.log("[NKUST] ✓ Extracted magic from href:", hrefMatch[1]);
        return hrefMatch[1];
    }

    console.log("[NKUST] ✗ No magic value found in HTML");

    return null;
}

/**
 * 從 curl -v 的 stderr 輸出中提取 HTTP 狀態碼
 * @param stderr curl -v 的 stderr 輸出
 * @returns HTTP 狀態碼，如果找不到返回 0
 */
export function extractHttpStatusFromVerbose(stderr: string): number {
    if (!stderr) {
        return 0;
    }

    // 從 curl -v 的輸出中查找 HTTP 狀態行
    // 格式: < HTTP/1.1 200 OK
    const match = stderr.match(/< HTTP\/[\d.]+\s+(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

/**
 * 從 curl -i 的 stdout 輸出中提取 HTTP 狀態碼
 * @param stdout curl -i 的 stdout 輸出（包含響應頭）
 * @returns HTTP 狀態碼，如果找不到返回 0
 */
export function extractHttpStatusFromHeaders(stdout: string): number {
    if (!stdout) {
        return 0;
    }

    // 從響應頭中查找 HTTP 狀態行
    // 格式: HTTP/1.1 200 OK
    const lines = stdout.split('\n');
    for (const line of lines) {
        const match = line.match(/^HTTP\/[\d.]+\s+(\d+)/);
        if (match) {
            return parseInt(match[1]);
        }
    }

    return 0;
}

/**
 * 檢查是否已連線到網際網路
 * @param html HTML 內容
 * @param statusCode HTTP 狀態碼
 * @returns 如果內容看起來像正常的 Google 首頁則返回 true
 */
export function isAlreadyConnectedToInternet(html: string, statusCode: number = 0): boolean {
    if (!html) {
        return false;
    }

    const lowerHtml = html.toLowerCase();

    // 檢查是否包含認證相關內容（表示未登入）
    const hasAuthContent = lowerHtml.includes('fgtauth') ||
        lowerHtml.includes('fortinet') ||
        lowerHtml.includes('fortigate') ||
        lowerHtml.includes('window.location');

    if (hasAuthContent) {
        console.log("[NKUST] Detected auth content in response - not connected");
        return false;
    }

    // 檢查是否是正常的 Google 頁面
    const isGooglePage = (lowerHtml.includes('<!doctype html>') || lowerHtml.includes('<html')) &&
        (lowerHtml.includes('google') || lowerHtml.includes('search'));

    // 如果是正常的 Google 頁面且內容較長（超過 1000 字元），可能已連線
    if (isGooglePage && html.length > 1000) {
        console.log("[NKUST] Detected normal Google page - already connected",statusCode);
        return true;
    }

    return false;
}

/**
 * 獲取 magic 值的完整流程
 */
export async function getMagicValue(): Promise<{
    magic: string | null;
    alreadyConnected: boolean;
    html?: string;
    statusCode?: number;
}> {
    try {
        console.log("[NKUST] Fetching Google page with curl -v -i...");

        // Step 1: 獲取 Google 頁面內容
        const { stdout, stderr } = await fetchGooglePage();

        if (!stdout && !stderr) {
            console.log("[NKUST] Empty response from Google");
            return { magic: null, alreadyConnected: false };
        }

        // Step 2: 提取響應體
        const html = extractResponseBody(stdout);

        // Step 3: 提取 HTTP 狀態碼
        const statusCode = extractHttpStatusFromHeaders(stdout) || extractHttpStatusFromVerbose(stderr);

        console.log("[NKUST] HTTP Status Code:", statusCode);
        console.log("[NKUST] Response body length:", html.length);
        console.log("[NKUST] Response body preview:", html.substring(0, 200));

        // Step 4: 檢查是否已連線
        if (isAlreadyConnectedToInternet(html, statusCode)) {
            console.log("[NKUST] Already connected to internet");
            return { magic: null, alreadyConnected: true, html, statusCode };
        }

        // Step 5: 從重定向頁面提取 magic
        const magic = extractMagicFromHtml(html);

        if (magic) {
            console.log("[NKUST] Successfully extracted magic value:", magic);
            return { magic, alreadyConnected: false, html, statusCode };
        }

        console.log("[NKUST] No magic value found in response");
        return { magic: null, alreadyConnected: false, html, statusCode };

    } catch (err) {
        console.error("[NKUST] Get magic error:", err);
        return { magic: null, alreadyConnected: false };
    }
}

/**
 * 生成登入 POST 請求的 curl 命令參數
 */
export function buildLoginPostData(
    username: string,
    password: string,
    magic: string,
    redirectUrl: string = "http://www.google.com/"
): Record<string, string> {
    return {
        username,
        password,
        magic,
        '4Tredir': redirectUrl
    };
}

/**
 * 將 POST 數據轉換為 curl -d 參數字串陣列
 */
export function formatPostDataForCurl(data: Record<string, string>): string[] {
    return Object.entries(data).map(([key, value]) => `-d "${key}=${value}"`);
}

/**
 * 生成登入 POST 請求的腳本
 */
export function generateLoginPostScript(
    fullUsername: string,
    password: string,
    magic: string
): string {
    const loginUrl = "http://172.16.62.1:1000/";

    return `
        LOGIN_URL="${loginUrl}"
        
        echo "[INFO] LOGIN_URL: $LOGIN_URL" >&2
        echo "[INFO] USERNAME: ${fullUsername}" >&2
        echo "[INFO] MAGIC: ${magic}" >&2
        
        # 獲取 curl 路徑
        CURL_PATH=$(which curl)
        echo "[INFO] Using curl at: $CURL_PATH" >&2
        
        # 發送 POST 請求，使用 -w 獲取 HTTP 狀態碼
        LOGIN_RESP=$("$CURL_PATH" -i -w "\\nHTTP_CODE:%{http_code}" \\
            -X POST "$LOGIN_URL" \\
            -d "username=${fullUsername}" \\
            -d "password=${password}" \\
            -d "magic=${magic}" \\
            -d "4Tredir=http://www.google.com/" 2>&1)
        
        CURL_EXIT_CODE=$?
        
        echo "" >&2
        echo "[INFO] CURL_EXIT_CODE: $CURL_EXIT_CODE" >&2
        echo "[INFO] LOGIN_RESPONSE (first 30 lines):" >&2
        echo "$LOGIN_RESP" | head -30 >&2
        echo "" >&2
        
        # 輸出完整響應供解析
        echo "$LOGIN_RESP"
    `;
}

/**
 * 執行登入 POST 請求
 */
export async function executeLoginPost(
    fullUsername: string,
    password: string,
    magic: string
): Promise<{ stdout: string; stderr: string }> {
    const script = generateLoginPostScript(fullUsername, password, magic);

    return execAsync(script, {
        timeout: 10000,
        shell: '/bin/bash'
    });
}

/**
 * 生成驗證網路連線的腳本（單次檢查）
 */
export function generateVerifyInternetScript(testUrl: string = "http://www.google.com"): string {
    return `
        # 嘗試訪問指定 URL
        RESPONSE=$(curl -s --max-time 3 "${testUrl}")
        
        # 檢查響應是否包含 HTML doctype 或 html 標籤（表示正常頁面）
        if echo "$RESPONSE" | grep -qiE '<!doctype html|<html'; then
            # 再檢查是否不包含認證相關內容
            if ! echo "$RESPONSE" | grep -qiE 'fgtauth|fortinet|fortigate'; then
                echo "INTERNET_OK"
                exit 0
            fi
        fi
        
        echo "INTERNET_FAIL"
        exit 1
    `;
}

/**
 * 使用腳本驗證網路連線（bash 版本）
 */
export async function verifyInternetViaBash(testUrl?: string): Promise<boolean> {
    try {
        const script = generateVerifyInternetScript(testUrl);
        const { stdout } = await execAsync(script, {
            timeout: 5000,
            shell: '/bin/bash'
        });

        return stdout.includes("INTERNET_OK");
    } catch {
        return false;
    }
}

/**
 * 延遲函數
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 多次重試驗證網路連線
 */
export async function verifyInternetWithRetry(
    maxAttempts: number = 3,
    delayMs: number = 1000
): Promise<boolean> {
    for (let i = 1; i <= maxAttempts; i++) {
        console.log(`[NKUST] Verifying internet, attempt ${i}/${maxAttempts}`);

        // 第一次之後等待再檢查
        if (i > 1) {
            await delay(delayMs);
        }

        const isConnected = await verifyInternetViaBash();
        if (isConnected) {
            console.log(`[NKUST] Internet verified on attempt ${i}`);
            return true;
        }
    }

    console.log(`[NKUST] Internet verification failed after ${maxAttempts} attempts`);
    return false;
}

/**
 * 解析 HTTP 狀態碼
 */
export function parseHttpStatusCode(stdout: string): number {
    const match = stdout.match(/HTTP_CODE:(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

/**
 * 解析 HTTP 響應頭
 */
export function parseHttpHeaders(stdout: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const lines = stdout.split('\n');

    for (const line of lines) {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
            headers[match[1].toLowerCase()] = match[2].trim();
        }
    }

    return headers;
}

/**
 * 解析響應體
 */
export function parseResponseBody(stdout: string): string {
    // 移除 HTTP_CODE 標記
    let body = stdout.replace(/HTTP_CODE:\d+/, '');

    // 找到空行後的內容（HTTP body）
    const emptyLineIndex = body.indexOf('\n\n');
    if (emptyLineIndex !== -1) {
        body = body.substring(emptyLineIndex + 2);
    }

    return body.trim();
}

/**
 * 檢查 HTTP 狀態碼是否表示成功重定向
 */
export function isRedirectStatusCode(statusCode: number): boolean {
    return [301, 302, 303, 307, 308].includes(statusCode);
}

/**
 * 檢查 HTTP 狀態碼是否為 200 OK
 */
export function isOkStatusCode(statusCode: number): boolean {
    return statusCode === 200;
}

/**
 * 檢查 HTTP 狀態碼是否表示成功
 */
export function isSuccessStatusCode(statusCode: number): boolean {
    return isOkStatusCode(statusCode) || isRedirectStatusCode(statusCode);
}

/**
 * 檢查響應體是否包含成功標記
 */
export function containsSuccessKeyword(body: string): boolean {
    const bodyText = body.toLowerCase();
    const successKeywords = ['success', '成功', 'welcome', '歡迎', 'authenticated'];
    return successKeywords.some(keyword => bodyText.includes(keyword));
}

/**
 * 使用 axios 驗證外網連線（備用方案）
 */
export async function verifyInternetViaAxios(testUrl: string = "http://neverssl.com"): Promise<boolean> {
    try {
        const test = await axios.get(testUrl, {
            timeout: 3000,
            validateStatus: () => true
        });
        return test.status === 200;
    } catch {
        return false;
    }
}

/**
 * 判斷登入結果訊息
 */
export async function determineLoginResult(
    statusCode: number,
    body: string,
    options: {
        useRetry?: boolean;
        maxRetries?: number;
        retryDelay?: number;
    } = {}
): Promise<string> {
    const {
        useRetry = true,
        maxRetries = 3,
        retryDelay = 1000
    } = options;

    console.log(`[NKUST] Determining result for HTTP ${statusCode}`);

    // 檢查 HTTP 狀態碼
    if (!isSuccessStatusCode(statusCode)) {
        return `登入失敗 (HTTP ${statusCode})`;
    }

    // 如果是重定向，很可能登入成功
    if (isRedirectStatusCode(statusCode)) {
        console.log("[NKUST] Got redirect response, verifying internet...");

        const isConnected = useRetry
            ? await verifyInternetWithRetry(maxRetries, retryDelay)
            : await verifyInternetViaBash();

        if (isConnected) {
            return "登入成功 ✅";
        }

        return "登入成功，但 DNS 尚未刷新 ⚠️";
    }

    // 如果是 200，檢查響應內容
    if (isOkStatusCode(statusCode)) {
        if (containsSuccessKeyword(body)) {
            console.log("[NKUST] Found success keyword in response body");

            const isConnected = useRetry
                ? await verifyInternetWithRetry(maxRetries, retryDelay)
                : await verifyInternetViaBash();

            if (isConnected) {
                return "登入成功 ✅";
            }

            return "登入成功，但 DNS 尚未刷新 ⚠️";
        }

        // 即使沒有成功關鍵字，也嘗試驗證網路
        console.log("[NKUST] No success keyword, but checking internet anyway...");
        const isConnected = useRetry
            ? await verifyInternetWithRetry(maxRetries, retryDelay)
            : await verifyInternetViaBash();

        if (isConnected) {
            return "登入成功 ✅";
        }

        return "伺服器返回成功，但無法訪問網際網路 ⚠️";
    }

    return `登入失敗 (HTTP ${statusCode})`;
}

/**
 * 處理錯誤訊息
 */
export function handleLoginError(err: unknown): string {
    const error = err as Error;
    const errorMsg = error?.message || String(err);

    console.error("[NKUST] Login error:", err);

    const errorMappings: [string, string][] = [
        ["socket hang up", "無法連線到校園網伺服器 (請確認已連接 NKUST Wi-Fi)"],
        ["timeout", "連線逾時 (請確認已連接 NKUST Wi-Fi)"],
        ["ECONNREFUSED", "校園網伺服器拒絕連線"],
        ["ENOTFOUND", "找不到伺服器 (請確認已連接 NKUST Wi-Fi)"],
        ["ENETUNREACH", "網路無法連接"],
    ];

    for (const [keyword, message] of errorMappings) {
        if (errorMsg.includes(keyword)) {
            return message;
        }
    }

    return "登入過程發生錯誤：" + errorMsg;
}

/**
 * 登入 NKUST 校園 Wi-Fi
 * @param username 學號
 * @param password 密碼
 * @returns 登入結果字串
 */
export async function loginNKUST(username: string, password: string): Promise<string> {
    try {
        // Step 1: 格式化使用者名稱
        const fullUsername = formatUsername(username);
        console.log("[NKUST] Formatted username:", fullUsername);

        // Step 2: 獲取 magic 值
        console.log("[NKUST] Step 1: Fetching redirect page and extracting magic...");
        const { magic, alreadyConnected, html } = await getMagicValue();

        if (alreadyConnected) {
            console.log("[NKUST] Already connected to internet");
            return "已連線網際網路，無需登入。";
        }

        if (!magic) {
            console.error("[NKUST] Failed to extract magic value");
            if (html) {
                console.log("[NKUST] HTML preview:", html.substring(0, 200));
            }
            return "無法取得認證參數，請確認已連接 NKUST Wi-Fi。";
        }

        console.log("[NKUST] Successfully extracted magic:", magic);

        // Step 3: 執行登入 POST 請求
        console.log("[NKUST] Step 2: Sending login POST request...");
        const { stdout, stderr } = await executeLoginPost(fullUsername, password, magic);

        console.log("[NKUST] Login stderr:", stderr.substring(0, 500));

        // Step 4: 解析響應
        console.log("[NKUST] Step 3: Parsing response...");
        const statusCode = parseHttpStatusCode(stdout);
        const body = parseResponseBody(stdout);

        console.log("[NKUST] HTTP Status:", statusCode);

        // Step 5: 判斷登入結果
        console.log("[NKUST] Step 4: Determining login result...");
        return await determineLoginResult(statusCode, body);

    } catch (err) {
        return handleLoginError(err);
    }
}

