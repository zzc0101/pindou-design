/**
 * page-tile.ts 测试
 */

import { describe, expect, it } from 'vitest';
import { tileGrid, renderTile } from '@/core/page-tile';
import { buildBeadGrid } from '@/core/grid-builder';
import { rgbToLab } from '@/core/color/rgb-to-lab';
import { EMPTY_CELL } from '@/core/color-quantize';
import type { BeadGrid } from '@/types/bead';
import type { Palette, PaletteEntry } from '@/types/palette';
import type { Lab } from '@/types/palette';

function makeRgbPalette(): Palette {
  const entries: PaletteEntry[] = [
    { code: 'R', hex: '#FF0000', lab: rgbToLab(255, 0, 0) as unknown as Lab },
    { code: 'G', hex: '#00FF00', lab: rgbToLab(0, 255, 0) as unknown as Lab },
  ];
  return { id: 'rgb', name: 'RGB', source: 'custom', entries };
}

function makeGrid(palette: Palette, w: number, h: number): BeadGrid {
  const cells = new Uint16Array(w * h);
  return buildBeadGrid(cells, w, h, palette);
}

describe('tileGrid 分块', () => {
  it('小图（30×40 < 35×50）→ 1 页', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 30, 40);
    const tiles = tileGrid(grid);
    expect(tiles.length).toBe(1);
    expect(tiles[0].pageIndex).toBe(0);
    expect(tiles[0].cellOffsetX).toBe(0);
    expect(tiles[0].cellOffsetY).toBe(0);
    expect(tiles[0].cellWidth).toBe(30);
    expect(tiles[0].cellHeight).toBe(40);
    expect(tiles[0].totalPages).toBe(1);
  });

  it('刚好一页（35×50）→ 1 页', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 35, 50);
    const tiles = tileGrid(grid);
    expect(tiles.length).toBe(1);
  });

  it('宽度超（50×30）→ 2 列 × 1 行 = 2 页', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 50, 30);
    const tiles = tileGrid(grid, { cellsPerPageX: 35, cellsPerPageY: 50, overlap: 2 });
    // stepX = 35-2 = 33, cols = ceil((50-2)/33) = ceil(48/33) = 2
    expect(tiles.length).toBe(2);
    expect(tiles[0].cellOffsetX).toBe(0);
    expect(tiles[0].cellWidth).toBe(35);
    expect(tiles[1].cellOffsetX).toBe(33);
    expect(tiles[1].cellWidth).toBe(17); // 50 - 33 = 17
  });

  it('高度超（30×80）→ 1 列 × 2 行 = 2 页', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 30, 80);
    const tiles = tileGrid(grid, { cellsPerPageX: 35, cellsPerPageY: 50, overlap: 2 });
    expect(tiles.length).toBe(2);
    expect(tiles[0].cellOffsetY).toBe(0);
    expect(tiles[1].cellOffsetY).toBe(48); // 50-2 = 48
  });

  it('大幅（100×100）→ 多页（带 overlap）', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 100, 100);
    const tiles = tileGrid(grid, { cellsPerPageX: 35, cellsPerPageY: 50, overlap: 2 });
    // cols = 3, rows = 3 → 9 页（按 row * cols + col 编号）
    expect(tiles.length).toBe(9);
    // row=0 三页：(0,0), (33,0), (66,0)
    expect(tiles[0].cellOffsetX).toBe(0);
    expect(tiles[1].cellOffsetX).toBe(33);
    expect(tiles[2].cellOffsetX).toBe(66);
    // row=1 三页：(0,48), (33,48), (66,48)
    expect(tiles[3].cellOffsetX).toBe(0);
    expect(tiles[3].cellOffsetY).toBe(48);
    expect(tiles[4].cellOffsetY).toBe(48);
  });

  it('每页 tile 有正确的 row/col/pageIndex 编号', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 70, 60);
    const tiles = tileGrid(grid, { cellsPerPageX: 35, cellsPerPageY: 50, overlap: 2 });
    // cols=3, rows=2 → 6 页
    expect(tiles.length).toBe(6);
    expect(tiles[0]).toMatchObject({ row: 0, col: 0, pageIndex: 0 });
    expect(tiles[1]).toMatchObject({ row: 0, col: 1, pageIndex: 1 });
    expect(tiles[2]).toMatchObject({ row: 0, col: 2, pageIndex: 2 });
    expect(tiles[3]).toMatchObject({ row: 1, col: 0, pageIndex: 3 });
    expect(tiles[4]).toMatchObject({ row: 1, col: 1, pageIndex: 4 });
    expect(tiles[5]).toMatchObject({ row: 1, col: 2, pageIndex: 5 });
  });
});

describe('renderTile 渲染', () => {
  it('单页渲染含背景 + 主体 + 网格 + 拼接标记', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 10, 10);
    const tile = tileGrid(grid)[0];
    const cmds = renderTile(grid, tile);
    // 至少含：1 背景 + 0 主体（全透明）+ 11+11 网格线 + 2 文本（页码 + 行号）
    expect(cmds.some((c) => c.type === 'fillRect')).toBe(true);
    expect(cmds.some((c) => c.type === 'strokeLine')).toBe(true);
    expect(cmds.some((c) => c.type === 'fillText')).toBe(true);
  });

  it('第 1 页（row=0, col=0）→ 无拼接箭头', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 35, 50);
    const tile = tileGrid(grid)[0];
    const cmds = renderTile(grid, tile);
    // 找 "拼接" 文字
    const stitching = cmds.filter((c) => c.type === 'fillText' && c.text.includes('拼接'));
    expect(stitching.length).toBe(0);
  });

  it('非首行首列 → 含拼接箭头', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 70, 100);
    const tiles = tileGrid(grid);
    // 找第 2 页（row=0, col=1）→ 应有左拼接箭头
    const rightTile = tiles[1];
    expect(rightTile.col).toBe(1);
    const cmds = renderTile(grid, rightTile);
    const stitching = cmds.filter((c) => c.type === 'fillText' && c.text.includes('←'));
    expect(stitching.length).toBeGreaterThan(0);
  });

  it('透明背景 → 跳过背景 fillRect', () => {
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 5, 5);
    const tile = tileGrid(grid)[0];
    const normal = renderTile(grid, tile);
    const transparent = renderTile(grid, tile, { transparent: true });
    expect(transparent.length).toBe(normal.length - 1);
  });

  it('非透明格 → 每行 1 段合并 fillRect', () => {
    const palette = makeRgbPalette();
    const cells = new Uint16Array(10 * 10);
    for (let i = 0; i < 10; i++) cells[i] = 0; // 顶部一行全红
    // cells[10..99] 默认 0 = R（也是 H1），所以整张图都是红
    const grid = buildBeadGrid(cells, 10, 10, palette);
    const tile = tileGrid(grid)[0];
    const cmds = renderTile(grid, tile);
    const reds = cmds.filter((c) => c.type === 'fillRect' && c.color === '#FF0000');
    // 10 行 × 1 段/行 = 10 段
    expect(reds.length).toBe(10);
  });

  it('全透明图 → 无主体 fillRect', () => {
    const palette = makeRgbPalette();
    const cells = new Uint16Array(5 * 5).fill(EMPTY_CELL);
    const grid = buildBeadGrid(cells, 5, 5, palette);
    const tile = tileGrid(grid)[0];
    const cmds = renderTile(grid, tile);
    const mainFills = cmds.filter((c) => c.type === 'fillRect' && c.color !== '#FFFFFF');
    expect(mainFills.length).toBe(0);
  });
});
