import { contextBridge, ipcRenderer } from "electron";


contextBridge.exposeInMainWorld("electronAPI", {
    onWifiStatus: (callback: (event: any, data: { ssid: string; result: string }) => void) =>
        ipcRenderer.on("wifi-status", callback),
    manualLogin: async (): Promise<string> => ipcRenderer.invoke("manual-login"),
    saveCredentials: async (studentId: string, password: string): Promise<string> =>
        ipcRenderer.invoke("save-credentials", studentId, password),
    getCredentials: async (): Promise<{ studentId: string; password: string }> =>
        ipcRenderer.invoke("get-credentials"),
    hasCredentials: async (): Promise<boolean> => ipcRenderer.invoke("has-credentials"),
    getAutoLogin: async (): Promise<boolean> => ipcRenderer.invoke("get-auto-login"),
    setAutoLogin: async (enabled: boolean): Promise<void> =>
        ipcRenderer.invoke("set-auto-login", enabled),
});
