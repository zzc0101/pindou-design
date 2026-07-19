/**
 * 豆子估算器 + 主色分析
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 1. estimateCost：估算总豆子数 + 估算花费（淘宝均价 0.05 元/颗，可配置）
 * 2. analyzeMainColors：返回用量前 N 主色（百分比 + 色号 + hex）
 */

import type { BeadGrid } from '@/types/bead';
import { EMPTY_CELL } from '@/core/color-quantize';

/** 默认拼豆单价（元/颗） */
const DEFAULT_UNIT_PRICE = 0.05;

/** 估算结果 */
export interface CostEstimate {
  /** 总格子数 */
  totalCells: number;
  /** 已填充格子数（需购买的实际豆子数） */
  filledCells: number;
  /** 用色数 */
  colorCount: number;
  /** 单价（元/颗） */
  unitPrice: number;
  /** 估算总价（元） */
  estimatedCost: number;
}

/**
 * 估算豆子数量 + 花费
 *
 * @param grid BeadGrid
 * @param unitPrice 单价（元/颗），默认 0.05
 * @returns CostEstimate
 */
export function estimateCost(grid: BeadGrid, unitPrice = DEFAULT_UNIT_PRICE): CostEstimate {
  const totalCells = grid.width * grid.height;
  return {
    totalCells,
    filledCells: grid.stats.filledCells,
    colorCount: grid.stats.colorCounts.size,
    unitPrice,
    estimatedCost: Math.round(grid.stats.filledCells * unitPrice * 100) / 100,
  };
}

/** 主色分析结果 */
export interface MainColor {
  /** 色卡下标 */
  index: number;
  /** 色号 */
  code: string;
  /** 16 进制颜色 */
  hex: string;
  /** 用量（颗） */
  count: number;
  /** 占比（0-1） */
  ratio: number;
}

/**
 * 分析用量前 N 主色
 *
 * @param grid BeadGrid
 * @param topN 前 N 名（默认 5）
 * @returns 主色数组（按用量降序）
 */
export function analyzeMainColors(grid: BeadGrid, topN = 5): MainColor[] {
  const counts: Array<MainColor> = [];
  const total = grid.stats.filledCells || 1;

  grid.stats.colorCounts.forEach((count, idx) => {
    const entry = grid.palette.entries[idx];
    if (!entry) return;
    counts.push({
      index: idx,
      code: entry.code,
      hex: entry.hex,
      count,
      ratio: count / total,
    });
  });

  counts.sort((a, b) => b.count - a.count);
  return counts.slice(0, topN);
}

/** 格式化费用（元） */
export function formatCost(cost: number): string {
  if (cost < 1) return `¥${(cost * 100).toFixed(0)} 角`;
  return `¥${cost.toFixed(2)}`;
}

/** 检查 grid 是否完全填充（无透明格） */
export function isFullyFilled(grid: BeadGrid): boolean {
  for (let i = 0; i < grid.cells.length; i++) {
    if (grid.cells[i] === EMPTY_CELL) return false;
  }
  return true;
}

/** 采购清单条目 */
export interface PurchaseItem {
  code: string;
  name?: string;
  hex: string;
  count: number;
  /** 该色估算花费（元） */
  cost: number;
  /** 该色建议采购包数（按 1000 颗/包） */
  packs: number;
}

/** 采购清单（含每色用量 + 估算花费 + 建议包数） */
export function buildPurchaseList(
  grid: BeadGrid,
  unitPrice = DEFAULT_UNIT_PRICE,
  beadsPerPack = 1000,
): PurchaseItem[] {
  const items: PurchaseItem[] = [];
  grid.stats.colorCounts.forEach((count, idx) => {
    const entry = grid.palette.entries[idx];
    if (!entry) return;
    const cost = Math.round(count * unitPrice * 100) / 100;
    const packs = Math.ceil(count / beadsPerPack);
    items.push({
      code: entry.code,
      name: entry.name,
      hex: entry.hex,
      count,
      cost,
      packs,
    });
  });
  items.sort((a, b) => b.count - a.count);
  return items;
}

/** 采购清单 → 复制友好的纯文本 */
export function formatPurchaseListText(
  items: PurchaseItem[],
  options: { brand?: string; totalCost?: number; totalBeads?: number } = {},
): string {
  const lines: string[] = [];
  lines.push('🧮 拼豆豆子采购清单');
  if (options.brand) lines.push(`色板：${options.brand}`);
  lines.push('');
  for (const item of items) {
    const name = item.name ? ` ${item.name}` : '';
    lines.push(`${item.code}${name}  ×${item.count}颗  ≈¥${item.cost.toFixed(2)}  ${item.packs}包`);
  }
  lines.push('');
  if (options.totalBeads) lines.push(`共 ${options.totalBeads} 颗`);
  if (options.totalCost) lines.push(`合计 ≈¥${options.totalCost.toFixed(2)}`);
  return lines.join('\n');
}

/** 生成淘宝搜索 URL（每色 + 总合并搜索） */
export function buildTaobaoSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `https://s.taobao.com/search?q=${encoded}`;
}
