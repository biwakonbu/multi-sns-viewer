const { contextBridge } = require('electron');

/**
 * メインプロセスとレンダラープロセス間のAPIを定義
 * 現時点では将来の拡張用に空のオブジェクトを公開
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // 将来的にメインプロセスとの通信が必要になった場合に追加
});
