# Multi SNS Viewer

## プロジェクト概要

Electron を使用したマルチ SNS ビューワー。複数の SNS（TikTok, YouTube, X, Instagram, Threads）を 1 画面に並べて同時表示するデスクトップアプリケーション。

## 技術スタック

- **Runtime**: Electron 33.x
- **Language**: TypeScript 5.x
- **Linter**: oxlint（ESLint の 50-100 倍高速）
- **Formatter**: Prettier
- **UI**: Vanilla HTML/CSS/TypeScript（フレームワーク不使用）

## ディレクトリ構造

```
multi-sns-viewer/
├── src/                    # TypeScript ソースコード
│   ├── main.ts             # メインプロセス（ウィンドウ管理）
│   ├── preload.ts          # プリロードスクリプト（IPC 通信用）
│   └── renderer/           # レンダラープロセス
│       ├── index.html      # メイン UI（2 段レイアウト）
│       ├── style.css       # スタイル定義
│       └── renderer.ts     # パネル切り替えロジック
├── dist/                   # ビルド出力（gitignore 対象）
├── .oxlintrc.json          # oxlint 設定
├── .prettierrc             # Prettier 設定
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

## アーキテクチャ

### プロセス構成

```
+-------------------+
|   Main Process    |  <- src/main.ts
|   (Node.js 環境)   |
+-------------------+
         |
         | preload.js 経由で API 公開
         v
+-------------------+
| Renderer Process  |  <- src/renderer/
|   (ブラウザ環境)   |
+-------------------+
         |
         | webview タグで分離
         v
+-------------------+
|  SNS Webviews     |  <- 各 SNS サイトを表示
| (独立したコンテキスト) |
+-------------------+
```

### セキュリティ設計

- `contextIsolation: true` - レンダラーと Node.js コンテキストを分離
- `nodeIntegration: false` - レンダラーで Node.js API を無効化
- `webviewTag: true` - SNS ページを webview で隔離表示
- CSP（Content Security Policy）でスクリプト実行を制限

## 開発コマンド

```bash
npm install       # 依存関係インストール
npm run build     # TypeScript コンパイル + アセットコピー
npm start         # ビルド + 起動
npm run dev       # 開発用（build + 起動）
npm run lint      # oxlint でリント
npm run lint:fix  # リントエラー自動修正
npm run format    # Prettier でフォーマット
npm run check     # lint + format:check + tsc（CI 用）
```

## UI 設計

### 2 段レイアウト

```
+------------------------------------------------------------------+
|                                                                  |
|                    メインビュー（16:9）                            |
|                    フォーカス中の SNS                              |
|                                                                  |
+------------------------------------------------------------------+
|  TikTok  |  YouTube  |     X     |  Instagram  |    Threads     |
|   縦長   |    縦長   |    縦長   |     縦長    |      縦長       |
+------------------------------------------------------------------+
```

- **メインビュー**: 16:9 比率を維持した大きなパネル
- **サブビュー**: 4 つの縦長パネルを横並びで表示
- **切り替え**: サブパネルクリックでメインと入れ替え
- **ウィンドウサイズ**: 1920x1080（FullHD）

## 重要な技術知見

### Electron TypeScript 型定義パターン

Electron は Electron プロセス内でのみ API を提供する。Node.js 単体で `require('electron')` すると実行可能パスの文字列が返される。

**推奨パターン**:

```typescript
// 型は import type で取得
import type { App, BrowserWindow as BrowserWindowType } from 'electron';

// ランタイムは require で取得（型アサーション付き）
const electron = require('electron') as typeof import('electron');
const app: App = electron.app;
const BrowserWindow: typeof BrowserWindowType = electron.BrowserWindow;
```

この方式により:

- TypeScript の厳密な型チェックが有効
- コンパイル後の JS は正しい CommonJS 形式
- `any` 型を使わずに型安全性を確保

### 静的解析ツール構成

- **oxlint**: 高速リンター（Rust 製、ESLint の 50-100 倍高速）
- **Prettier**: フォーマッター（oxfmt はまだアルファ段階のため）
- **TypeScript**: `tsc --noEmit` で型チェック

フォーマッターは oxfmt（Oxc Formatter）が安定したら移行を検討。

### イベント委譲パターン

動的に追加される要素のイベント処理には、イベント委譲を使用:

```typescript
// 親要素でイベントをキャプチャ
container.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const panel = target.closest<HTMLElement>('.panel');
  if (panel) handleClick(panel);
});
```

`this` のエイリアス（`const self = this`）は避け、アロー関数または明示的な引数を使用する。

## 対応 SNS

| サービス名 | URL                        |
| ---------- | -------------------------- |
| TikTok     | https://www.tiktok.com/    |
| YouTube    | https://www.youtube.com/   |
| X          | https://x.com/             |
| Instagram  | https://www.instagram.com/ |
| Threads    | https://www.threads.net/   |

## 拡張時の注意点

- 新しい SNS を追加する場合:
  1. `src/renderer/index.html` に `.sub-panel` を追加
  2. CSS の調整は通常不要（flexbox で自動配置）
- メインプロセスとの通信が必要な場合:
  1. `src/preload.ts` で API を公開
  2. `src/renderer/` から `window.electronAPI` 経由で呼び出し

## トラブルシューティング

### `Cannot read properties of undefined (reading 'whenReady')` エラー

**原因**: Electron がメインプロセスとして起動していない

**確認ポイント**:

1. `require('electron')` が文字列（パス）を返す場合、Node.js 単体で実行されている
2. `process.type` が `undefined` の場合、Electron ランタイム外で実行されている

**解決策**:

- `npm start` または `npx electron .` で起動する
- ヘッドレス環境（SSH、CI/CD）では GUI アプリは起動不可
- `electron .` の `.` はプロジェクトルートを指す必要がある

### TypeScript で Electron 型が解決できない

**原因**: `import { app } from 'electron'` は TypeScript では動作するが、コンパイル後の CommonJS で問題が発生

**解決策**: `import type` + `require` パターンを使用（上記「Electron TypeScript 型定義パターン」参照）

### oxlint で `no-this-alias` 警告

**原因**: `const self = this` のようなコードは ES2015 以前のパターン

**解決策**: イベント委譲またはアロー関数を使用して `this` のエイリアスを避ける
