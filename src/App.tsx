import { useEffect, useState } from "react";

declare global {
    interface Window {
        electronAPI: {
            onWifiStatus: (
                callback: (event: any, data: { ssid: string; result: string }) => void
            ) => void;
            manualLogin: () => Promise<string>;
            saveCredentials: (studentId: string, password: string) => Promise<string>;
            getCredentials: () => Promise<{ studentId: string; password: string }>;
            getAutoLogin: () => Promise<boolean>;
            setAutoLogin: (enabled: boolean) => Promise<void>;
        };
    }
}

export default function App() {
    const [ssid, setSsid] = useState("(檢測中...)");
    const [status, setStatus] = useState("-");
    const [studentId, setStudentId] = useState("");
    const [password, setPassword] = useState("");
    const [saveMessage, setSaveMessage] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [autoLogin, setAutoLogin] = useState(true);

    useEffect(() => {
        // 監聽 WiFi 狀態更新
        window.electronAPI.onWifiStatus((_event, data) => {
            setSsid(data.ssid || "(未連線)");
            setStatus(data.result || "-");
        });

        // 載入已儲存的憑證
        window.electronAPI.getCredentials().then((creds) => {
            setStudentId(creds.studentId);
            setPassword(creds.password);
        });

        // 載入自動登入設定
        window.electronAPI.getAutoLogin().then((enabled) => {
            setAutoLogin(enabled);
        });
    }, []);

    const handleManualLogin = async () => {
        setStatus("手動登入中...");
        const result = await window.electronAPI.manualLogin();
        setStatus(result);
    };

    const handleSaveCredentials = async () => {
        setSaveMessage("儲存中...");
        const result = await window.electronAPI.saveCredentials(studentId, password);
        setSaveMessage(result);
        setTimeout(() => setSaveMessage(""), 3000);
    };

    const handleAutoLoginToggle = async () => {
        const newValue = !autoLogin;
        setAutoLogin(newValue);
        await window.electronAPI.setAutoLogin(newValue);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white text-gray-700 p-6">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6">
                <h1 className="text-2xl font-bold text-blue-600 text-center mb-6">
                    NKUST Wi-Fi 登入助手
                </h1>

                {/* WiFi 狀態顯示 */}
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                        目前 SSID：<span className="font-semibold text-blue-600">{ssid}</span>
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                        登入狀態：<span className="font-semibold">{status}</span>
                    </p>
                    {saveMessage && (
                        <p className="text-sm text-green-600 text-center">{saveMessage}</p>
                    )}
                </div>

                {/* 憑證設定表單 */}
                <div className="mb-6">
                    <h2 className="text-lg font-semibold mb-3">帳號設定</h2>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                學號
                            </label>
                            <input
                                type="text"
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                placeholder="1101308102 (系統會自動加上 @nkust.edu.tw)"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                可直接輸入學號，或輸入完整電子郵件地址
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                密碼
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="請輸入密碼"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-2 text-gray-500 text-sm"
                                >
                                    {showPassword ? "隱藏" : "顯示"}
                                </button>
                            </div>
                        </div>

                        {/* 自動登入設定 */}
                        <div className="pt-3 pb-3 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700">自動登入</h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        偵測到 NKUST 時自動登入
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoLogin}
                                        onChange={handleAutoLoginToggle}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>

                        <button
                            onClick={handleSaveCredentials}
                            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                        >
                            儲存設定
                        </button>

                    </div>
                </div>

                {/* 手動登入按鈕 */}
                <button
                    onClick={handleManualLogin}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                    手動登入
                </button>
            </div>
        </div>
    );
}
