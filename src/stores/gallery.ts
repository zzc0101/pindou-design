/**
 * 图纸库 store（最近生成的图纸）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 用 uni.storage 持久化最近 N 张图纸。
 * V2 可扩展 IndexedDB（小程序 uni.storage 限制 10MB / 单 key 1MB）。
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { BeadGrid } from '@/types/bead';
import type { Palette } from '@/types/palette';
import { buildBeadGrid } from '@/core/grid-builder';
import { logger } from '@/utils/logger';

const STORAGE_KEY = 'pindou:gallery';
const MAX_ITEMS = 10;

export interface GalleryItem {
  /** 唯一 id（时间戳 + 随机） */
  id: string;
  /** 创建时间戳（ms） */
  createdAt: number;
  /** 缩略图（PNG base64，可选，不持久化 cells） */
  thumbnail?: string;
  /** 网格尺寸 */
  width: number;
  height: number;
  /** 使用的色数 */
  colorCount: number;
  /** 总豆子数 */
  totalBeads: number;
  /** 源图临时路径（可选） */
  sourcePath?: string;
  /** 色板名 */
  paletteName: string;
  /** cells 序列化（Uint16Array → base64） */
  cellsBase64: string;
  /** 色板 id */
  paletteId: string;
}

/** Uint8Array → base64 */
function uint8ToBase64(arr: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(arr).toString('base64');
  }
  // 浏览器 fallback（小程序内不会执行）
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

/** base64 → Uint8Array */
function base64ToUint8(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function loadFromStorage(): GalleryItem[] {
  if (typeof uni === 'undefined') return [];
  try {
    const raw = uni.getStorageSync(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw as string) as GalleryItem[];
  } catch (e) {
    logger.warn('gallery load failed:', e);
    return [];
  }
}

function saveToStorage(items: GalleryItem[]): void {
  if (typeof uni === 'undefined') return;
  try {
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    logger.warn('gallery save failed:', e);
  }
}

export const useGalleryStore = defineStore('gallery', () => {
  const items = ref<GalleryItem[]>(loadFromStorage());

  /** 当前选中的图纸（用于 detail 页） */
  const currentItemId = ref<string | null>(null);

  function persist(): void {
    saveToStorage(items.value);
  }

  function generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 保存一张图纸到库
   *
   * @param grid BeadGrid
   * @param paletteName 色板显示名
   * @param sourcePath 源图临时路径（可选）
   * @returns 新建项的 id
   */
  function save(
    grid: BeadGrid,
    paletteName: string,
    sourcePath?: string,
  ): string {
    const id = generateId();
    const item: GalleryItem = {
      id,
      createdAt: Date.now(),
      width: grid.width,
      height: grid.height,
      colorCount: grid.stats.colorCounts.size,
      totalBeads: grid.stats.filledCells,
      sourcePath,
      paletteName,
      paletteId: grid.palette.id,
      cellsBase64: uint8ToBase64(new Uint8Array(grid.cells.buffer)),
    };

    // 头插 + 截断到 MAX_ITEMS
    const next = [item, ...items.value].slice(0, MAX_ITEMS);
    items.value = next;
    persist();
    return id;
  }

  function remove(id: string): void {
    items.value = items.value.filter((it) => it.id !== id);
    persist();
  }

  /** 批量删除 */
  function removeMany(ids: string[]): void {
    if (ids.length === 0) return;
    const set = new Set(ids);
    items.value = items.value.filter((it) => !set.has(it.id));
    persist();
  }

  function clear(): void {
    items.value = [];
    persist();
  }

  function getById(id: string): GalleryItem | null {
    return items.value.find((it) => it.id === id) ?? null;
  }

  /**
   * 把 GalleryItem 反序列化为 BeadGrid
   *
   * @param item gallery 项
   * @param palette 用于构建 BeadGrid 的色板
   */
  function toBeadGrid(item: GalleryItem, palette: Palette): BeadGrid {
    const cells = new Uint16Array(base64ToUint8(item.cellsBase64).buffer);
    return buildBeadGrid(cells, item.width, item.height, palette);
  }

  return {
    items,
    currentItemId,
    save,
    remove,
    removeMany,
    clear,
    getById,
    toBeadGrid,
  };
});
