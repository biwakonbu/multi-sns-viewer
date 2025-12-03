/**
 * レンダラーユーティリティ関数
 * DOM操作を含まない純粋な計算ロジックを分離
 */

// デスクトップ版の想定サイズ（一般的なデスクトップサイト）
export const DESKTOP_VIEWPORT_WIDTH = 1280;
export const DESKTOP_VIEWPORT_HEIGHT = 720;

// モバイル版の想定サイズ（iPhone 14 Pro の論理サイズ）
export const MOBILE_VIEWPORT_WIDTH = 393;
export const MOBILE_VIEWPORT_HEIGHT = 852;

// モバイル版 User-Agent（iPhone Safari）
export const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// ストレージキー
export const STORAGE_KEY_LAYOUT = 'layout';
export const STORAGE_KEY_PINNED = 'pinned';

/**
 * レイアウト設定の型定義
 * slots[0] = メイン, slots[1] = セカンダリ, slots[2..] = サブ
 */
export interface LayoutConfig {
  slots: string[];
}

/**
 * ズームファクターの計算結果
 */
export interface ZoomCalculation {
  zoomFactor: number;
  clampedZoom: number;
}

/**
 * デスクトップ版のズームファクターを計算
 * @param panelWidth パネルの幅
 * @param panelHeight パネルの高さ
 * @returns ズーム計算結果
 */
export function calculateDesktopZoom(panelWidth: number, panelHeight: number): ZoomCalculation {
  const zoomByWidth = panelWidth / DESKTOP_VIEWPORT_WIDTH;
  const zoomByHeight = panelHeight / DESKTOP_VIEWPORT_HEIGHT;
  const zoomFactor = Math.min(zoomByWidth, zoomByHeight);
  // ズームファクターを適用（最小 0.5、最大 2.0）
  const clampedZoom = Math.max(0.5, Math.min(2.0, zoomFactor));
  return { zoomFactor, clampedZoom };
}

/**
 * モバイル版のズームファクターを計算
 * @param panelWidth パネルの幅
 * @param panelHeight パネルの高さ
 * @returns ズーム計算結果
 */
export function calculateMobileZoom(panelWidth: number, panelHeight: number): ZoomCalculation {
  const zoomByWidth = panelWidth / MOBILE_VIEWPORT_WIDTH;
  const zoomByHeight = panelHeight / MOBILE_VIEWPORT_HEIGHT;
  // 小さい方を採用（コンテンツ全体が収まるように）
  const zoomFactor = Math.min(zoomByWidth, zoomByHeight);
  // ズームファクターを適用（最小 0.25、最大 1.0）
  const clampedZoom = Math.max(0.25, Math.min(1.0, zoomFactor));
  return { zoomFactor, clampedZoom };
}

/**
 * レイアウト設定が有効かどうかを検証
 * @param config レイアウト設定
 * @returns 有効な場合 true
 */
export function isValidLayoutConfig(config: unknown): config is LayoutConfig {
  if (!config || typeof config !== 'object') return false;
  const c = config as Record<string, unknown>;
  if (!Array.isArray(c.slots)) return false;
  if (c.slots.length === 0) return false;
  return c.slots.every((slot) => typeof slot === 'string');
}

/**
 * スロットインデックスからパネルタイプを取得
 * @param index スロットインデックス
 * @returns パネルタイプ
 */
export function getPanelTypeByIndex(index: number): 'main' | 'secondary' | 'sub' {
  if (index === 0) return 'main';
  if (index === 1) return 'secondary';
  return 'sub';
}

/**
 * パネルタイプからwebviewクラスを取得
 * @param panelType パネルタイプ
 * @returns webviewクラス名
 */
export function getWebviewClassByPanelType(panelType: 'main' | 'secondary' | 'sub'): string {
  return panelType === 'main' ? 'webview-desktop' : 'webview-mobile';
}

/**
 * パネルタイプからパネルクラスを取得
 * @param panelType パネルタイプ
 * @returns パネルクラス名
 */
export function getPanelClassByType(panelType: 'main' | 'secondary' | 'sub'): string {
  return `${panelType}-panel`;
}
