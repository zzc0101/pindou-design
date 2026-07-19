/**
 * bead-renderer-3d.ts 测试
 */

import { describe, expect, it } from 'vitest';
import { buildRenderCommands3D } from '@/core/bead-renderer-3d';
import { buildBeadGrid } from '@/core/grid-builder';
import { rgbToLab } from '@/core/color/rgb-to-lab';
import { EMPTY_CELL } from '@/core/color-quantize';
import type { BeadGrid } from '@/types/bead';
import type { Palette, PaletteEntry, Lab } from '@/types/palette';

function makeRgbPalette(): Palette {
  const entries: PaletteEntry[] = [
    { code: 'R', hex: '#FF0000', lab: rgbToLab(255, 0, 0) as unknown as Lab },
    { code: 'G', hex: '#00FF00', lab: rgbToLab(0, 255, 0) as unknown as Lab },
  ];
  return { id: 'rgb', name: 'RGB', source: 'custom', entries };
}

function makeGrid(rows: number[][]): BeadGrid {
  const palette = makeRgbPalette();
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const cells = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) cells[y * w + x] = rows[y][x];
  }
  return buildBeadGrid(cells, w, h, palette);
}

describe('buildRenderCommands3D', () => {
  it('背景 + 主体 + 高光 + 暗边 4 类指令', () => {
    const grid = makeGrid([
      [0, 0],
      [0, 0],
    ]);
    const cmds = buildRenderCommands3D(grid, { cellSize: 10, showGrid: false });
    const types = new Set(cmds.map((c) => c.type));
    expect(types.has('fillRect')).toBe(true);
    // 只有 fillRect（没网格线）
    expect(types.size).toBe(1);
  });

  it('100×100 全同色 → 1 背景 + 100 主体 + 100 高光 + 200 暗边 = 401 fillRect', () => {
    const rows: number[][] = [];
    for (let i = 0; i < 100; i++) rows.push(new Array(100).fill(0));
    const grid = makeGrid(rows);
    const cmds = buildRenderCommands3D(grid, { cellSize: 12, showGrid: false });
    const fills = cmds.filter((c) => c.type === 'fillRect');
    // 1 背景 + 100 主体 + 100 高光 + 200 暗边 = 401
    expect(fills.length).toBe(401);
  });

  it('高光颜色含 alpha', () => {
    const grid = makeGrid([[0, 0]]);
    const cmds = buildRenderCommands3D(grid, { cellSize: 10, showGrid: false });
    const highlights = cmds.filter((c) => c.type === 'fillRect' && c.color.includes('rgba(255,255,255'));
    expect(highlights.length).toBeGreaterThan(0);
  });

  it('暗边颜色含黑色 alpha', () => {
    const grid = makeGrid([[0, 0]]);
    const cmds = buildRenderCommands3D(grid, { cellSize: 10, showGrid: false });
    const shadows = cmds.filter((c) => c.type === 'fillRect' && c.color.includes('rgba(0,0,0'));
    expect(shadows.length).toBeGreaterThan(0);
  });

  it('高光 alpha=0 时不画高光', () => {
    const grid = makeGrid([[0]]);
    const cmds = buildRenderCommands3D(grid, {
      cellSize: 10,
      showGrid: false,
      highlightAlpha: 0,
    });
    const highlights = cmds.filter((c) => c.color.includes('rgba(255,255,255'));
    expect(highlights.length).toBe(0);
  });

  it('暗边 alpha=0 时不画暗边', () => {
    const grid = makeGrid([[0]]);
    const cmds = buildRenderCommands3D(grid, {
      cellSize: 10,
      showGrid: false,
      shadowAlpha: 0,
    });
    const shadows = cmds.filter((c) => c.color.includes('rgba(0,0,0'));
    expect(shadows.length).toBe(0);
  });

  it('透明格不画 3D 装饰', () => {
    const grid = makeGrid([[0, EMPTY_CELL, 0]]);
    const cmds = buildRenderCommands3D(grid, { cellSize: 10, showGrid: false });
    // 仅 1 个主体色段（两个 0 中间隔了 EMPTY，不合并）+ 2 个高光段 + 2 个暗边段
    const fills = cmds.filter((c) => c.type === 'fillRect');
    expect(fills.length).toBeGreaterThanOrEqual(2);
  });

  it('showGrid=true 含网格线', () => {
    const grid = makeGrid([[0, 0]]);
    const cmds = buildRenderCommands3D(grid, { cellSize: 10, showGrid: true });
    expect(cmds.some((c) => c.type === 'strokeLine')).toBe(true);
  });

  it('transparent=true → 不画背景 fillRect', () => {
    const grid = makeGrid([[0]]);
    const normal = buildRenderCommands3D(grid, { cellSize: 10, showGrid: false });
    const transparent = buildRenderCommands3D(grid, {
      cellSize: 10,
      showGrid: false,
      transparent: true,
    });
    // 透明模式比正常少 1 个背景 fillRect
    expect(transparent.length).toBe(normal.length - 1);
  });
});
