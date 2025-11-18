// electron/nkustAuth.ts
import http from "http";
import { Agent } from "http";
import os from "os";

/**
 * 格式化使用者名稱為完整的電子郵件格式
 */
export function formatUsername(username: string): string {
    return username.includes("@") ? username : `${username}@nkust.edu.tw`;
}

/**
 * 獲取 Wi-Fi 網路介面的 IP
 */
function getWiFiInterfaceIP(): string | null {
    const interfaces = os.networkInterfaces();

    for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs) continue;

        const isWiFi = name.toLowerCase().includes('wi-fi') ||
            name.toLowerCase().includes('wlan') ||
            name.startsWith('en');

        if (isWiFi) {
            for (const addr of addrs) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    console.log(`[NKUST] Found Wi-Fi interface: ${name} -> ${addr.address}`);
                    return addr.address;
                }
            }
        }
    }

    console.warn("[NKUST] No Wi-Fi interface found");
    return null;
}

/**
 * 獲取 Google 重定向頁面
 */
export async function fetchGooglePage(): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const localIP = getWiFiInterfaceIP();

        const agent = new Agent({
            family: 4,
            keepAlive: false
        });

        const options: http.RequestOptions = {
            hostname: 'www.google.com',
            port: 80,
            path: '/',
            method: 'GET',
            agent: agent,
            localAddress: localIP || undefined,
            headers: {
                'User-Agent': 'curl/7.81.0',
                'Accept': '*/*',
                'Connection': 'close'
            },
            timeout: 10000
        };

        console.log(`[NKUST] ========== Fetch Google Page ==========`);
        console.log(`[NKUST] Local IP: ${localIP || 'default'}`);
        console.log(`[NKUST] Target: http://www.google.com/`);

        const req = http.request(options, (res) => {
            let headers = `HTTP/${res.httpVersion} ${res.statusCode} ${res.statusMessage}\n`;

            for (const [key, value] of Object.entries(res.headers)) {
                headers += `${key}: ${value}\n`;
            }
            headers += '\n';

            let body = '';

            res.on('data', (chunk) => {
                body += chunk;
            });

            res.on('end', () => {
                const stdout = headers + body;
                const stderr = `* Local address: ${localIP || 'default'}\n* Status: ${res.statusCode}`;

                console.log(`[NKUST] Response Status: ${res.statusCode}`);
                console.log(`[NKUST] Body Length: ${body.length}`);
                console.log(`[NKUST] Body Preview:`, body.substring(0, 300));
                console.log(`[NKUST] ==========================================`);

                resolve({ stdout, stderr });
            });
        });

        req.on('error', (err) => {
            console.error("[NKUST] Request failed:", err.message);
            reject(err);
        });

        req.on('timeout', () => {
            console.error("[NKUST] Request timeout");
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

/**
 * 從響應中提取響應體
 */
export function extractResponseBody(stdout: string): string {
    if (!stdout) {
        return "";
    }

    const lines = stdout.split('\n');
    let bodyStartIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '' && i > 0) {
            if (lines[i - 1].includes(':') || lines[i - 1].startsWith('HTTP/')) {
                bodyStartIndex = i + 1;
                break;
            }
        }
    }

    if (bodyStartIndex === -1 || bodyStartIndex >= lines.length) {
        const lastLine = lines[lines.length - 1].trim();
        if (lastLine.startsWith('<html') || lastLine.includes('fgtauth')) {
            return lastLine;
        }
        return "";
    }

    return lines.slice(bodyStartIndex).join('\n').trim();
}

/**
 * 從 HTML 內容中提取 magic 值
 */
export function extractMagicFromHtml(html: string): string | null {
    if (!html) {
        return null;
    }

    console.log("[NKUST] Attempting to extract magic from HTML...");
    console.log("[NKUST] HTML content:", html.substring(0, 300));

    const jsRedirectMatch = html.match(/window\.location\s*=\s*["']https?:\/\/[^"']*\/fgtauth\?([0-9a-f]+)["']/i);
    if (jsRedirectMatch && jsRedirectMatch[1]) {
        console.log("[NKUST] ✓ Extracted magic from JavaScript redirect:", jsRedirectMatch[1]);
        return jsRedirectMatch[1];
    }

    const fgtauthMatch = html.match(/fgtauth\?([0-9a-f]+)/i);
    if (fgtauthMatch && fgtauthMatch[1]) {
        console.log("[NKUST] ✓ Extracted magic from fgtauth pattern:", fgtauthMatch[1]);
        return fgtauthMatch[1];
    }

    const metaRefreshMatch = html.match(/<meta[^>]+content=["'][^"']*url=[^"']*\/fgtauth\?([0-9a-f]+)[^"']*["']/i);
    if (metaRefreshMatch && metaRefreshMatch[1]) {
        console.log("[NKUST] ✓ Extracted magic from meta refresh:", metaRefreshMatch[1]);
        return metaRefreshMatch[1];
    }

    const hrefMatch = html.match(/href=["']https?:\/\/[^"']*\/fgtauth\?([0-9a-f]+)["']/i);
    if (hrefMatch && hrefMatch[1]) {
        console.log("[NKUST] ✓ Extracted magic from href:", hrefMatch[1]);
        return hrefMatch[1];
    }

    console.log("[NKUST] ✗ No magic value found in HTML");
    return null;
}

/**
 * 提取 HTTP 狀態碼
 */
export function extractHttpStatusFromHeaders(stdout: string): number {
    if (!stdout) {
        return 0;
    }

    const lines = stdout.split('\n');
    for (const line of lines) {
        const match = line.match(/^HTTP\/[\d.]+\s+(\d+)/);
        if (match) {
            return parseInt(match[1]);
        }
    }

    return 0;
}

export function extractHttpStatusFromVerbose(stderr: string): number {
    if (!stderr) {
        return 0;
    }

    const match = stderr.match(/< HTTP\/[\d.]+\s+(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

/**
 * 檢查是否已連線到網際網路（修正版）
 */
export function isAlreadyConnectedToInternet(html: string, statusCode: number = 0): boolean {
    if (!html) {
        return false;
    }

    const lowerHtml = html.toLowerCase();

    // 檢查是否包含認證相關內容（表示未登入）
    const hasAuthContent = lowerHtml.includes('fgtauth') ||
        lowerHtml.includes('fortinet') ||
        lowerHtml.includes('fortigate');

    if (hasAuthContent) {
        console.log("[NKUST] Detected auth content in response - not connected");
        return false;
    }

    // 檢查是否是正常的 Google 頁面
    const isGooglePage = (lowerHtml.includes('<!doctype html>') || lowerHtml.includes('<html')) &&
        lowerHtml.includes('google');

    if (isGooglePage && html.length > 1000) {
        console.log("[NKUST] Detected normal Google page - already connected", statusCode);
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
        console.log("[NKUST] Fetching Google page...");

        const { stdout, stderr } = await fetchGooglePage();

        if (!stdout && !stderr) {
            console.log("[NKUST] Empty response from Google");
            return { magic: null, alreadyConnected: false };
        }

        const html = extractResponseBody(stdout);
        const statusCode = extractHttpStatusFromHeaders(stdout) || extractHttpStatusFromVerbose(stderr);

        console.log("[NKUST] HTTP Status Code:", statusCode);
        console.log("[NKUST] Response body length:", html.length);
        console.log("[NKUST] Response body preview:", html.substring(0, 200));

        if (isAlreadyConnectedToInternet(html, statusCode)) {
            console.log("[NKUST] Already connected to internet");
            return { magic: null, alreadyConnected: true, html, statusCode };
        }

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
 * 先訪問 fgtauth URL 建立 session（關鍵步驟！）
 */
async function visitFgtauthUrl(magic: string): Promise<boolean> {
    return new Promise((resolve) => {
        const localIP = getWiFiInterfaceIP();

        const agent = new Agent({
            family: 4,
            keepAlive: false
        });

        const options: http.RequestOptions = {
            hostname: '172.16.62.1',
            port: 1000,
            path: `/fgtauth?${magic}`,
            method: 'GET',
            agent: agent,
            localAddress: localIP || undefined,
            headers: {
                'User-Agent': 'curl/7.81.0',
                'Accept': '*/*',
                'Host': '172.16.62.1:1000',
                'Connection': 'close'
            },
            timeout: 5000
        };

        console.log(`[NKUST] Visiting fgtauth URL: http://172.16.62.1:1000/fgtauth?${magic}`);

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`[NKUST] Fgtauth response status: ${res.statusCode}`);
                console.log(`[NKUST] Fgtauth response length: ${data.length}`);
                console.log(`[NKUST] Fgtauth response preview:`, data.substring(0, 200));
                resolve(true);
            });
        });

        req.on('error', (err) => {
            console.error("[NKUST] Fgtauth request error:", err.message);
            resolve(false);
        });

        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

/**
 * 執行登入 POST 請求
 */
export async function executeLoginPost(
    fullUsername: string,
    password: string,
    magic: string
): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const localIP = getWiFiInterfaceIP();

        const postData = new URLSearchParams({
            username: fullUsername,
            password: password,
            magic: magic,
            '4Tredir': 'http://www.google.com/'
        }).toString();

        const agent = new Agent({
            family: 4,
            keepAlive: false
        });

        const options: http.RequestOptions = {
            hostname: '172.16.62.1',
            port: 1000,
            path: '/',
            method: 'POST',
            agent: agent,
            localAddress: localIP || undefined,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'curl/7.81.0',
                'Accept': '*/*',
                'Host': '172.16.62.1:1000',
                'Connection': 'close'
            },
            timeout: 10000
        };

        console.log(`[NKUST] ========== Login POST Request ==========`);
        console.log(`[NKUST] Local IP: ${localIP || 'default'}`);
        console.log(`[NKUST] Target: http://172.16.62.1:1000/`);
        console.log(`[NKUST] Magic: ${magic}`);

        const req = http.request(options, (res) => {
            let headers = `HTTP/${res.httpVersion} ${res.statusCode} ${res.statusMessage}\nHTTP_CODE:${res.statusCode}\n`;

            for (const [key, value] of Object.entries(res.headers)) {
                headers += `${key}: ${value}\n`;
            }
            headers += '\n';

            let body = '';

            res.on('data', (chunk) => {
                body += chunk;
            });

            res.on('end', () => {
                const stdout = headers + body;
                const stderr = `[INFO] CURL_EXIT_CODE: 0\n[INFO] LOGIN_RESPONSE received`;

                console.log(`[NKUST] Login Status: ${res.statusCode}`);
                console.log(`[NKUST] Response Length: ${body.length}`);
                console.log(`[NKUST] ==========================================`);

                resolve({ stdout, stderr });
            });
        });

        req.on('error', (err) => {
            console.error("[NKUST] Login request failed:", err.message);
            reject(err);
        });

        req.on('timeout', () => {
            console.error("[NKUST] Login request timeout");
            req.destroy();
            reject(new Error('Login request timeout'));
        });

        req.write(postData);
        req.end();
    });
}

/**
 * 驗證網路連線
 */
export async function verifyInternetViaBash(): Promise<boolean> {
    return new Promise((resolve) => {
        const agent = new Agent({
            family: 4,
            keepAlive: false
        });

        const options: http.RequestOptions = {
            hostname: 'www.google.com',
            port: 80,
            path: '/',
            method: 'GET',
            agent: agent,
            headers: {
                'User-Agent': 'curl/7.81.0',
                'Connection': 'close'
            },
            timeout: 3000
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const lowerData = data.toLowerCase();
                const isGooglePage = (lowerData.includes('<!doctype html') || lowerData.includes('<html')) &&
                    (lowerData.includes('google') || lowerData.includes('search'));
                const hasAuth = lowerData.includes('fgtauth') || lowerData.includes('fortinet');

                resolve(isGooglePage && !hasAuth);
            });
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function verifyInternetWithRetry(
    maxAttempts: number = 3,
    delayMs: number = 1000
): Promise<boolean> {
    for (let i = 1; i <= maxAttempts; i++) {
        console.log(`[NKUST] Verifying internet, attempt ${i}/${maxAttempts}`);

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

export function parseHttpStatusCode(stdout: string): number {
    const match = stdout.match(/HTTP_CODE:(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

export function parseResponseBody(stdout: string): string {
    let body = stdout.replace(/HTTP_CODE:\d+/, '');
    const emptyLineIndex = body.indexOf('\n\n');
    if (emptyLineIndex !== -1) {
        body = body.substring(emptyLineIndex + 2);
    }
    return body.trim();
}

export function isRedirectStatusCode(statusCode: number): boolean {
    return [301, 302, 303, 307, 308].includes(statusCode);
}

export function isOkStatusCode(statusCode: number): boolean {
    return statusCode === 200;
}

export function isSuccessStatusCode(statusCode: number): boolean {
    return isOkStatusCode(statusCode) || isRedirectStatusCode(statusCode);
}

export function containsSuccessKeyword(body: string): boolean {
    const bodyText = body.toLowerCase();
    const successKeywords = ['success', '成功', 'welcome', '歡迎', 'authenticated'];
    return successKeywords.some(keyword => bodyText.includes(keyword));
}

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

    if (!isSuccessStatusCode(statusCode)) {
        return `登入失敗 (HTTP ${statusCode})`;
    }

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
 */
export async function loginNKUST(username: string, password: string): Promise<string> {
    try {
        const fullUsername = formatUsername(username);
        console.log("[NKUST] ========== Login Process Start ==========");
        console.log("[NKUST] Formatted username:", fullUsername);

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

        // 🔑 關鍵步驟：先訪問 fgtauth URL 建立 session
        console.log("[NKUST] Step 1.5: Visiting fgtauth URL to establish session...");
        await visitFgtauthUrl(magic);
        await delay(500);

        console.log("[NKUST] Step 2: Sending login POST request...");
        const { stdout, stderr } = await executeLoginPost(fullUsername, password, magic);
        console.log("[NKUST] ERROR", stderr);
        console.log("[NKUST] Step 3: Parsing response...");
        const statusCode = parseHttpStatusCode(stdout);
        const body = parseResponseBody(stdout);

        console.log("[NKUST] HTTP Status:", statusCode);

        console.log("[NKUST] Step 4: Determining login result...");
        const result = await determineLoginResult(statusCode, body);

        console.log("[NKUST] ========== Login Process End ==========");
        return result;

    } catch (err) {
        console.log("[NKUST] ========== Login Process Error ==========");
        return handleLoginError(err);
    }
}
