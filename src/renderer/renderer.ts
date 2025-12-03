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

// ストレージキー
const STORAGE_KEY_LAYOUT = 'layout';
const STORAGE_KEY_PINNED = 'pinned';

const mainView = document.querySelector<HTMLElement>('.main-view');
const subViews = document.querySelector<HTMLElement>('.sub-views');

// ピン固定状態
let isPinned = false;

/**
 * Electron API の型定義
 */
interface ElectronAPI {
  getConfig: (key: string) => Promise<unknown>;
  setConfig: (key: string, value: unknown) => Promise<void>;
}

// Window オブジェクトの api を参照
const api: ElectronAPI = (window as unknown as { api: ElectronAPI }).api;

/**
 * レイアウト設定の型定義
 */
interface LayoutConfig {
  mainSns: string;
  secondarySns: string;
  subSnsOrder: string[];
}

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
 * デスクトップ版・モバイル版ともにパネルサイズに合わせてズーム調整
 */
function adjustWebviewZoom(webview: WebviewTag, isDesktop: boolean): void {
  const rect = webview.getBoundingClientRect();

  if (isDesktop) {
    // デスクトップ版: パネルサイズに合わせてズーム調整
    const zoomByWidth = rect.width / DESKTOP_VIEWPORT_WIDTH;
    const zoomByHeight = rect.height / DESKTOP_VIEWPORT_HEIGHT;
    const zoomFactor = Math.min(zoomByWidth, zoomByHeight);
    // ズームファクターを適用（最小 0.5、最大 2.0）
    const clampedZoom = Math.max(0.5, Math.min(2.0, zoomFactor));
    webview.setZoomFactor(clampedZoom);
    return;
  }

  // モバイル版: 幅と高さの両方を考慮し、コンテンツが収まる最小のズームを使用
  const zoomByWidth = rect.width / MOBILE_VIEWPORT_WIDTH;
  const zoomByHeight = rect.height / MOBILE_VIEWPORT_HEIGHT;

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
 * 現在のレイアウトを保存する
 */
function saveLayout(): void {
  if (!mainView || !subViews) return;

  const mainPanel = mainView.querySelector<HTMLElement>('.main-panel');
  const mainSns = mainPanel?.dataset.sns || '';

  const secondaryPanel = mainView.querySelector<HTMLElement>('.secondary-panel');
  const secondarySns = secondaryPanel?.dataset.sns || '';

  const subPanels = subViews.querySelectorAll<HTMLElement>('.sub-panel');
  const subSnsOrder = Array.from(subPanels).map((panel) => panel.dataset.sns || '');

  const config: LayoutConfig = { mainSns, secondarySns, subSnsOrder };
  api.setConfig(STORAGE_KEY_LAYOUT, config);
}

/**
 * 保存されたレイアウトを復元する
 */
async function restoreLayout(): Promise<void> {
  if (!mainView || !subViews) return;

  const config = (await api.getConfig(STORAGE_KEY_LAYOUT)) as LayoutConfig | undefined;
  if (!config) return;

  try {
    // 現在のメインパネルとセカンダリパネルを取得
    const currentMainPanel = mainView.querySelector<HTMLElement>('.main-panel');
    const currentSecondaryPanel = mainView.querySelector<HTMLElement>('.secondary-panel');
    if (!currentMainPanel) return;

    const currentMainSns = currentMainPanel.dataset.sns;
    const currentSecondarySns = currentSecondaryPanel?.dataset.sns;

    // セカンダリパネルとメインパネルの入れ替えが必要な場合
    if (config.secondarySns && currentSecondarySns !== config.secondarySns) {
      // セカンダリがメインになるべき場合
      if (currentSecondarySns === config.mainSns && currentMainSns === config.secondarySns) {
        // クラスを入れ替え
        if (currentSecondaryPanel) {
          currentMainPanel.classList.remove('main-panel');
          currentMainPanel.classList.add('secondary-panel');
          currentSecondaryPanel.classList.remove('secondary-panel');
          currentSecondaryPanel.classList.add('main-panel');
        }
      }
    }

    // メインパネルがサブパネルからの昇格が必要な場合
    if (currentMainSns !== config.mainSns && currentSecondarySns !== config.mainSns) {
      const targetPanel = document.querySelector<HTMLElement>(`[data-sns="${config.mainSns}"]`);
      if (targetPanel && targetPanel.classList.contains('sub-panel')) {
        // webview のクラスを入れ替え
        const mainWebview = currentMainPanel.querySelector<WebviewTag>('.webview');
        const subWebview = targetPanel.querySelector<WebviewTag>('.webview');

        if (mainWebview && subWebview) {
          mainWebview.classList.remove('webview-desktop');
          mainWebview.classList.add('webview-mobile');
          mainWebview.setUserAgent(MOBILE_USER_AGENT);

          subWebview.classList.remove('webview-mobile');
          subWebview.classList.add('webview-desktop');
          subWebview.setUserAgent('');
        }

        // パネルのクラスを入れ替え
        currentMainPanel.classList.remove('main-panel');
        currentMainPanel.classList.add('sub-panel');
        targetPanel.classList.remove('sub-panel');
        targetPanel.classList.add('main-panel');

        // DOM を移動
        const subPanelIndex = Array.from(subViews.children).indexOf(targetPanel);
        mainView.appendChild(targetPanel);

        if (subPanelIndex >= 0 && subPanelIndex < subViews.children.length) {
          subViews.insertBefore(currentMainPanel, subViews.children[subPanelIndex]);
        } else {
          subViews.appendChild(currentMainPanel);
        }
      }
    }

    // サブパネルの順序を復元
    config.subSnsOrder.forEach((sns) => {
      const panel = subViews.querySelector<HTMLElement>(`[data-sns="${sns}"]`);
      if (panel) {
        subViews.appendChild(panel);
      }
    });
  } catch (e) {
    console.error('Failed to restore layout:', e);
  }
}

/**
 * ピン止め状態を保存する
 */
function savePinnedState(): void {
  api.setConfig(STORAGE_KEY_PINNED, isPinned);
}

/**
 * ピン止め状態を復元する
 */
async function restorePinnedState(): Promise<void> {
  const pinned = await api.getConfig(STORAGE_KEY_PINNED);
  if (pinned) {
    isPinned = true;
    const pinButton = document.querySelector<HTMLElement>('.pin-button');
    if (pinButton) {
      pinButton.classList.add('pinned');
    }
    document.body.classList.add('pinned');
  }
}

/**
 * プレースホルダーを作成する
 */
function createPlaceholder(element: HTMLElement): HTMLElement {
  const placeholder = document.createElement('div');
  placeholder.className = 'swap-placeholder';
  const rect = element.getBoundingClientRect();
  placeholder.style.width = `${rect.width}px`;
  placeholder.style.height = `${rect.height}px`;
  placeholder.style.flexShrink = '0';
  return placeholder;
}

/**
 * セカンダリパネルとメインパネルを入れ替える
 */
function swapWithSecondary(secondaryPanel: HTMLElement): void {
  // ピン固定時は切り替え無効
  if (isPinned) return;
  if (!mainView) return;

  const mainPanel = mainView.querySelector<HTMLElement>('.main-panel');
  if (!mainPanel) return;

  const mainWebview = mainPanel.querySelector<WebviewTag>('.webview');
  const secondaryWebview = secondaryPanel.querySelector<WebviewTag>('.webview');

  // プレースホルダーを作成（入れ替え後のサイズで）
  const mainPlaceholder = createPlaceholder(secondaryPanel); // メインの位置にセカンダリサイズ
  const secondaryPlaceholder = createPlaceholder(mainPanel); // セカンダリの位置にメインサイズ

  // パネルを非表示にしてプレースホルダーに置き換え
  mainView.insertBefore(mainPlaceholder, mainPanel);
  mainView.insertBefore(secondaryPlaceholder, secondaryPanel);
  mainPanel.style.display = 'none';
  secondaryPanel.style.display = 'none';

  // クラスを入れ替え
  mainPanel.classList.remove('main-panel');
  mainPanel.classList.add('secondary-panel');
  secondaryPanel.classList.remove('secondary-panel');
  secondaryPanel.classList.add('main-panel');

  // webview のクラスを入れ替え
  if (mainWebview && secondaryWebview) {
    mainWebview.classList.remove('webview-desktop');
    mainWebview.classList.add('webview-mobile');
    mainWebview.setUserAgent(MOBILE_USER_AGENT);

    secondaryWebview.classList.remove('webview-mobile');
    secondaryWebview.classList.add('webview-desktop');
    secondaryWebview.setUserAgent('');
  }

  // DOM 位置を入れ替え（プレースホルダーの位置に）
  mainPlaceholder.replaceWith(secondaryPanel);
  secondaryPlaceholder.replaceWith(mainPanel);

  // パネルを再表示
  mainPanel.style.display = '';
  secondaryPanel.style.display = '';

  // webview をリロードしてズームを再調整
  if (mainWebview && secondaryWebview) {
    mainWebview.reload();
    secondaryWebview.reload();

    setTimeout(() => {
      adjustWebviewZoom(mainWebview, false);
      adjustWebviewZoom(secondaryWebview, true);
    }, 100);
  }

  // レイアウトを保存
  saveLayout();
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

  // セカンダリパネルを取得（メインパネルの後ろにある）
  const secondaryPanel = mainView.querySelector<HTMLElement>('.secondary-panel');

  // メインビューにクリックされたパネルを移動（セカンダリパネルの前に挿入）
  if (secondaryPanel) {
    mainView.insertBefore(clickedSubPanel, secondaryPanel);
  } else {
    mainView.appendChild(clickedSubPanel);
  }

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

  // レイアウトを保存
  saveLayout();
}

/**
 * イベント委譲でパネルのヘッダークリックを処理
 * document レベルで捕捉することで DOM 移動後も正しく動作
 */
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  // ヘッダー部分のクリックのみ入れ替えを実行
  const header = target.closest<HTMLElement>('.panel-header');
  if (!header) return;

  // サブパネルのヘッダークリック
  const subPanel = target.closest<HTMLElement>('.sub-panel');
  if (subPanel) {
    swapPanels(subPanel);
    return;
  }

  // セカンダリパネルのヘッダークリック
  const secondaryPanel = target.closest<HTMLElement>('.secondary-panel');
  if (secondaryPanel) {
    swapWithSecondary(secondaryPanel);
    return;
  }
});

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

  // ピン止め状態を保存
  savePinnedState();
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
async function initialize(): Promise<void> {
  await restoreLayout();
  await restorePinnedState();
  initializeWebviews();
  setupResizeObserver();
}

initialize();
