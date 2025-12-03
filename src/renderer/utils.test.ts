import { describe, it, expect } from 'vitest';
import {
  calculateDesktopZoom,
  calculateMobileZoom,
  isValidLayoutConfig,
  getPanelTypeByIndex,
  getWebviewClassByPanelType,
  getPanelClassByType,
  DESKTOP_VIEWPORT_WIDTH,
  DESKTOP_VIEWPORT_HEIGHT,
  MOBILE_VIEWPORT_WIDTH,
  MOBILE_VIEWPORT_HEIGHT,
} from './utils';

describe('calculateDesktopZoom', () => {
  it('パネルサイズがビューポートと同じ場合、ズームファクター1.0を返す', () => {
    const result = calculateDesktopZoom(DESKTOP_VIEWPORT_WIDTH, DESKTOP_VIEWPORT_HEIGHT);
    expect(result.zoomFactor).toBe(1.0);
    expect(result.clampedZoom).toBe(1.0);
  });

  it('パネルサイズがビューポートの2倍の場合、ズームファクター2.0を返す', () => {
    const result = calculateDesktopZoom(DESKTOP_VIEWPORT_WIDTH * 2, DESKTOP_VIEWPORT_HEIGHT * 2);
    expect(result.zoomFactor).toBe(2.0);
    expect(result.clampedZoom).toBe(2.0);
  });

  it('パネルサイズがビューポートの半分の場合、ズームファクター0.5を返す', () => {
    const result = calculateDesktopZoom(DESKTOP_VIEWPORT_WIDTH / 2, DESKTOP_VIEWPORT_HEIGHT / 2);
    expect(result.zoomFactor).toBe(0.5);
    expect(result.clampedZoom).toBe(0.5);
  });

  it('ズームファクターが0.5未満の場合、0.5にクランプされる', () => {
    const result = calculateDesktopZoom(DESKTOP_VIEWPORT_WIDTH / 4, DESKTOP_VIEWPORT_HEIGHT / 4);
    expect(result.zoomFactor).toBe(0.25);
    expect(result.clampedZoom).toBe(0.5);
  });

  it('ズームファクターが2.0を超える場合、2.0にクランプされる', () => {
    const result = calculateDesktopZoom(DESKTOP_VIEWPORT_WIDTH * 3, DESKTOP_VIEWPORT_HEIGHT * 3);
    expect(result.zoomFactor).toBe(3.0);
    expect(result.clampedZoom).toBe(2.0);
  });

  it('幅と高さの比率が異なる場合、小さい方が採用される', () => {
    // 幅は2倍、高さは等倍 -> 高さ基準でズーム1.0
    const result = calculateDesktopZoom(DESKTOP_VIEWPORT_WIDTH * 2, DESKTOP_VIEWPORT_HEIGHT);
    expect(result.zoomFactor).toBe(1.0);
    expect(result.clampedZoom).toBe(1.0);
  });
});

describe('calculateMobileZoom', () => {
  it('パネルサイズがビューポートと同じ場合、ズームファクター1.0を返す', () => {
    const result = calculateMobileZoom(MOBILE_VIEWPORT_WIDTH, MOBILE_VIEWPORT_HEIGHT);
    expect(result.zoomFactor).toBe(1.0);
    expect(result.clampedZoom).toBe(1.0);
  });

  it('パネルサイズがビューポートの半分の場合、ズームファクター0.5を返す', () => {
    const result = calculateMobileZoom(MOBILE_VIEWPORT_WIDTH / 2, MOBILE_VIEWPORT_HEIGHT / 2);
    expect(result.zoomFactor).toBe(0.5);
    expect(result.clampedZoom).toBe(0.5);
  });

  it('ズームファクターが0.25未満の場合、0.25にクランプされる', () => {
    const result = calculateMobileZoom(MOBILE_VIEWPORT_WIDTH / 8, MOBILE_VIEWPORT_HEIGHT / 8);
    expect(result.zoomFactor).toBe(0.125);
    expect(result.clampedZoom).toBe(0.25);
  });

  it('ズームファクターが1.0を超える場合、1.0にクランプされる', () => {
    const result = calculateMobileZoom(MOBILE_VIEWPORT_WIDTH * 2, MOBILE_VIEWPORT_HEIGHT * 2);
    expect(result.zoomFactor).toBe(2.0);
    expect(result.clampedZoom).toBe(1.0);
  });
});

describe('isValidLayoutConfig', () => {
  it('有効なレイアウト設定を受け入れる', () => {
    expect(isValidLayoutConfig({ slots: ['youtube', 'tiktok', 'x'] })).toBe(true);
  });

  it('空のスロット配列を拒否する', () => {
    expect(isValidLayoutConfig({ slots: [] })).toBe(false);
  });

  it('nullを拒否する', () => {
    expect(isValidLayoutConfig(null)).toBe(false);
  });

  it('undefinedを拒否する', () => {
    expect(isValidLayoutConfig(undefined)).toBe(false);
  });

  it('スロットがない場合を拒否する', () => {
    expect(isValidLayoutConfig({})).toBe(false);
  });

  it('スロットが配列でない場合を拒否する', () => {
    expect(isValidLayoutConfig({ slots: 'youtube' })).toBe(false);
  });

  it('スロットに文字列以外が含まれる場合を拒否する', () => {
    expect(isValidLayoutConfig({ slots: ['youtube', 123, 'x'] })).toBe(false);
  });
});

describe('getPanelTypeByIndex', () => {
  it('インデックス0はmainを返す', () => {
    expect(getPanelTypeByIndex(0)).toBe('main');
  });

  it('インデックス1はsecondaryを返す', () => {
    expect(getPanelTypeByIndex(1)).toBe('secondary');
  });

  it('インデックス2以上はsubを返す', () => {
    expect(getPanelTypeByIndex(2)).toBe('sub');
    expect(getPanelTypeByIndex(3)).toBe('sub');
    expect(getPanelTypeByIndex(10)).toBe('sub');
  });
});

describe('getWebviewClassByPanelType', () => {
  it('mainはwebview-desktopを返す', () => {
    expect(getWebviewClassByPanelType('main')).toBe('webview-desktop');
  });

  it('secondaryはwebview-mobileを返す', () => {
    expect(getWebviewClassByPanelType('secondary')).toBe('webview-mobile');
  });

  it('subはwebview-mobileを返す', () => {
    expect(getWebviewClassByPanelType('sub')).toBe('webview-mobile');
  });
});

describe('getPanelClassByType', () => {
  it('mainはmain-panelを返す', () => {
    expect(getPanelClassByType('main')).toBe('main-panel');
  });

  it('secondaryはsecondary-panelを返す', () => {
    expect(getPanelClassByType('secondary')).toBe('secondary-panel');
  });

  it('subはsub-panelを返す', () => {
    expect(getPanelClassByType('sub')).toBe('sub-panel');
  });
});
