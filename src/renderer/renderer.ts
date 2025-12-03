/**
 * レンダラープロセス
 * パネルの切り替え、webview の User-Agent 設定、ズーム調整
 */

import {
  MOBILE_USER_AGENT,
  MOBILE_VIEWPORT_WIDTH,
  STORAGE_KEY_LAYOUT,
  STORAGE_KEY_PINNED,
  calculateDesktopZoom,
  calculateMobileZoom,
  isValidLayoutConfig,
  getPanelTypeByIndex,
  getWebviewClassByPanelType,
  getPanelClassByType,
} from './utils';

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

// Window オブジェクトの electronAPI を参照
const api: ElectronAPI = (window as unknown as { electronAPI: ElectronAPI }).electronAPI;

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
  const { clampedZoom } = isDesktop
    ? calculateDesktopZoom(rect.width, rect.height)
    : calculateMobileZoom(rect.width, rect.height);
  webview.setZoomFactor(clampedZoom);
}

/**
 * すべての webview を初期化する
 * dom-ready イベント後に各種設定を行う
 */
function initializeWebviews(): void {
  // すべての webview に対して dom-ready イベントを設定
  const allWebviews = document.querySelectorAll<WebviewTag>('.webview');
  allWebviews.forEach((webview) => {
    webview.addEventListener('dom-ready', () => {
      const isDesktop = webview.classList.contains('webview-desktop');

      if (!isDesktop) {
        // モバイル版: User-Agent を設定（dom-ready 後に呼び出す）
        webview.setUserAgent(MOBILE_USER_AGENT);

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
      }

      // ズーム調整
      adjustWebviewZoom(webview, isDesktop);
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
 * ピンボタンを現在のメインパネルに移動する
 */
function movePinButtonToMainPanel(): void {
  const pinButton = document.querySelector<HTMLElement>('.pin-button');
  const mainPanel = document.querySelector<HTMLElement>('.main-panel');
  if (pinButton && mainPanel && pinButton.parentElement !== mainPanel) {
    mainPanel.insertBefore(pinButton, mainPanel.firstChild);
  }
}

/**
 * 現在のレイアウトを保存する
 * slots[0] = メイン, slots[1] = セカンダリ, slots[2..] = サブ
 */
async function saveLayout(): Promise<void> {
  if (!mainView || !subViews) return;

  const slots: string[] = [];

  // メイン
  const mainPanel = mainView.querySelector<HTMLElement>('.main-panel');
  slots.push(mainPanel?.dataset.sns || '');

  // セカンダリ
  const secondaryPanel = mainView.querySelector<HTMLElement>('.secondary-panel');
  slots.push(secondaryPanel?.dataset.sns || '');

  // サブ
  const subPanels = subViews.querySelectorAll<HTMLElement>('.sub-panel');
  subPanels.forEach((panel) => slots.push(panel.dataset.sns || ''));

  console.log('Saving layout:', slots);
  await api.setConfig(STORAGE_KEY_LAYOUT, { slots });
}

/**
 * 保存されたレイアウトを復元する
 */
async function restoreLayout(): Promise<void> {
  if (!mainView || !subViews) return;

  const config = await api.getConfig(STORAGE_KEY_LAYOUT);
  console.log('Restoring layout:', config);
  if (!isValidLayoutConfig(config)) return;

  try {
    // SNS名からパネルを取得するマップ
    const panelMap = new Map<string, HTMLElement>();
    document.querySelectorAll<HTMLElement>('[data-sns]').forEach((panel) => {
      if (panel.dataset.sns) panelMap.set(panel.dataset.sns, panel);
    });

    // 全パネルのクラスをリセット
    panelMap.forEach((panel) => {
      panel.classList.remove('main-panel', 'secondary-panel', 'sub-panel');
      const webview = panel.querySelector<WebviewTag>('.webview');
      if (webview) {
        webview.classList.remove('webview-desktop', 'webview-mobile');
      }
    });

    // スロット順にパネルを配置
    config.slots.forEach((sns: string, index: number) => {
      const panel = panelMap.get(sns);
      if (!panel) return;

      const panelType = getPanelTypeByIndex(index);
      const panelClass = getPanelClassByType(panelType);
      const webviewClass = getWebviewClassByPanelType(panelType);
      const webview = panel.querySelector<WebviewTag>('.webview');

      panel.classList.add(panelClass);
      if (webview) {
        webview.classList.add(webviewClass);
      }

      // DOM配置
      if (panelType === 'main') {
        mainView.insertBefore(panel, mainView.firstChild);
      } else if (panelType === 'secondary') {
        mainView.appendChild(panel);
      } else {
        subViews.appendChild(panel);
      }
    });

    // ピンボタンを新しいメインパネルに移動
    movePinButtonToMainPanel();
  } catch (e) {
    console.error('Failed to restore layout:', e);
  }
}

/**
 * ピン止め状態を保存する
 */
async function savePinnedState(): Promise<void> {
  await api.setConfig(STORAGE_KEY_PINNED, isPinned);
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
async function swapWithSecondary(secondaryPanel: HTMLElement): Promise<void> {
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

  // ピンボタンを新しいメインパネルに移動
  movePinButtonToMainPanel();

  // ズームを再調整
  if (mainWebview && secondaryWebview) {
    setTimeout(() => {
      adjustWebviewZoom(mainWebview, false);
      adjustWebviewZoom(secondaryWebview, true);
    }, 100);
  }

  // レイアウトを保存
  await saveLayout();
}

/**
 * サブパネルとメインパネルを入れ替える
 */
async function swapPanels(clickedSubPanel: HTMLElement): Promise<void> {
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

  // ピンボタンを新しいメインパネルに移動
  movePinButtonToMainPanel();

  // ズームを再調整
  setTimeout(() => {
    if (mainWebview) adjustWebviewZoom(mainWebview, false);
    if (subWebview) adjustWebviewZoom(subWebview, true);
  }, 100);

  // レイアウトを保存
  await saveLayout();
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
async function togglePin(): Promise<void> {
  isPinned = !isPinned;

  const pinButton = document.querySelector<HTMLElement>('.pin-button');
  if (pinButton) {
    pinButton.classList.toggle('pinned', isPinned);
  }

  // body にピン固定クラスを付与（CSSで制御）
  document.body.classList.toggle('pinned', isPinned);

  // ピン止め状態を保存
  await savePinnedState();
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
