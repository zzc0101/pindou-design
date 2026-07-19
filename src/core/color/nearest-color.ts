/**
 * 色板最近邻查找
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 策略：预建 Lab 索引，量化时单像素 O(N) 线性扫描。
 * 138 色规模下，线性扫描比 KD-Tree 更快（常数项小）。
 * 若色卡扩展到 1000+ 色，再考虑 KD-Tree / VP-Tree。
 */

import type { Lab, Palette, PaletteEntry } from '@/types/palette';
import { deltaE2000 } from './delta-e';
import { buildKDTree, findNearestKD } from './kd-tree';

/** 色板规模 ≥ 此阈值时切换为 KD-Tree（否则线性扫描更快） */
const KD_TREE_THRESHOLD = 500;

/**
 * 色板 Lab 索引
 *
 * find() 返回下标（0 表示第一个条目）。
 * 透明度处理：透明像素（alpha < 128）不应调用 find，需在外层判断。
 */
import { perf } from '@/utils/perf-monitor';

export interface PaletteIndex {
  /** 原始色板引用 */
  readonly palette: Palette;
  /** 预存 Lab 数组（每条目 3 个 float，用于线性扫描；KD-Tree 模式不直接用） */
  readonly labs: Float32Array;
  /** 查找最近色，返回色卡下标 */
  find(lab: Lab): number;
}

/**
 * 构造色板 Lab 索引
 *
 * 规模 < KD_TREE_THRESHOLD：线性扫描（常数项小，更快）
 * 规模 ≥ KD_TREE_THRESHOLD：KD-Tree（O(log N) vs O(N)）
 *
 * @param palette 色板
 * @returns PaletteIndex
 */
export function buildPaletteIndex(palette: Palette): PaletteIndex {
  const n = palette.entries.length;
  const labs = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [L, a, b] = palette.entries[i].lab;
    labs[i * 3] = L;
    labs[i * 3 + 1] = a;
    labs[i * 3 + 2] = b;
  }

  if (n >= KD_TREE_THRESHOLD) {
    const tree = perf.measureSync('buildKDTree', () => buildKDTree(palette.entries), { n });
    return {
      palette,
      labs,
      find(lab: Lab): number {
        return findNearestKD(tree, lab);
      },
    };
  }

  return {
    palette,
    labs,
    find(lab: Lab): number {
      return findNearestByIndex(labs, n, lab);
    },
  };
}

/**
 * 在预存的 Lab 数组中找最近色（暴露给 quantize 模块复用）
 *
 * @param labs Float32Array，长度 = entryCount * 3
 * @param entryCount 条目数
 * @param lab 目标 Lab 值
 * @returns 条目下标
 */
export function findNearestByIndex(
  labs: Float32Array,
  entryCount: number,
  lab: Lab,
): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < entryCount; i++) {
    const dist = deltaE2000(lab, [labs[i * 3], labs[i * 3 + 1], labs[i * 3 + 2]] as Lab);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** 取色卡下标的辅助函数（带边界检查） */
export function getEntry(palette: Palette, index: number): PaletteEntry | null {
  if (index < 0 || index >= palette.entries.length) return null;
  return palette.entries[index];
}
