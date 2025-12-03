/**
 * レンダラープロセス
 * パネルの切り替えと webview のエラーハンドリング
 */

const mainView = document.querySelector<HTMLElement>('.main-view');
const subViews = document.querySelector<HTMLElement>('.sub-views');
const webviews = document.querySelectorAll<HTMLElement>('.webview');

/**
 * サブパネルとメインパネルを入れ替える
 */
function swapPanels(clickedPanel: HTMLElement): void {
  if (!mainView || !subViews) return;

  const currentMainPanel = mainView.querySelector<HTMLElement>('.main-panel');
  if (!currentMainPanel) return;

  // クラスの入れ替え
  currentMainPanel.classList.remove('main-panel');
  currentMainPanel.classList.add('sub-panel');
  clickedPanel.classList.remove('sub-panel');
  clickedPanel.classList.add('main-panel');

  // サブパネルの位置を記録
  const subPanelIndex = Array.from(subViews.children).indexOf(clickedPanel);

  // メインビューにクリックされたパネルを移動
  mainView.appendChild(clickedPanel);

  // 元のメインパネルをサブビューに挿入（元の位置に）
  if (subPanelIndex >= 0 && subPanelIndex < subViews.children.length) {
    subViews.insertBefore(currentMainPanel, subViews.children[subPanelIndex]);
  } else {
    subViews.appendChild(currentMainPanel);
  }
}

/**
 * イベント委譲でサブパネルのクリックを処理
 */
if (subViews) {
  subViews.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const subPanel = target.closest<HTMLElement>('.sub-panel');
    if (subPanel) {
      swapPanels(subPanel);
    }
  });
}

/**
 * webview のエラーハンドリング
 */
webviews.forEach((webview) => {
  webview.addEventListener('did-fail-load', (event) => {
    console.error('Webview failed to load:', event);
  });
});
