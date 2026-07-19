/**
 * adjustments.ts 测试
 */

import { describe, expect, it } from 'vitest';
import { setCellColor, clearCell, batchSetCellColors, withPalette } from '@/core/adjustments';
import { buildBeadGrid } from '@/core/grid-builder';
import { EMPTY_CELL } from '@/core/color-quantize';
import { rgbToLab } from '@/core/color/rgb-to-lab';
import type { BeadGrid } from '@/types/bead';
import type { Palette, PaletteEntry } from '@/types/palette';

function makeRgbPalette(): Palette {
  const entries: PaletteEntry[] = [
    { code: 'R', hex: '#FF0000', lab: rgbToLab(255, 0, 0) as unknown as Lab },
    { code: 'G', hex: '#00FF00', lab: rgbToLab(0, 255, 0) as unknown as Lab },
    { code: 'B', hex: '#0000FF', lab: rgbToLab(0, 0, 255) as unknown as Lab },
  ];
  return { id: 'rgb', name: 'RGB', source: 'custom', entries };
}

import type { Lab } from '@/types/palette';

function makeGrid(palette: Palette, w = 5, h = 5): BeadGrid {
  const cells = new Uint16Array(w * h);
  return buildBeadGrid(cells, w, h, palette);
}

describe('setCellColor', () => {
  it('设置单格颜色', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette);
    const updated = setCellColor(grid, 2, 3, 1); // G
    expect(updated.cells[3 * 5 + 2]).toBe(1);
    expect(palette.entries[updated.cells[3 * 5 + 2]].code).toBe('G');
  });

  it('原 grid 不变（不可变）', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette);
    setCellColor(grid, 2, 3, 1);
    expect(grid.cells[3 * 5 + 2]).toBe(0);
  });

  it('越界返回原 grid', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette);
    const updated = setCellColor(grid, -1, 0, 1);
    expect(updated).toBe(grid);
  });

  it('非法 colorIndex 返回原 grid', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette);
    const updated = setCellColor(grid, 0, 0, 99);
    expect(updated).toBe(grid);
  });
});

describe('clearCell', () => {
  it('把格子设为 EMPTY_CELL', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette);
    const filled = setCellColor(grid, 1, 1, 1);
    const cleared = clearCell(filled, 1, 1);
    expect(cleared.cells[1 * 5 + 1]).toBe(EMPTY_CELL);
  });
});

describe('batchSetCellColors', () => {
  it('批量更新', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette);
    const updated = batchSetCellColors(grid, [
      { x: 0, y: 0, colorIndex: 0 },
      { x: 1, y: 1, colorIndex: 1 },
      { x: 2, y: 2, colorIndex: 2 },
    ]);
    expect(updated.cells[0 * 5 + 0]).toBe(0);
    expect(updated.cells[1 * 5 + 1]).toBe(1);
    expect(updated.cells[2 * 5 + 2]).toBe(2);
  });

  it('空 updates 返回原 grid', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette);
    expect(batchSetCellColors(grid, [])).toBe(grid);
  });

  it('跳过越界 update', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette);
    const updated = batchSetCellColors(grid, [
      { x: -1, y: 0, colorIndex: 1 },
      { x: 0, y: 0, colorIndex: 1 },
    ]);
    expect(updated.cells[0]).toBe(1);
  });
});

describe('withPalette', () => {
  it('替换 palette 但 cells 不变（cells 下标可能不一致）', () => {
    const a = makeRgbPalette();
    const b: Palette = { id: 'b', name: 'B', source: 'custom', entries: a.entries.slice().reverse() };
    const grid = makeGrid(a);
    const updated = withPalette(grid, b);
    expect(updated.palette.id).toBe('b');
    expect(updated.cells).toBe(grid.cells);
  });
});
