/**
 * 用户偏好 store（持久化）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 持久化到 uni.storage；Vitest 环境（无 uni）下退化为内存存储。
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

/** 用户偏好字段 */
export interface Settings {
  /** 默认色板 id */
  defaultPaletteId: string;
  /** 默认网格尺寸（每边格子数） */
  defaultGridSize: number;
  /** 导出图纸时是否带色号标注 */
  showColorCode: boolean;
  /** 导出倍率（1=原始 1 颗豆子 = 1px；2=1 颗 = 2px） */
  exportScale: 1 | 2;
  /** 抖动算法开关 */
  ditheringEnabled: boolean;
  /** 背景移除开关 */
  removeBackground: boolean;
  /** 立体豆子视觉（中心高光 + 暗边） */
  bead3DEnabled: boolean;
  /** 透明背景导出（PNG 保留 alpha 通道） */
  transparentBackground: boolean;
  /** 主题：light | dark | auto */
  theme: 'light' | 'dark' | 'auto';
  /** 对比模式：同时显示原图与拼豆图纸 */
  compareMode: boolean;
  /** 图像增强总开关（白平衡 + 对比度 + 锐化） */
  imageEnhancement: boolean;
  /** 语言：zh-CN | en-US */
  locale: 'zh-CN' | 'en-US';
}

const STORAGE_KEY = 'pindou:settings';

function loadFromStorage(): Partial<Settings> {
  if (typeof uni === 'undefined') return {};
  try {
    const raw = uni.getStorageSync(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw as string) as Partial<Settings>;
  } catch {
    return {};
  }
}

function saveToStorage(s: Settings): void {
  if (typeof uni === 'undefined') return;
  try {
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = loadFromStorage();

  const defaultPaletteId = ref<string>(initial.defaultPaletteId ?? 'mard');
  const defaultGridSize = ref<number>(initial.defaultGridSize ?? 50);
  const showColorCode = ref<boolean>(initial.showColorCode ?? true);
  const exportScale = ref<1 | 2>(initial.exportScale ?? 2);
  const ditheringEnabled = ref<boolean>(initial.ditheringEnabled ?? false);
  const removeBackground = ref<boolean>(initial.removeBackground ?? false);
  const bead3DEnabled = ref<boolean>(initial.bead3DEnabled ?? false);
  const transparentBackground = ref<boolean>(initial.transparentBackground ?? false);
  const theme = ref<'light' | 'dark' | 'auto'>(initial.theme ?? 'auto');
  const compareMode = ref<boolean>(initial.compareMode ?? false);
  const imageEnhancement = ref<boolean>(initial.imageEnhancement ?? false);
  const locale = ref<'zh-CN' | 'en-US'>((initial.locale as 'zh-CN' | 'en-US') ?? 'zh-CN');

  function snapshot(): Settings {
    return {
      defaultPaletteId: defaultPaletteId.value,
      defaultGridSize: defaultGridSize.value,
      showColorCode: showColorCode.value,
      exportScale: exportScale.value,
      ditheringEnabled: ditheringEnabled.value,
      removeBackground: removeBackground.value,
      bead3DEnabled: bead3DEnabled.value,
      transparentBackground: transparentBackground.value,
      theme: theme.value,
      compareMode: compareMode.value,
      imageEnhancement: imageEnhancement.value,
      locale: locale.value,
    };
  }

  function persist(): void {
    saveToStorage(snapshot());
  }

  function setDefaultPalette(id: string): void {
    defaultPaletteId.value = id;
    persist();
  }

  function setDefaultGridSize(size: number): void {
    const clamped = Math.max(20, Math.min(100, size));
    defaultGridSize.value = clamped;
    persist();
  }

  function setShowColorCode(show: boolean): void {
    showColorCode.value = show;
    persist();
  }

  function setExportScale(scale: 1 | 2): void {
    exportScale.value = scale;
    persist();
  }

  function setDitheringEnabled(enabled: boolean): void {
    ditheringEnabled.value = enabled;
    persist();
  }

  function setRemoveBackground(enabled: boolean): void {
    removeBackground.value = enabled;
    persist();
  }

  function setBead3DEnabled(enabled: boolean): void {
    bead3DEnabled.value = enabled;
    persist();
  }

  function setTransparentBackground(enabled: boolean): void {
    transparentBackground.value = enabled;
    persist();
  }

  function setTheme(value: 'light' | 'dark' | 'auto'): void {
    theme.value = value;
    persist();
  }

  function setCompareMode(enabled: boolean): void {
    compareMode.value = enabled;
    persist();
  }

  function setImageEnhancement(enabled: boolean): void {
    imageEnhancement.value = enabled;
    persist();
  }

  function setLocale(value: 'zh-CN' | 'en-US'): void {
    locale.value = value;
    persist();
  }

  function reset(): void {
    defaultPaletteId.value = 'mard';
    defaultGridSize.value = 50;
    showColorCode.value = true;
    exportScale.value = 2;
    ditheringEnabled.value = false;
    removeBackground.value = false;
    bead3DEnabled.value = false;
    transparentBackground.value = false;
    theme.value = 'auto';
    compareMode.value = false;
    imageEnhancement.value = false;
    locale.value = 'zh-CN';
    persist();
  }

  return {
    defaultPaletteId,
    defaultGridSize,
    showColorCode,
    exportScale,
    ditheringEnabled,
    removeBackground,
    bead3DEnabled,
    transparentBackground,
    theme,
    compareMode,
    imageEnhancement,
    locale,
    setDefaultPalette,
    setDefaultGridSize,
    setShowColorCode,
    setExportScale,
    setDitheringEnabled,
    setRemoveBackground,
    setBead3DEnabled,
    setTransparentBackground,
    setTheme,
    setCompareMode,
    setImageEnhancement,
    setLocale,
    reset,
  };
});
