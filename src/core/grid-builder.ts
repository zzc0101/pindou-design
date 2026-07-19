/**
 * 构造 BeadGrid（含统计信息）
 *
 * @author zhuzc
 * @date 2026-06-22
 */

import type { BeadGrid, BeadGridStats } from '@/types/bead';
import type { Palette } from '@/types/palette';
import { EMPTY_CELL } from './color-quantize';

/**
 * 把色卡下标数组包装成 BeadGrid，并统计颜色用量
 *
 * @param cells 色卡下标数组（长度 = width * height）；EMPTY_CELL 表示透明
 * @param width 网格宽度
 * @param height 网格高度
 * @param palette 所使用的色板
 * @returns BeadGrid
 */
export function buildBeadGrid(
  cells: Uint16Array,
  width: number,
  height: number,
  palette: Palette,
): BeadGrid {
  if (cells.length !== width * height) {
    throw new Error(
      `cells length mismatch: got ${cells.length}, expected ${width * height}`,
    );
  }

  const colorCounts = new Map<number, number>();
  let filledCells = 0;

  for (let i = 0; i < cells.length; i++) {
    const idx = cells[i];
    if (idx === EMPTY_CELL) continue; // EMPTY_CELL = 透明 / 未填充
    filledCells++;
    colorCounts.set(idx, (colorCounts.get(idx) ?? 0) + 1);
  }

  const stats: BeadGridStats = {
    totalCells: width * height,
    filledCells,
    colorCounts,
  };

  return { width, height, cells, palette, stats };
}
