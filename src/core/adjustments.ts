/**
 * BeadGrid 手动调整工具
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 提供不可变操作：每次修改返回新的 BeadGrid。
 * 便于后续 V2 实现撤销/重做。
 */

import type { BeadGrid } from '@/types/bead';
import type { Palette } from '@/types/palette';
import { buildBeadGrid } from './grid-builder';
import { EMPTY_CELL } from './color-quantize';

/**
 * 设置某个格子的色卡下标（不可变，返回新 grid）
 *
 * @param grid 原始 BeadGrid
 * @param x 列号 (0-based)
 * @param y 行号 (0-based)
 * @param colorIndex 目标色卡下标
 * @returns 新的 BeadGrid
 */
export function setCellColor(
  grid: BeadGrid,
  x: number,
  y: number,
  colorIndex: number,
): BeadGrid {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return grid;
  if (colorIndex < 0 || colorIndex >= grid.palette.entries.length) return grid;

  const newCells = new Uint16Array(grid.cells);
  newCells[y * grid.width + x] = colorIndex;
  return buildBeadGrid(newCells, grid.width, grid.height, grid.palette);
}

/** 把格子设为透明（EMPTY_CELL） */
export function clearCell(grid: BeadGrid, x: number, y: number): BeadGrid {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return grid;
  const newCells = new Uint16Array(grid.cells);
  newCells[y * grid.width + x] = EMPTY_CELL;
  return buildBeadGrid(newCells, grid.width, grid.height, grid.palette);
}

/** 批量设置（用于撤销/重做的 application） */
export function batchSetCellColors(
  grid: BeadGrid,
  updates: Array<{ x: number; y: number; colorIndex: number }>,
): BeadGrid {
  if (updates.length === 0) return grid;
  const newCells = new Uint16Array(grid.cells);
  for (const u of updates) {
    if (u.x < 0 || u.x >= grid.width || u.y < 0 || u.y >= grid.height) continue;
    if (u.colorIndex < 0 || u.colorIndex >= grid.palette.entries.length) continue;
    newCells[u.y * grid.width + u.x] = u.colorIndex;
  }
  return buildBeadGrid(newCells, grid.width, grid.height, grid.palette);
}

/** 切换色板（保留 cells，但 cells 可能引用错误下标——通常配合 batchSetCellColors 用） */
export function withPalette(grid: BeadGrid, palette: Palette): BeadGrid {
  return buildBeadGrid(grid.cells, grid.width, grid.height, palette);
}
