/**
 * 大图分页打印（A3/A4 智能分页）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 当 BeadGrid 超过单页容量（默认 35×50），自动分成多页打印。
 * 每页带拼接标记（边缘标页码 + 拼接线 + 居中图纸 + 第 1 页加图例）。
 *
 * 增强版（W29-C）：
 *   - 居中放置：图纸 < 35×50 时居中
 *   - 页眉：每页顶部加图纸名 + 页码 + 拼接说明
 *   - 图例：第 1 页加颜色用量前 10 名
 *   - 空白优化：不浪费纸张
 */

import type { BeadGrid } from '@/types/bead';
import { EMPTY_CELL } from '@/core/color-quantize';
import type { RenderCommand } from './bead-renderer';

/** 分页选项 */
export interface TileOptions {
  cellsPerPageX: number;
  cellsPerPageY: number;
  overlap: number;
  cellSize: number;
  majorGridStep: number;
  majorGridWidth: number;
  minorGridWidth: number;
  majorGridColor: string;
  minorGridColor: string;
  markerColor: string;
  background: string;
  transparent?: boolean;
  /** 页眉配置（null = 不画页眉） */
  header: {
    title: string;
    paletteName: string;
  } | null;
  /** 图例配置（null = 不画图例） */
  legend: {
    /** 显示前 N 主色 */
    topN: number;
  } | null;
}

const DEFAULT_TILE_OPTIONS: TileOptions = {
  cellsPerPageX: 35,
  cellsPerPageY: 50,
  overlap: 2,
  cellSize: 24,
  majorGridStep: 5,
  majorGridWidth: 1,
  minorGridWidth: 1,
  majorGridColor: 'rgba(0,0,0,0.4)',
  minorGridColor: 'rgba(0,0,0,0.15)',
  markerColor: 'rgba(230, 0, 18, 0.7)',
  background: '#FFFFFF',
  transparent: false,
  header: { title: '拼豆图纸', paletteName: '' },
  legend: { topN: 10 },
};

/** 单页分块结果 */
export interface TileResult {
  pageIndex: number;
  row: number;
  col: number;
  totalPages: number;
  cellOffsetX: number;
  cellOffsetY: number;
  cellWidth: number;
  cellHeight: number;
  /** 该页在画布中的 X 偏移（含居中） */
  drawOffsetX: number;
  /** 该页在画布中的 Y 偏移（含页眉 + 居中） */
  drawOffsetY: number;
}

/** 智能分页（按画布尺寸 + 居中 + 页眉 + 图例） */
export function tileGrid(
  grid: BeadGrid,
  options: Partial<TileOptions> = {},
): TileResult[] {
  const opts = { ...DEFAULT_TILE_OPTIONS, ...options };
  const stepX = Math.max(1, opts.cellsPerPageX - opts.overlap);
  const stepY = Math.max(1, opts.cellsPerPageY - opts.overlap);

  const cols = grid.width <= opts.cellsPerPageX ? 1 : Math.ceil((grid.width - opts.overlap) / stepX);
  const rows = grid.height <= opts.cellsPerPageY ? 1 : Math.ceil((grid.height - opts.overlap) / stepY);
  const totalPages = cols * rows;

  const tiles: TileResult[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * stepX;
      const y = row * stepY;
      const w = Math.min(opts.cellsPerPageX, grid.width - x);
      const h = Math.min(opts.cellsPerPageY, grid.height - y);
      // 居中：图纸 < 页面 → 居中
      const cs = opts.cellSize;
      const headerH = opts.header ? Math.floor(cs * 1.2) : 0;
      const legendH = opts.legend && row === 0 && col === 0 ? Math.floor(cs * 6) : 0; // 第 1 页加图例
      const cellW = w * cs;
      const cellH = h * cs;
      const pageW = opts.cellsPerPageX * cs;
      const pageH = opts.cellsPerPageY * cs + headerH + legendH;
      const drawOffsetX = Math.floor((pageW - cellW) / 2);
      const drawOffsetY = headerH;
      tiles.push({
        pageIndex: row * cols + col,
        row,
        col,
        totalPages,
        cellOffsetX: x,
        cellOffsetY: y,
        cellWidth: w,
        cellHeight: h,
        drawOffsetX,
        drawOffsetY,
      });
    }
  }
  return tiles;
}

/** 提取主色（按用量降序） */
function getMainColors(grid: BeadGrid, topN: number): Array<{ code: string; hex: string; count: number }> {
  const arr: Array<{ code: string; hex: string; count: number }> = [];
  grid.stats.colorCounts.forEach((count, idx) => {
    const entry = grid.palette.entries[idx];
    if (!entry) return;
    arr.push({ code: entry.code, hex: entry.hex, count });
  });
  arr.sort((a, b) => b.count - a.count);
  return arr.slice(0, topN);
}

/** 渲染单页到 RenderCommand 列表（智能版：含页眉 + 图例） */
export function renderTile(
  grid: BeadGrid,
  tile: TileResult,
  options: Partial<TileOptions> = {},
): RenderCommand[] {
  const opts = { ...DEFAULT_TILE_OPTIONS, ...options };
  const cs = opts.cellSize;
  const out: RenderCommand[] = [];

  // 计算页眉和图例区域
  const headerH = opts.header ? Math.floor(cs * 1.2) : 0;
  const isFirstPage = tile.row === 0 && tile.col === 0;
  const legendH =
    opts.legend && isFirstPage ? Math.floor(cs * 6) : 0;
  const pageW = opts.cellsPerPageX * cs;
  const pageH = opts.cellsPerPageY * cs + headerH + legendH;

  // 1) 背景
  if (!opts.transparent) {
    out.push({ type: 'fillRect', x: 0, y: 0, w: pageW, h: pageH, color: opts.background });
  }

  // 2) 页眉
  if (opts.header) {
    const title = opts.header.title;
    const paletteName = opts.header.paletteName;
    out.push({
      type: 'fillText',
      x: 4,
      y: headerH * 0.6,
      text: title,
      color: 'rgba(0,0,0,0.85)',
      fontSize: Math.floor(cs * 0.55),
    });
    out.push({
      type: 'fillText',
      x: pageW - 4,
      y: headerH * 0.6,
      text: `第 ${tile.pageIndex + 1}/${tile.totalPages} 页`,
      color: 'rgba(230,0,18,0.85)',
      fontSize: Math.floor(cs * 0.55),
    });
    // 分隔线
    out.push({
      type: 'strokeLine',
      x1: 0,
      y1: headerH,
      x2: pageW,
      y2: headerH,
      color: 'rgba(0,0,0,0.3)',
      width: 1,
    });
    if (paletteName) {
      out.push({
        type: 'fillText',
        x: 4,
        y: headerH * 0.95,
        text: paletteName,
        color: 'rgba(0,0,0,0.5)',
        fontSize: Math.floor(cs * 0.4),
      });
    }
  }

  // 3) 主体：每行合并 fillRect（居中）
  const drawX = tile.drawOffsetX;
  const drawY = tile.drawOffsetY + headerH - 0; // drawOffsetY 已含 headerH
  for (let y = 0; y < tile.cellHeight; y++) {
    let runStart = -1;
    let runColor = '';
    for (let x = 0; x <= tile.cellWidth; x++) {
      let curColor = '';
      if (x < tile.cellWidth) {
        const idx = grid.cells[(y + tile.cellOffsetY) * grid.width + (x + tile.cellOffsetX)];
        if (idx !== EMPTY_CELL) {
          curColor = grid.palette.entries[idx]?.hex ?? '';
        }
      }
      if (curColor !== runColor) {
        if (runColor && runStart >= 0) {
          out.push({
            type: 'fillRect',
            x: drawX + runStart * cs,
            y: drawY + y * cs,
            w: (x - runStart) * cs,
            h: cs,
            color: runColor,
          });
        }
        runStart = x;
        runColor = curColor;
      }
    }
  }

  // 4) 网格线（次线 + 主线）
  for (let i = 0; i <= tile.cellWidth; i++) {
    out.push({
      type: 'strokeLine',
      x1: drawX + i * cs,
      y1: drawY,
      x2: drawX + i * cs,
      y2: drawY + tile.cellHeight * cs,
      color: opts.minorGridColor,
      width: opts.minorGridWidth,
    });
  }
  for (let i = 0; i <= tile.cellHeight; i++) {
    out.push({
      type: 'strokeLine',
      x1: drawX,
      y1: drawY + i * cs,
      x2: drawX + tile.cellWidth * cs,
      y2: drawY + i * cs,
      color: opts.minorGridColor,
      width: opts.minorGridWidth,
    });
  }
  for (let i = 0; i <= tile.cellWidth; i += opts.majorGridStep) {
    if (i === 0 || i === tile.cellWidth) continue;
    out.push({
      type: 'strokeLine',
      x1: drawX + i * cs,
      y1: drawY,
      x2: drawX + i * cs,
      y2: drawY + tile.cellHeight * cs,
      color: opts.majorGridColor,
      width: opts.majorGridWidth,
    });
  }
  for (let i = 0; i <= tile.cellHeight; i += opts.majorGridStep) {
    if (i === 0 || i === tile.cellHeight) continue;
    out.push({
      type: 'strokeLine',
      x1: drawX,
      y1: drawY + i * cs,
      x2: drawX + tile.cellWidth * cs,
      y2: drawY + i * cs,
      color: opts.majorGridColor,
      width: opts.majorGridWidth,
    });
  }

  // 5) 拼接标记（页边）
  const labelColor = opts.markerColor;
  const labelSize = Math.max(10, Math.floor(cs * 0.4));
  if (tile.col > 0) {
    out.push({
      type: 'fillText',
      x: pageW / 2,
      y: headerH - labelSize / 2,
      text: '← 拼接',
      color: labelColor,
      fontSize: labelSize,
    });
  }
  if (tile.row > 0) {
    out.push({
      type: 'fillText',
      x: -labelSize * 2,
      y: drawY + (tile.cellHeight * cs) / 2,
      text: '↑ 拼接',
      color: labelColor,
      fontSize: labelSize,
    });
  }

  // 6) 图例（仅第 1 页）
  if (opts.legend && isFirstPage) {
    const legendY = drawY + tile.cellHeight * cs + Math.floor(cs * 0.5);
    out.push({
      type: 'fillText',
      x: 4,
      y: legendY,
      text: '颜色用量 TOP ' + opts.legend.topN,
      color: 'rgba(0,0,0,0.7)',
      fontSize: Math.floor(cs * 0.45),
    });
    const mains = getMainColors(grid, opts.legend.topN);
    const swatchSize = Math.floor(cs * 0.6);
    const swatchGap = Math.floor(cs * 0.3);
    mains.forEach((m, idx) => {
      const col = idx % 5;
      const row = Math.floor(idx / 5);
      const x = col * (swatchSize + swatchGap * 2) + 4;
      const y = legendY + Math.floor(cs * 0.8) + row * (swatchSize + 6);
      out.push({
        type: 'fillRect',
        x,
        y,
        w: swatchSize,
        h: swatchSize,
        color: m.hex,
      });
      out.push({
        type: 'fillText',
        x: x + swatchSize + 4,
        y: y + swatchSize * 0.7,
        text: `${m.code} ×${m.count}`,
        color: 'rgba(0,0,0,0.7)',
        fontSize: Math.floor(cs * 0.35),
      });
    });
  }

  return out;
}