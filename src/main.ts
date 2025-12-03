/**
 * Electron メインプロセス
 *
 * 型定義は import type で取得し、ランタイムでは require を使用する。
 * これは Electron が Electron プロセス内でのみ API を提供するため。
 * Node.js 単体で require('electron') すると実行可能パスが返される。
 */
import type { App, BrowserWindow as BrowserWindowType } from 'electron';
import path from 'path';

// ランタイムで Electron モジュールを取得
// eslint-disable-next-line @typescript-eslint/no-require-imports
const electron = require('electron') as typeof import('electron');
const app: App = electron.app;
const BrowserWindow: typeof BrowserWindowType = electron.BrowserWindow;

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
