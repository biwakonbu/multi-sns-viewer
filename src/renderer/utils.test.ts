import { describe, it, expect } from 'vitest';
import {
  calculateDesktopZoom,
  calculateMobileZoom,
  isValidLayoutConfig,
  isValidZoomConfig,
  isValidVolumeConfig,
  getPanelTypeByIndex,
  getWebviewClassByPanelType,
  getPanelClassByType,
  clampZoom,
  clampVolume,
  formatZoomPercent,
  formatVolumePercent,
  getVolumeIcon,
  DESKTOP_VIEWPORT_WIDTH,
  DESKTOP_VIEWPORT_HEIGHT,
  MOBILE_VIEWPORT_WIDTH,
  MOBILE_VIEWPORT_HEIGHT,
  ZOOM_MIN,
  ZOOM_MAX,
  VOLUME_MIN,
  VOLUME_MAX,
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

describe('isValidZoomConfig', () => {
  it('有効なズーム設定を受け入れる', () => {
    expect(isValidZoomConfig({ youtube: 1.0, tiktok: 1.5 })).toBe(true);
  });

  it('空のオブジェクトを受け入れる', () => {
    expect(isValidZoomConfig({})).toBe(true);
  });

  it('nullを拒否する', () => {
    expect(isValidZoomConfig(null)).toBe(false);
  });

  it('undefinedを拒否する', () => {
    expect(isValidZoomConfig(undefined)).toBe(false);
  });

  it('数値以外の値を含む場合を拒否する', () => {
    expect(isValidZoomConfig({ youtube: '1.0' })).toBe(false);
  });
});

describe('isValidVolumeConfig', () => {
  it('有効な音量設定を受け入れる', () => {
    expect(isValidVolumeConfig({ youtube: 0.5, tiktok: 1.0 })).toBe(true);
  });

  it('空のオブジェクトを受け入れる', () => {
    expect(isValidVolumeConfig({})).toBe(true);
  });

  it('nullを拒否する', () => {
    expect(isValidVolumeConfig(null)).toBe(false);
  });

  it('数値以外の値を含む場合を拒否する', () => {
    expect(isValidVolumeConfig({ youtube: 'muted' })).toBe(false);
  });
});

describe('clampZoom', () => {
  it('範囲内の値はそのまま返す', () => {
    expect(clampZoom(1.0)).toBe(1.0);
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it('最小値未満の場合は最小値を返す', () => {
    expect(clampZoom(0.1)).toBe(ZOOM_MIN);
    expect(clampZoom(-1)).toBe(ZOOM_MIN);
  });

  it('最大値を超える場合は最大値を返す', () => {
    expect(clampZoom(3.0)).toBe(ZOOM_MAX);
    expect(clampZoom(10)).toBe(ZOOM_MAX);
  });
});

describe('clampVolume', () => {
  it('範囲内の値はそのまま返す', () => {
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(0)).toBe(0);
    expect(clampVolume(1)).toBe(1);
  });

  it('最小値未満の場合は最小値を返す', () => {
    expect(clampVolume(-0.1)).toBe(VOLUME_MIN);
    expect(clampVolume(-1)).toBe(VOLUME_MIN);
  });

  it('最大値を超える場合は最大値を返す', () => {
    expect(clampVolume(1.5)).toBe(VOLUME_MAX);
    expect(clampVolume(10)).toBe(VOLUME_MAX);
  });
});

describe('formatZoomPercent', () => {
  it('1.0を100%に変換する', () => {
    expect(formatZoomPercent(1.0)).toBe('100%');
  });

  it('1.5を150%に変換する', () => {
    expect(formatZoomPercent(1.5)).toBe('150%');
  });

  it('0.5を50%に変換する', () => {
    expect(formatZoomPercent(0.5)).toBe('50%');
  });

  it('小数点以下を四捨五入する', () => {
    expect(formatZoomPercent(0.555)).toBe('56%');
    expect(formatZoomPercent(0.554)).toBe('55%');
  });
});

describe('formatVolumePercent', () => {
  it('1.0を100%に変換する', () => {
    expect(formatVolumePercent(1.0)).toBe('100%');
  });

  it('0.5を50%に変換する', () => {
    expect(formatVolumePercent(0.5)).toBe('50%');
  });

  it('0を0%に変換する', () => {
    expect(formatVolumePercent(0)).toBe('0%');
  });
});

describe('getVolumeIcon', () => {
  it('音量0はミュートアイコンを返す', () => {
    expect(getVolumeIcon(0)).toBe('🔇');
  });

  it('音量0.3未満は小音量アイコンを返す', () => {
    expect(getVolumeIcon(0.1)).toBe('🔈');
    expect(getVolumeIcon(0.29)).toBe('🔈');
  });

  it('音量0.3〜0.7未満は中音量アイコンを返す', () => {
    expect(getVolumeIcon(0.3)).toBe('🔉');
    expect(getVolumeIcon(0.5)).toBe('🔉');
    expect(getVolumeIcon(0.69)).toBe('🔉');
  });

  it('音量0.7以上は大音量アイコンを返す', () => {
    expect(getVolumeIcon(0.7)).toBe('🔊');
    expect(getVolumeIcon(1.0)).toBe('🔊');
  });
});
