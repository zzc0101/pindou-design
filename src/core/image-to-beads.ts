/**
 * 图片转拼豆图纸 - 主流程编排
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 主流程三步：
 *   1. downsampleToGrid  ：原图 → 目标网格（格内 Dominant Color）
 *   2. quantize 或 dither：每像素 → 色卡下标（Lab 最近邻，可选 Floyd-Steinberg 抖动）
 *   3. buildBeadGrid     ：构造 BeadGrid（含统计）
 */

import type { BeadGrid } from '@/types/bead';
import type { ImageData } from '@/types/image';
import type { Palette } from '@/types/palette';
import { buildPaletteIndex } from './color/nearest-color';
import { downsampleToGrid } from './downsample';
import { quantize } from './color-quantize';
import { dither } from './dither';
import { removeBackground } from './background-removal';
import { buildBeadGrid } from './grid-builder';
import { perf } from '@/utils/perf-monitor';

/** 主流程入参 */
export interface BeadOptions {
  /** 网格宽度（格子数） */
  gridWidth: number;
  /** 网格高度（格子数） */
  gridHeight: number;
  /** 色板 */
  palette: Palette;
  /** 是否启用 Floyd-Steinberg 抖动（默认 false） */
  dithering?: boolean;
  /** 是否移除背景（默认 false） */
  removeBackground?: boolean;
}

/**
 * 把图片转换为拼豆网格
 *
 * @param src 原图 ImageData
 * @param opts 选项（网格尺寸、色板、可选抖动 + 背景移除）
 * @returns BeadGrid
 */
export function imageToBeads(src: ImageData, opts: BeadOptions): BeadGrid {
  return perf.measureSync(
    'imageToBeads',
    () => {
      // 0) 预建色板索引（一次性）
      const index = buildPaletteIndex(opts.palette);

      // 1) 降采样
      let gridImage = downsampleToGrid(src, opts.gridWidth, opts.gridHeight);

      // 2) 可选：背景移除（在量化前，让背景格变透明 → 不占豆子）
      if (opts.removeBackground) {
        gridImage = removeBackground(gridImage);
      }

      // 3) 量化（抖动 或 普通）
      const cells = opts.dithering ? dither(gridImage, index) : quantize(gridImage, index);

      // 4) 构造 BeadGrid
      return buildBeadGrid(cells, opts.gridWidth, opts.gridHeight, opts.palette);
    },
    {
      gridW: opts.gridWidth,
      gridH: opts.gridHeight,
      paletteSize: opts.palette.entries.length,
      dithering: opts.dithering ?? false,
    },
  );
}
