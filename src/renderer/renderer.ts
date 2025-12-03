/**
 * レンダラープロセス
 * パネルの切り替え、webview の User-Agent 設定、ズーム調整
 */

// モバイル版 User-Agent（iPhone Safari）
const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// デスクトップ版の想定サイズ（一般的なデスクトップサイト）
const DESKTOP_VIEWPORT_WIDTH = 1280;
const DESKTOP_VIEWPORT_HEIGHT = 720;

// モバイル版の想定サイズ（iPhone 14 Pro の論理サイズ）
const MOBILE_VIEWPORT_WIDTH = 393;
const MOBILE_VIEWPORT_HEIGHT = 852;

const mainView = document.querySelector<HTMLElement>('.main-view');
const subViews = document.querySelector<HTMLElement>('.sub-views');

// ピン固定状態
let isPinned = false;

/**
 * Electron の WebviewTag 型定義
 */
interface WebviewTag extends HTMLElement {
  setZoomFactor(factor: number): void;
  getWebContentsId(): number;
  executeJavaScript(code: string): Promise<unknown>;
  setUserAgent(userAgent: string): void;
  reload(): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;
}

/**
 * webview のズームレベルを計算して設定する
 * 幅と高さの両方を考慮し、コンテンツが収まる最小のズームを使用
 */
function adjustWebviewZoom(webview: WebviewTag, isDesktop: boolean): void {
  const rect = webview.getBoundingClientRect();

  const viewportWidth = isDesktop ? DESKTOP_VIEWPORT_WIDTH : MOBILE_VIEWPORT_WIDTH;
  const viewportHeight = isDesktop ? DESKTOP_VIEWPORT_HEIGHT : MOBILE_VIEWPORT_HEIGHT;

  // 幅と高さそれぞれのズームファクターを計算
  const zoomByWidth = rect.width / viewportWidth;
  const zoomByHeight = rect.height / viewportHeight;

  // 小さい方を採用（コンテンツ全体が収まるように）
  const zoomFactor = Math.min(zoomByWidth, zoomByHeight);

  // ズームファクターを適用（最小 0.25、最大 1.0）
  const clampedZoom = Math.max(0.25, Math.min(1.0, zoomFactor));
  webview.setZoomFactor(clampedZoom);
}

/**
 * すべての webview を初期化する
 */
function initializeWebviews(): void {
  // デスクトップ版 webview（メインビュー）
  const desktopWebviews = document.querySelectorAll<WebviewTag>('.webview-desktop');
  desktopWebviews.forEach((webview) => {
    webview.addEventListener('dom-ready', () => {
      adjustWebviewZoom(webview, true);
    });
  });

  // モバイル版 webview（サブビュー）
  const mobileWebviews = document.querySelectorAll<WebviewTag>('.webview-mobile');
  mobileWebviews.forEach((webview) => {
    // User-Agent をモバイルに設定
    webview.setUserAgent(MOBILE_USER_AGENT);

    webview.addEventListener('dom-ready', () => {
      adjustWebviewZoom(webview, false);

      // モバイルビューポートの meta タグを注入
      webview.executeJavaScript(`
        (function() {
          let viewport = document.querySelector('meta[name="viewport"]');
          if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
          }
          viewport.content = 'width=${MOBILE_VIEWPORT_WIDTH}, initial-scale=1.0, user-scalable=no';
        })();
      `);
    });
  });
}

/**
 * ウィンドウリサイズ時にズームを再調整
 */
function setupResizeObserver(): void {
  const resizeObserver = new ResizeObserver(() => {
    const desktopWebviews = document.querySelectorAll<WebviewTag>('.webview-desktop');
    desktopWebviews.forEach((webview) => {
      adjustWebviewZoom(webview, true);
    });

    const mobileWebviews = document.querySelectorAll<WebviewTag>('.webview-mobile');
    mobileWebviews.forEach((webview) => {
      adjustWebviewZoom(webview, false);
    });
  });

  // container の監視を開始
  const container = document.querySelector('.container');
  if (container) {
    resizeObserver.observe(container);
  }
}

/**
 * サブパネルとメインパネルを入れ替える
 */
function swapPanels(clickedSubPanel: HTMLElement): void {
  // ピン固定時は切り替え無効
  if (isPinned) return;
  if (!mainView || !subViews) return;

  const currentMainPanel = mainView.querySelector<HTMLElement>('.main-panel');
  if (!currentMainPanel) return;

  // webview のクラスを入れ替え
  const mainWebview = currentMainPanel.querySelector<WebviewTag>('.webview');
  const subWebview = clickedSubPanel.querySelector<WebviewTag>('.webview');

  if (mainWebview && subWebview) {
    // メインからサブへ: デスクトップ -> モバイル
    mainWebview.classList.remove('webview-desktop');
    mainWebview.classList.add('webview-mobile');
    mainWebview.setUserAgent(MOBILE_USER_AGENT);

    // サブからメインへ: モバイル -> デスクトップ
    subWebview.classList.remove('webview-mobile');
    subWebview.classList.add('webview-desktop');
    subWebview.setUserAgent(''); // デフォルトに戻す

    // ページをリロードして User-Agent を反映
    mainWebview.reload();
    subWebview.reload();
  }

  // パネルのクラスを入れ替え
  currentMainPanel.classList.remove('main-panel');
  currentMainPanel.classList.add('sub-panel');
  clickedSubPanel.classList.remove('sub-panel');
  clickedSubPanel.classList.add('main-panel');

  // サブパネルの位置を記録
  const subPanelIndex = Array.from(subViews.children).indexOf(clickedSubPanel);

  // メインビューにクリックされたパネルを移動
  mainView.appendChild(clickedSubPanel);

  // 元のメインパネルをサブビューに挿入
  if (subPanelIndex >= 0 && subPanelIndex < subViews.children.length) {
    subViews.insertBefore(currentMainPanel, subViews.children[subPanelIndex]);
  } else {
    subViews.appendChild(currentMainPanel);
  }

  // ズームを再調整
  setTimeout(() => {
    if (mainWebview) adjustWebviewZoom(mainWebview, false);
    if (subWebview) adjustWebviewZoom(subWebview, true);
  }, 100);
}

/**
 * イベント委譲でサブパネルのヘッダークリックを処理
 */
if (subViews) {
  subViews.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    // ヘッダー部分のクリックのみ入れ替えを実行
    const header = target.closest<HTMLElement>('.panel-header');
    if (!header) return;

    const subPanel = target.closest<HTMLElement>('.sub-panel');
    if (subPanel) {
      swapPanels(subPanel);
    }
  });
}

/**
 * webview のエラーハンドリングとポップアップ処理
 */
const webviews = document.querySelectorAll<WebviewTag>('.webview');
webviews.forEach((webview) => {
  webview.addEventListener('did-fail-load', (event) => {
    console.error('Webview failed to load:', event);
  });

  // 認証ポップアップなどの新しいウィンドウを同じwebview内で開く
  webview.addEventListener('new-window', (event: Event) => {
    const e = event as CustomEvent & { url: string; disposition: string };
    // 認証関連のURLは同じwebviewで開く
    if (e.url) {
      e.preventDefault?.();
      webview.setAttribute('src', e.url);
    }
  });
});

/**
 * ピン止め状態を切り替える
 */
function togglePin(): void {
  isPinned = !isPinned;

  const pinButton = document.querySelector<HTMLElement>('.pin-button');
  if (pinButton) {
    pinButton.classList.toggle('pinned', isPinned);
  }

  // body にピン固定クラスを付与（CSSで制御）
  document.body.classList.toggle('pinned', isPinned);
}

/**
 * ピンボタンのイベントリスナー（イベント委譲）
 */
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  if (target.closest('.pin-button')) {
    togglePin();
  }
});

// 初期化
initializeWebviews();
setupResizeObserver();
