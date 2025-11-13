"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  onWifiStatus: (callback) => electron.ipcRenderer.on("wifi-status", callback),
  manualLogin: async () => electron.ipcRenderer.invoke("manual-login"),
  saveCredentials: async (studentId, password) => electron.ipcRenderer.invoke("save-credentials", studentId, password),
  getCredentials: async () => electron.ipcRenderer.invoke("get-credentials"),
  hasCredentials: async () => electron.ipcRenderer.invoke("has-credentials")
});
