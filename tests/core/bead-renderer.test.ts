/**
 * bead-renderer.ts 测试
 */

import { describe, expect, it } from 'vitest';
import { buildRenderCommands } from '@/core/bead-renderer';
import type { BeadGrid } from '@/types/bead';
import { EMPTY_CELL } from '@/core/color-quantize';

function makePalette(): BeadGrid['palette'] {
  return {
    id: 'test',
    name: 'test',
    source: 'mard',
    entries: [
      { code: 'A1', hex: '#FF0000', lab: [50, 70, 50] },
      { code: 'A2', hex: '#00FF00', lab: [50, -70, 50] },
      { code: 'A3', hex: '#0000FF', lab: [50, 0, -70] },
    ],
  };
}

function makeGrid(rows: number[][]): BeadGrid {
  const palette = makePalette();
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const cells = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      cells[y * w + x] = rows[y][x];
    }
  }
  return { width: w, height: h, cells, palette, stats: { totalCells: w * h, filledCells: w * h, colorCounts: new Map() } };
}

describe('buildRenderCommands', () => {
  it('背景指令在第一条', () => {
    const grid = makeGrid([[0, 0]]);
    const cmds = buildRenderCommands(grid, { cellSize: 10 });
    expect(cmds[0]).toMatchObject({ type: 'fillRect', color: '#FFFFFF', w: 20, h: 10 });
  });

  it('单色 3×3 → 3 个 fillRect（每行 1 个，跨整行宽度）', () => {
    const grid = makeGrid([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    const cmds = buildRenderCommands(grid, { cellSize: 10, showGrid: false });
    const fills = cmds.filter((c) => c.type === 'fillRect' && c.color === '#FF0000');
    expect(fills.length).toBe(3); // 每行 1 个 fillRect
    expect(fills[0]).toMatchObject({ x: 0, y: 0, w: 30, h: 10 });
  });

  it('2×2 四色不同 → 4 个 fillRect（每行 2 段）', () => {
    const grid = makeGrid([
      [0, 1],
      [2, 0],
    ]);
    const cmds = buildRenderCommands(grid, { cellSize: 10, showGrid: false });
    const fills = cmds.filter((c) => c.type === 'fillRect' && c.color !== '#FFFFFF');
    // 行 0: A1(0,0) + A2(0,1) → 2 段
    // 行 1: A3(1,0) + A1(1,1) → 2 段
    expect(fills.length).toBe(4);
  });

  it('同色行合并：1×10 全 A1 → 1 个 fillRect（宽度 100）', () => {
    const grid = makeGrid([[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]);
    const cmds = buildRenderCommands(grid, { cellSize: 10, showGrid: false });
    const fills = cmds.filter((c) => c.type === 'fillRect' && c.color === '#FF0000');
    expect(fills.length).toBe(1);
    expect(fills[0]).toMatchObject({ x: 0, y: 0, w: 100, h: 10 });
  });

  it('同色行合并：1×6 A1A1 A2A2 A1A1 → 背景 1 + 颜色 3 = 4 个 fillRect', () => {
    const grid = makeGrid([[0, 0, 1, 1, 0, 0]]);
    const cmds = buildRenderCommands(grid, { cellSize: 10, showGrid: false });
    const fills = cmds.filter((c) => c.type === 'fillRect');
    // 1 背景 + 3 颜色段
    expect(fills.length).toBe(4);
  });

  it('透明格不画 fillRect（透明隔开同色 → 2 段）', () => {
    const grid = makeGrid([[0, EMPTY_CELL, 0]]);
    const cmds = buildRenderCommands(grid, { cellSize: 10, showGrid: false });
    const fills = cmds.filter((c) => c.type === 'fillRect' && c.color === '#FF0000');
    // 两段：A1 在 x=0..10，A1 在 x=20..30 → 2 个 fillRect
    expect(fills.length).toBe(2);
  });

  it('100×100 全同色 → 100 个 fillRect（每行 1 个，从 10000 降 99%）', () => {
    const rows: number[][] = [];
    for (let i = 0; i < 100; i++) rows.push(new Array(100).fill(0));
    const grid = makeGrid(rows);
    const cmds = buildRenderCommands(grid, { cellSize: 12, showGrid: false });
    const fills = cmds.filter((c) => c.type === 'fillRect' && c.color === '#FF0000');
    expect(fills.length).toBe(100); // 每行 1 个，全图 100 行
  });

  it('labelStep=10 配 1×3 网格 → 1 个 fillText（x=0 画）', () => {
    const grid = makeGrid([[0, 0, 0]]);
    const cmds = buildRenderCommands(grid, { cellSize: 10, showGrid: false, labelStep: 10 });
    const texts = cmds.filter((c) => c.type === 'fillText');
    // y=0 时 x=0 画（10 越界）
    expect(texts.length).toBe(1);
  });

  it('labelStep=2 配 4×2 网格 → y=0 × x=0,2 共 2 个 fillText', () => {
    const grid = makeGrid([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const cmds = buildRenderCommands(grid, { cellSize: 10, showGrid: false, labelStep: 2 });
    const texts = cmds.filter((c) => c.type === 'fillText');
    // y=0 时 x=0, 2 → 2 个 fillText（y=2 越界 height=2）
    expect(texts.length).toBe(2);
    expect(texts[0]).toMatchObject({ text: 'A1', color: 'rgba(0,0,0,0.6)' });
  });

  it('transparent=true → 不画背景 fillRect', () => {
    const grid = makeGrid([[0]]);
    const normal = buildRenderCommands(grid, { cellSize: 10, showGrid: false });
    const transparent = buildRenderCommands(grid, { cellSize: 10, showGrid: false, transparent: true });
    // 透明模式比正常少 1 个背景 fillRect
    expect(transparent.length).toBe(normal.length - 1);
    // 第一条不是背景
    expect(transparent[0]).not.toMatchObject({ color: '#FFFFFF' });
  });

  it('showGrid + majorGridStep=5 → 含主线 strokeLine', () => {
    const grid = makeGrid([
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ]);
    const cmds = buildRenderCommands(grid, { cellSize: 10, showGrid: true, majorGridStep: 5 });
    const strokes = cmds.filter((c) => c.type === 'strokeLine');
    expect(strokes.length).toBeGreaterThan(0);
    // 主线应存在（majorGridColor），i=5 时
    const major = strokes.filter((s) => s.color === 'rgba(0,0,0,0.4)');
    expect(major.length).toBeGreaterThan(0);
  });

  it('showGrid=false → 无任何 strokeLine', () => {
    const grid = makeGrid([[0, 0]]);
    const cmds = buildRenderCommands(grid, { cellSize: 10, showGrid: false });
    const strokes = cmds.filter((c) => c.type === 'strokeLine');
    expect(strokes.length).toBe(0);
  });
});
