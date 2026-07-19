/**
 * cost-estimator.ts 测试
 */

import { describe, expect, it } from 'vitest';
import { estimateCost, analyzeMainColors, formatCost, isFullyFilled } from '@/core/cost-estimator';
import { buildBeadGrid } from '@/core/grid-builder';
import { rgbToLab } from '@/core/color/rgb-to-lab';
import { EMPTY_CELL } from '@/core/color-quantize';
import type { BeadGrid } from '@/types/bead';
import type { Palette, PaletteEntry, Lab } from '@/types/palette';

function makeRgbPalette(): Palette {
  const entries: PaletteEntry[] = [
    { code: 'R', hex: '#FF0000', lab: rgbToLab(255, 0, 0) as unknown as Lab },
    { code: 'G', hex: '#00FF00', lab: rgbToLab(0, 255, 0) as unknown as Lab },
    { code: 'B', hex: '#0000FF', lab: rgbToLab(0, 0, 255) as unknown as Lab },
  ];
  return { id: 'rgb', name: 'RGB', source: 'custom', entries };
}

function makeGrid(palette: Palette, w: number, h: number, fill?: number[][]): BeadGrid {
  const cells = new Uint16Array(w * h);
  if (fill) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        cells[y * w + x] = fill[y]?.[x] ?? 0;
      }
    }
  }
  return buildBeadGrid(cells, w, h, palette);
}

describe('estimateCost', () => {
  it('默认单价 0.05 → 估算 cost = filledCells × 0.05', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 10, 10);
    const r = estimateCost(grid);
    expect(r.totalCells).toBe(100);
    expect(r.filledCells).toBe(100);
    expect(r.colorCount).toBe(1);
    expect(r.unitPrice).toBe(0.05);
    expect(r.estimatedCost).toBe(5);
  });

  it('空 grid → cost = 0', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 10, 10);
    // 把所有 cell 设为 EMPTY_CELL
    for (let i = 0; i < grid.cells.length; i++) grid.cells[i] = EMPTY_CELL;
    grid.stats.filledCells = 0;
    grid.stats.colorCounts = new Map();
    const r = estimateCost(grid);
    expect(r.filledCells).toBe(0);
    expect(r.estimatedCost).toBe(0);
  });

  it('自定义单价', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 10, 10);
    const r = estimateCost(grid, 0.1);
    expect(r.estimatedCost).toBe(10);
  });
});

describe('analyzeMainColors', () => {
  it('前 N 主色按用量降序', () => {
    const palette = makeRgbPalette();
    // 30 R + 10 G + 5 B（palette: 下标 0=R, 1=G, 2=B）
    const EMPTY = 0xffff;
    const cells = new Uint16Array(50).fill(EMPTY);
    for (let i = 0; i < 30; i++) cells[i] = 0; // R
    for (let i = 30; i < 40; i++) cells[i] = 1; // G
    for (let i = 40; i < 45; i++) cells[i] = 2; // B
    const grid = buildBeadGrid(cells, 10, 5, palette);
    const mains = analyzeMainColors(grid, 3);
    expect(mains.length).toBe(3);
    expect(mains[0].code).toBe('R');
    expect(mains[0].count).toBe(30);
    expect(mains[0].ratio).toBeCloseTo(0.667, 2);
    expect(mains[1].code).toBe('G');
    expect(mains[1].count).toBe(10);
    expect(mains[2].code).toBe('B');
    expect(mains[2].count).toBe(5);
  });

  it('少于 topN → 返回所有', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 5, 5); // 单色
    const mains = analyzeMainColors(grid, 5);
    expect(mains.length).toBe(1);
  });

  it('hex 字段有效', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 5, 5);
    const mains = analyzeMainColors(grid);
    expect(mains[0].hex).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('formatCost', () => {
  it('< 1 元 → 显示为角', () => {
    expect(formatCost(0.5)).toBe('¥50 角');
  });
  it('>= 1 元 → 显示为元', () => {
    expect(formatCost(5.5)).toBe('¥5.50');
  });
  it('0 元', () => {
    expect(formatCost(0)).toBe('¥0 角');
  });
});

describe('isFullyFilled', () => {
  it('全填充 → true', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 5, 5);
    expect(isFullyFilled(grid)).toBe(true);
  });

  it('含透明格 → false', () => {
    const palette = makeRgbPalette();
    const cells = new Uint16Array(25);
    cells[12] = EMPTY_CELL;
    const grid = buildBeadGrid(cells, 5, 5, palette);
    expect(isFullyFilled(grid)).toBe(false);
  });
});
