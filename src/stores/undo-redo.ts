/**
 * 撤销/重做 store（带标签历史）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 通用栈式撤销/重做，每条记录带标签（"生成 50×50"、"改色 (3,5)→H2" 等）。
 * V2 可扩展：标签持久化、远程同步。
 */

import { defineStore } from 'pinia';
import { computed, markRaw, shallowRef } from 'vue';
import type { BeadGrid } from '@/types/bead';

const MAX_HISTORY = 30;

export interface HistoryEntry {
  /** BeadGrid 引用（markRaw 包装，非深响应式） */
  grid: BeadGrid;
  /** 操作标签 */
  label: string;
  /** 时间戳 */
  ts: number;
}

export const useUndoRedoStore = defineStore('undoRedo', () => {
  /** 撤销栈（最近的修改在最末尾） */
  const past = shallowRef<HistoryEntry[]>([]);
  /** 重做栈 */
  const future = shallowRef<HistoryEntry[]>([]);

  const canUndo = computed(() => past.value.length > 0);
  const canRedo = computed(() => future.value.length > 0);

  /** 过去栈的长度（暴露给 UI） */
  const pastLength = computed(() => past.value.length);
  /** 未来栈的长度 */
  const futureLength = computed(() => future.value.length);

  /**
   * 记录一次修改：把当前状态推入 past，清空 future
   *
   * 如果新状态与 past 末尾相同，则不入栈（去重）。
   *
   * @param currentState 修改前的状态
   * @param label 操作标签
   */
  function record(currentState: BeadGrid, label = '修改'): void {
    const last = past.value[past.value.length - 1];
    if (last && isSameGrid(last.grid, currentState) && last.label === label) return;
    const entry: HistoryEntry = {
      grid: markRaw(currentState),
      label,
      ts: Date.now(),
    };
    const next = [...past.value, entry];
    if (next.length > MAX_HISTORY) {
      next.splice(0, next.length - MAX_HISTORY);
    }
    past.value = next;
    future.value = [];
  }

  /**
   * 撤销：返回上一个状态（从 past 取出推入 future）
   *
   * @returns 撤销后应设的新状态；null 表示无撤销
   */
  function undo(currentState: BeadGrid, label = '撤销'): HistoryEntry | null {
    if (past.value.length === 0) return null;
    const prev = past.value[past.value.length - 1];
    past.value = past.value.slice(0, -1);
    future.value = [
      ...future.value,
      { grid: markRaw(currentState), label, ts: Date.now() },
    ];
    if (future.value.length > MAX_HISTORY) {
      future.value.splice(0, future.value.length - MAX_HISTORY);
    }
    return prev;
  }

  /**
   * 重做：返回下一个状态（从 future 取出推入 past）
   */
  function redo(currentState: BeadGrid, label = '重做'): HistoryEntry | null {
    if (future.value.length === 0) return null;
    const next = future.value[future.value.length - 1];
    future.value = future.value.slice(0, -1);
    past.value = [
      ...past.value,
      { grid: markRaw(currentState), label, ts: Date.now() },
    ];
    if (past.value.length > MAX_HISTORY) {
      past.value.splice(0, past.value.length - MAX_HISTORY);
    }
    return next;
  }

  /**
   * 跳转到指定历史位置（仅 past）
   *
   * @param index past 栈中的索引（0 = 最早）
   * @param currentState 当前状态（用于 future）
   * @returns 目标 entry；null 表示越界
   */
  function jumpTo(index: number, currentState: BeadGrid): HistoryEntry | null {
    if (index < 0 || index >= past.value.length) return null;
    const target = past.value[index];
    // 把 index 之后的（含 currentState）移到 future
    const newFuture: HistoryEntry[] = [
      ...past.value.slice(index + 1),
      { grid: markRaw(currentState), label: '跳转到历史', ts: Date.now() },
    ];
    if (newFuture.length > MAX_HISTORY) {
      newFuture.splice(0, newFuture.length - MAX_HISTORY);
    }
    future.value = newFuture;
    // past 截断到 index（含）
    past.value = past.value.slice(0, index + 1);
    return target;
  }

  function clear(): void {
    past.value = [];
    future.value = [];
  }

  return {
    past,
    future,
    canUndo,
    canRedo,
    pastLength,
    futureLength,
    record,
    undo,
    redo,
    jumpTo,
    clear,
  };
});

/** 浅比较两个 BeadGrid 是否相同 */
function isSameGrid(a: BeadGrid, b: BeadGrid): boolean {
  if (a === b) return true;
  if (a.width !== b.width || a.height !== b.height) return false;
  if (a.palette.id !== b.palette.id) return false;
  if (a.cells.length !== b.cells.length) return false;
  for (let i = 0; i < a.cells.length; i++) {
    if (a.cells[i] !== b.cells[i]) return false;
  }
  return true;
}
