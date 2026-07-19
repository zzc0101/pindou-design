/**
 * BeadGrid 渲染器（立体豆子视觉版）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 与 bead-renderer.ts 不同：本渲染器在主体色基础上叠加：
 *   1. 中心高光（白色 alpha 0.3，模拟豆子顶部反光）
 *   2. 暗边（黑色 alpha 0.15，下边 + 右边，模拟光照阴影）
 *
 * 视觉效果：豆子看起来像凸起的圆顶，而非平面像素。
 * 性能：100×100 ≈ 400 fillRect（vs flat 模式 100），仍很快。
 */

import type { BeadGrid } from '@/types/bead';
import { EMPTY_CELL } from '@/core/color-quantize';
import type { RenderCommand } from './bead-renderer';

/** 视觉补偿版选项（与 flat 版共享大部分字段） */
export interface BeadRender3DOptions {
  cellSize: number;
  showGrid: boolean;
  majorGridStep: number;
  majorGridWidth: number;
  minorGridWidth: number;
  majorGridColor: string;
  minorGridColor: string;
  /** 高光 alpha（白色，0 = 关闭高光） */
  highlightAlpha: number;
  /** 暗边 alpha（黑色，0 = 关闭暗边） */
  shadowAlpha: number;
  background: string;
  /** 透明背景 */
  transparent?: boolean;
}

const DEFAULTS_3D: BeadRender3DOptions = {
  cellSize: 12,
  showGrid: true,
  majorGridStep: 5,
  majorGridWidth: 1,
  minorGridWidth: 1,
  majorGridColor: 'rgba(0,0,0,0.4)',
  minorGridColor: 'rgba(0,0,0,0.15)',
  highlightAlpha: 0.3,
  shadowAlpha: 0.15,
  background: '#FFFFFF',
  transparent: false,
};

/**
 * 生成 BeadGrid 的立体豆子视觉渲染指令
 *
 * Pass 1: 主体色（按行合并 fillRect）
 * Pass 2: 中心高光（每格 1 fillRect，行合并）
 * Pass 3: 暗边（下 + 右，每格 2 fillRect，行合并）
 * Pass 4: 网格线（与 flat 版相同）
 */
export function buildRenderCommands3D(
  grid: BeadGrid,
  options: Partial<BeadRender3DOptions> = {},
): RenderCommand[] {
  const opts: BeadRender3DOptions = { ...DEFAULTS_3D, ...options };
  const { cellSize: cs } = opts;
  const out: RenderCommand[] = [];

  // 1) 背景（透明模式跳过）
  const bgW = grid.width * cs;
  const bgH = grid.height * cs;
  if (!opts.transparent) {
    out.push({ type: 'fillRect', x: 0, y: 0, w: bgW, h: bgH, color: opts.background });
  }

  // 2) Pass 1：主体色（行合并）
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

  // 3) Pass 2：中心高光（白色 alpha）
  if (opts.highlightAlpha > 0) {
    const hiColor = `rgba(255,255,255,${opts.highlightAlpha})`;
    const inset = cs * 0.25;
    const hiSize = cs - 2 * inset;
    if (hiSize > 0) {
      // 同样按行合并（颜色一致）
      for (let y = 0; y < grid.height; y++) {
        let runStart = -1;
        let runValid = false;
        for (let x = 0; x <= grid.width; x++) {
          const valid =
            x < grid.width && grid.cells[y * grid.width + x] !== EMPTY_CELL;
          if (valid !== runValid || (valid && runStart < 0)) {
            if (runValid && runStart >= 0) {
              out.push({
                type: 'fillRect',
                x: runStart * cs + inset,
                y: y * cs + inset,
                w: (x - runStart) * cs,
                h: hiSize,
                color: hiColor,
              });
            }
            runStart = x;
            runValid = valid;
          }
        }
      }
    }
  }

  // 4) Pass 3：暗边（下 + 右）
  if (opts.shadowAlpha > 0) {
    const shColor = `rgba(0,0,0,${opts.shadowAlpha})`;
    const shadowW = Math.max(1, Math.floor(cs * 0.1)); // 暗边宽 = 10% cs
    for (let y = 0; y < grid.height; y++) {
      // 下边
      let runStart = -1;
      let runValid = false;
      for (let x = 0; x <= grid.width; x++) {
        const valid =
          x < grid.width && grid.cells[y * grid.width + x] !== EMPTY_CELL;
        if (valid !== runValid) {
          if (runValid && runStart >= 0) {
            out.push({
              type: 'fillRect',
              x: runStart * cs,
              y: y * cs + cs - shadowW,
              w: (x - runStart) * cs,
              h: shadowW,
              color: shColor,
            });
          }
          runStart = x;
          runValid = valid;
        }
      }
      // 右边
      runStart = -1;
      runValid = false;
      for (let x = 0; x <= grid.width; x++) {
        const valid =
          x < grid.width && grid.cells[y * grid.width + x] !== EMPTY_CELL;
        if (valid !== runValid) {
          if (runValid && runStart >= 0) {
            out.push({
              type: 'fillRect',
              x: x * cs - shadowW,
              y: y * cs,
              w: shadowW,
              h: cs,
              color: shColor,
            });
          }
          runStart = x;
          runValid = valid;
        }
      }
    }
  }

  // 5) Pass 4：网格线（与 flat 版相同）
  if (opts.showGrid) {
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

  return out;
}
