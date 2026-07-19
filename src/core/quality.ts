/**
 * 图纸评分（多维度）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 4 个维度（各 0-100）：
 *   1. 多样性（diversity）   ：用色数 / 格子数（越多越丰富）
 *   2. 均衡性（balance）     ：主色占比分布越均匀越好
 *   3. 完整性（completeness）：边缘格子填充率
 *   4. 经济性（economy）     ：主色占比高 → 简单图 → 评分高
 *
 * 综合分 = 加权平均
 *   diversity 25% + balance 25% + completeness 25% + economy 25%
 */

import type { BeadGrid } from '@/types/bead';
import { EMPTY_CELL } from '@/core/color-quantize';

export type QualityGrade = 'S' | 'A' | 'B' | 'C' | 'D';

/** 评分结果 */
export interface QualityScore {
  /** 综合分 0-100 */
  overall: number;
  /** 多样性 0-100 */
  diversity: number;
  /** 均衡性 0-100 */
  balance: number;
  /** 完整性 0-100（边缘填充率） */
  completeness: number;
  /** 经济性 0-100（主色占比） */
  economy: number;
  /** 评级 S/A/B/C/D */
  rating: QualityGrade;
  /** 评级标签 */
  ratingLabel: string;
}

/**
 * 计算多维度评分
 */
export function calcDetailedQuality(grid: BeadGrid): QualityScore {
  const diversity = calcDiversity(grid);
  const balance = calcBalance(grid);
  const completeness = calcCompleteness(grid);
  const economy = calcEconomy(grid);
  const overall = Math.round(
    diversity * 0.25 + balance * 0.25 + completeness * 0.25 + economy * 0.25,
  );
  const rating = scoreToRating(overall);
  return {
    overall,
    diversity,
    balance,
    completeness,
    economy,
    rating,
    ratingLabel: ratingLabel(rating),
  };
}

/**
 * 单维度评分（向后兼容）
 */
export function calcQuality(grid: BeadGrid): number {
  return calcDetailedQuality(grid).overall;
}

/* ===== 各维度计算 ===== */

function calcDiversity(grid: BeadGrid): number {
  const filled = grid.stats.filledCells;
  if (filled === 0) return 0;
  const uniqueColors = grid.stats.colorCounts.size;
  return Math.min(100, Math.round((uniqueColors / filled) * 1000));
}

function calcBalance(grid: BeadGrid): number {
  const filled = grid.stats.filledCells;
  if (filled === 0) return 0;
  const uniqueColors = grid.stats.colorCounts.size;
  if (uniqueColors <= 1) return 0;
  let entropy = 0;
  grid.stats.colorCounts.forEach((count) => {
    const p = count / filled;
    entropy -= p * Math.log2(p);
  });
  const maxEntropy = Math.log2(uniqueColors);
  if (maxEntropy === 0) return 0;
  return Math.round((entropy / maxEntropy) * 100);
}

function calcCompleteness(grid: BeadGrid): number {
  const total = grid.width * grid.height;
  if (total === 0) return 0;
  return Math.round((grid.stats.filledCells / total) * 100);
}

function calcEconomy(grid: BeadGrid): number {
  const filled = grid.stats.filledCells;
  if (filled === 0) return 0;
  let maxCount = 0;
  grid.stats.colorCounts.forEach((count) => {
    if (count > maxCount) maxCount = count;
  });
  const mainRatio = maxCount / filled;
  return Math.min(100, Math.round(mainRatio * 100));
}

function scoreToRating(score: number): QualityGrade {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

function ratingLabel(rating: QualityGrade): string {
  return {
    S: '卓越',
    A: '优秀',
    B: '良好',
    C: '一般',
    D: '简化',
  }[rating];
}

/** 取主色（用量最多） */
export function getMainColor(grid: BeadGrid): { hex: string; code: string; ratio: number } | null {
  if (grid.stats.colorCounts.size === 0) return null;
  let bestIdx = -1;
  let bestCount = 0;
  grid.stats.colorCounts.forEach((count, idx) => {
    if (count > bestCount) {
      bestCount = count;
      bestIdx = idx;
    }
  });
  if (bestIdx < 0) return null;
  const entry = grid.palette.entries[bestIdx];
  if (!entry) return null;
  return {
    hex: entry.hex,
    code: entry.code,
    ratio: bestCount / (grid.stats.filledCells || 1),
  };
}

/** 检查 grid 是否完全填充 */
export function isFullyFilled(grid: BeadGrid): boolean {
  for (let i = 0; i < grid.cells.length; i++) {
    if (grid.cells[i] === EMPTY_CELL) return false;
  }
  return true;
}