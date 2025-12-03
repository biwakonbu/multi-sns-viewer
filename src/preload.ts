const { contextBridge, ipcRenderer } = require('electron');

/**
 * メインプロセスとレンダラープロセス間のAPIを定義
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // 設定の保存・読み込み
  getConfig: (key: string) => ipcRenderer.invoke('config:get', key),
  setConfig: (key: string, value: unknown) => ipcRenderer.invoke('config:set', key, value),
});
