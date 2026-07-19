/**
 * BeadGrid Canvas 渲染指令生成器
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 输出"渲染指令"列表，业务层（小程序 canvas）按指令执行 draw。
 * 关键优化：**同色行扫描合并**——连续同色合并为单个 fillRect，
 * 把 N×N 次 fillRect 降到约 N×M（M = 平均每行颜色段数）。
 *
 * 100×100 网格、约 30 色板的渐变图：
 *   朴素：10000 次 fillRect
 *   合并后：约 3000 次（节省 70%）
 */

import type { BeadGrid } from '@/types/bead';
import { EMPTY_CELL } from '@/core/color-quantize';

/** 渲染指令 */
export type RenderCommand =
  | { type: 'fillRect'; x: number; y: number; w: number; h: number; color: string }
  | { type: 'strokeLine'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { type: 'fillText'; x: number; y: number; text: string; color: string; fontSize: number };

/** 渲染选项 */
export interface BeadRenderOptions {
  /** 单格像素尺寸 */
  cellSize: number;
  /** 是否画网格线 */
  showGrid: boolean;
  /** 是否画加粗主线（每 N 格） */
  majorGridStep: number;
  /** 主线宽 */
  majorGridWidth: number;
  /** 次线宽 */
  minorGridWidth: number;
  /** 主线颜色 */
  majorGridColor: string;
  /** 次线颜色 */
  minorGridColor: string;
  /** 是否画色号文本（每 N 格） */
  labelStep: number;
  /** 文本颜色 */
  labelColor: string;
  /** 文本字号 */
  labelFontSize: number;
  /** 背景色（transparent=true 时忽略） */
  background: string;
  /** 透明背景：跳过背景 fillRect，PNG 输出保留 alpha 通道 */
  transparent?: boolean;
}

const DEFAULT_OPTIONS: BeadRenderOptions = {
  cellSize: 12,
  showGrid: true,
  majorGridStep: 5,
  majorGridWidth: 1,
  minorGridWidth: 1,
  majorGridColor: 'rgba(0,0,0,0.4)',
  minorGridColor: 'rgba(0,0,0,0.15)',
  labelStep: 0,
  labelColor: 'rgba(0,0,0,0.6)',
  labelFontSize: 10,
  background: '#FFFFFF',
  transparent: false,
};

/**
 * 生成 BeadGrid 的渲染指令
 *
 * @param grid BeadGrid
 * @param options 渲染选项（不传用默认）
 * @returns RenderCommand 数组
 */
export function buildRenderCommands(
  grid: BeadGrid,
  options: Partial<BeadRenderOptions> = {},
): RenderCommand[] {
  const opts: BeadRenderOptions = { ...DEFAULT_OPTIONS, ...options };
  const { cellSize: cs } = opts;
  const out: RenderCommand[] = [];

  // 1) 背景（透明模式跳过，PNG 输出保留 alpha 通道）
  const bgW = grid.width * cs;
  const bgH = grid.height * cs;
  if (!opts.transparent) {
    out.push({ type: 'fillRect', x: 0, y: 0, w: bgW, h: bgH, color: opts.background });
  }

  // 2) 每格填色（同色行扫描合并）
  for (let y = 0; y < grid.height; y++) {
    let runStart = -1;
    let runColor = '';
    for (let x = 0; x <= grid.width; x++) {
      let curColor = '';
      if (x < grid.width) {
        const idx = grid.cells[y * grid.width + x];
        if (idx !== EMPTY_CELL) {
          curColor = grid.palette.entries[idx]?.hex ?? '';
        }
      }
      // 颜色变化或行末 → 提交 run
      if (curColor !== runColor) {
        if (runColor && runStart >= 0) {
          out.push({
            type: 'fillRect',
            x: runStart * cs,
            y: y * cs,
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

  // 3) 网格线
  if (opts.showGrid) {
    // 次线（每格）
    for (let i = 0; i <= grid.width; i++) {
      out.push({
        type: 'strokeLine',
        x1: i * cs,
        y1: 0,
        x2: i * cs,
        y2: bgH,
        color: opts.minorGridColor,
        width: opts.minorGridWidth,
      });
    }
    for (let i = 0; i <= grid.height; i++) {
      out.push({
        type: 'strokeLine',
        x1: 0,
        y1: i * cs,
        x2: bgW,
        y2: i * cs,
        color: opts.minorGridColor,
        width: opts.minorGridWidth,
      });
    }
    // 主线（每 majorGridStep 格）
    if (opts.majorGridStep > 1) {
      for (let i = 0; i <= grid.width; i += opts.majorGridStep) {
        if (i === 0 || i === grid.width) continue;
        out.push({
          type: 'strokeLine',
          x1: i * cs,
          y1: 0,
          x2: i * cs,
          y2: bgH,
          color: opts.majorGridColor,
          width: opts.majorGridWidth,
        });
      }
      for (let i = 0; i <= grid.height; i += opts.majorGridStep) {
        if (i === 0 || i === grid.height) continue;
        out.push({
          type: 'strokeLine',
          x1: 0,
          y1: i * cs,
          x2: bgW,
          y2: i * cs,
          color: opts.majorGridColor,
          width: opts.majorGridWidth,
        });
      }
    }
  }

  // 4) 色号文本（每 labelStep 格中心）
  if (opts.labelStep > 0) {
    for (let y = 0; y < grid.height; y += opts.labelStep) {
      for (let x = 0; x < grid.width; x += opts.labelStep) {
        const idx = grid.cells[y * grid.width + x];
        if (idx === EMPTY_CELL) continue;
        const code = grid.palette.entries[idx]?.code;
        if (!code) continue;
        out.push({
          type: 'fillText',
          x: x * cs + cs / 2,
          y: y * cs + cs / 2,
          text: code,
          color: opts.labelColor,
          fontSize: opts.labelFontSize,
        });
      }
    }
  }

  return out;
}
