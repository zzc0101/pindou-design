/**
 * 生成器草稿 store
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 状态机：idle → processing → done | error
 * 多草稿槽：保存最近 N 张图的"源图 + 网格尺寸 + 命名 + 创建时间"
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { BeadGrid, BeadOptions } from '@/types/image-to-beads';
import type { ImageMeta } from '@/types/image';

export type GeneratorStatus = 'idle' | 'processing' | 'done' | 'error';

const DRAFT_KEY = 'pindou:generator-drafts';
const MAX_DRAFTS = 10;

/** 草稿条目 */
export interface DraftItem {
  id: string;
  name: string;
  sourceImagePath: string;
  gridSize: number;
  createdAt: number;
}

function loadDrafts(): DraftItem[] {
  if (typeof uni === 'undefined') return [];
  try {
    const raw = uni.getStorageSync(DRAFT_KEY);
    if (!raw) return [];
    return JSON.parse(raw as string) as DraftItem[];
  } catch {
    return [];
  }
}

function saveDrafts(items: DraftItem[]): void {
  if (typeof uni === 'undefined') return;
  try {
    uni.setStorageSync(DRAFT_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useGeneratorStore = defineStore('generator', () => {
  // === 状态 ===
  const sourceImagePath = ref<string | null>(null);
  const sourceMeta = ref<ImageMeta | null>(null);
  const gridSize = ref<number>(50);
  const status = ref<GeneratorStatus>('idle');
  const error = ref<string | null>(null);
  const result = ref<BeadGrid | null>(null);

  // === 多草稿列表 ===
  const drafts = ref<DraftItem[]>(loadDrafts());

  // === Actions ===

  /** 把当前状态保存为一个草稿（带命名） */
  function saveCurrentDraft(name?: string): DraftItem | null {
    if (!sourceImagePath.value) return null;
    const item: DraftItem = {
      id: generateId(),
      name: name?.trim() || `草稿 ${drafts.value.length + 1}`,
      sourceImagePath: sourceImagePath.value,
      gridSize: gridSize.value,
      createdAt: Date.now(),
    };
    // 头插 + 截断到 MAX_DRAFTS
    drafts.value = [item, ...drafts.value].slice(0, MAX_DRAFTS);
    saveDrafts(drafts.value);
    return item;
  }

  /** 删除草稿 */
  function deleteDraft(id: string): void {
    drafts.value = drafts.value.filter((d) => d.id !== id);
    saveDrafts(drafts.value);
  }

  /** 重命名草稿 */
  function renameDraft(id: string, newName: string): void {
    const trimmed = newName.trim();
    if (!trimmed) return;
    drafts.value = drafts.value.map((d) =>
      d.id === id ? { ...d, name: trimmed } : d,
    );
    saveDrafts(drafts.value);
  }

  /** 清空所有草稿 */
  function clearAllDrafts(): void {
    drafts.value = [];
    saveDrafts(drafts.value);
  }

  /** 加载草稿（把 sourceImagePath + gridSize 还原到当前状态） */
  function loadDraftById(id: string): boolean {
    const item = drafts.value.find((d) => d.id === id);
    if (!item) return false;
    sourceImagePath.value = item.sourceImagePath;
    gridSize.value = item.gridSize;
    status.value = 'idle';
    error.value = null;
    result.value = null;
    return true;
  }

  /** 兼容旧版"最近一次草稿"恢复 */
  function restoreLastDraft(): boolean {
    if (drafts.value.length === 0) return false;
    return loadDraftById(drafts.value[0].id);
  }

  function setSource(path: string, meta: ImageMeta): void {
    sourceImagePath.value = path;
    sourceMeta.value = meta;
    status.value = 'idle';
    error.value = null;
    result.value = null;
  }

  function setGridSize(size: number): void {
    gridSize.value = Math.max(20, Math.min(100, size));
  }

  function runGeneration(grid: BeadGrid): void {
    result.value = grid;
    status.value = 'done';
    error.value = null;
  }

  function setProcessing(): void {
    status.value = 'processing';
    error.value = null;
  }

  function setError(message: string): void {
    status.value = 'error';
    error.value = message;
  }

  function reset(): void {
    sourceImagePath.value = null;
    sourceMeta.value = null;
    result.value = null;
    status.value = 'idle';
    error.value = null;
    gridSize.value = 50;
  }

  /** 当前 BeadOptions 便捷获取 */
  function buildOptions(palette: import('@/types/palette').Palette): BeadOptions {
    return {
      gridWidth: gridSize.value,
      gridHeight: gridSize.value,
      palette,
    };
  }

  return {
    sourceImagePath,
    sourceMeta,
    gridSize,
    status,
    error,
    result,
    drafts,
    saveCurrentDraft,
    deleteDraft,
    renameDraft,
    clearAllDrafts,
    loadDraftById,
    restoreLastDraft,
    setSource,
    setGridSize,
    runGeneration,
    setProcessing,
    setError,
    reset,
    buildOptions,
  };
});