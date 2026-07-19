/**
 * 色板管理 store
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * MVP 内置 4 个国产品牌色板：
 *   - MARD 漫漫（289 色）
 *   - COCO（291 色）
 *   - 盼盼（291 色）
 *   - 咪小窝（291 色）
 *
 * V2 计划：Perler / Hama / 自定义上传（需另外数据源）
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Palette } from '@/types/palette';
import { parsePalette } from '@/data/palettes/_schema';

import mardJson from '@/data/palettes/mard.json';
import cocoJson from '@/data/palettes/coco.json';
import panpanJson from '@/data/palettes/panpan.json';
import mixiaoJson from '@/data/palettes/mixiao.json';

/** 内置色板列表（启动时一次性解析） */
const BUILTIN_PALETTES: Record<string, Palette> = {
  mard: parsePalette(mardJson),
  coco: parsePalette(cocoJson),
  panpan: parsePalette(panpanJson),
  mixiao: parsePalette(mixiaoJson),
  perler: parsePalette(perlerJson),
  hama: parsePalette(hamaJson),
};

/** 默认色板 id */
const DEFAULT_ID = 'mard';

export const usePaletteStore = defineStore('palette', () => {
  /** 内置色板映射 */
  const builtIn = ref<Record<string, Palette>>({ ...BUILTIN_PALETTES });

  /** 自定义色板（V2 启用） */
  const custom = ref<Palette[]>([]);

  /** 当前激活的色板 id */
  const activeId = ref<string>(DEFAULT_ID);

  /** 当前激活的色板对象 */
  const active = computed<Palette>(() => {
    return builtIn.value[activeId.value] ?? custom.value.find((p) => p.id === activeId.value) ?? BUILTIN_PALETTES[DEFAULT_ID];
  });

  /** 当前色板的条目数（用于 UI 展示） */
  const activeEntryCount = computed<number>(() => active.value.entries.length);

  /** 所有可用色板列表（用于切换 UI） */
  function getAvailable(): Palette[] {
    return [...Object.values(builtIn.value), ...custom.value];
  }

  function setActive(id: string): boolean {
    if (builtIn.value[id] || custom.value.some((p) => p.id === id)) {
      activeId.value = id;
      return true;
    }
    return false;
  }

  function getPalette(id: string): Palette | null {
    return builtIn.value[id] ?? custom.value.find((p) => p.id === id) ?? null;
  }

  /** 添加自定义色板（V2 自定义导入功能） */
  function addCustom(p: Palette): void {
    custom.value = [...custom.value, p];
  }

  /** 删除自定义色板 */
  function removeCustom(id: string): void {
    custom.value = custom.value.filter((p) => p.id !== id);
    if (activeId.value === id) activeId.value = DEFAULT_ID;
  }

  return {
    builtIn,
    custom,
    activeId,
    active,
    activeEntryCount,
    getAvailable,
    setActive,
    getPalette,
    addCustom,
    removeCustom,
  };
});
