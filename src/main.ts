/**
 * Electron メインプロセス
 *
 * 型定義は import type で取得し、ランタイムでは require を使用する。
 * これは Electron が Electron プロセス内でのみ API を提供するため。
 * Node.js 単体で require('electron') すると実行可能パスが返される。
 */
import type { App, BrowserWindow as BrowserWindowType, WebContents } from 'electron';
import path from 'path';

// ランタイムで Electron モジュールを取得
// eslint-disable-next-line @typescript-eslint/no-require-imports
const electron = require('electron') as typeof import('electron');
const app: App = electron.app;
const BrowserWindow: typeof BrowserWindowType = electron.BrowserWindow;
const { session } = electron;

// メインウィンドウの参照を保持
let mainWindow: BrowserWindowType | null = null;

/**
 * メインウィンドウを作成する
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1200,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  // index.html をロード
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // ウィンドウが閉じられたときの処理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Electron の初期化完了後にウィンドウを作成
app.whenReady().then(() => {
  // webview 用のセッション設定
  // persist: を付けると認証情報が永続化される
  const webviewSession = session.fromPartition('persist:sns-viewer');

  // WebAuthn（パスキー）を有効化
  webviewSession.setPermissionRequestHandler(
    (
      _webContents: WebContents,
      permission: string,
      callback: (permissionGranted: boolean) => void
    ) => {
      // 許可する権限リスト
      const allowedPermissions = [
        'media', // カメラ・マイク
        'geolocation', // 位置情報
        'notifications', // 通知
        'fullscreen', // フルスクリーン
        'pointerLock', // ポインターロック
        'clipboard-read', // クリップボード読み取り
        'clipboard-sanitized-write', // クリップボード書き込み
      ];

      if (allowedPermissions.includes(permission)) {
        callback(true);
      } else {
        callback(false);
      }
    }
  );

  createWindow();

  // macOS: ドックアイコンクリック時にウィンドウがなければ再作成
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 全ウィンドウが閉じられたときの処理
app.on('window-all-closed', () => {
  // macOS 以外ではアプリを終了
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
