/**
 * 颜色量化
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 把 ImageData 每个像素映射到色卡下标，输出 Uint16Array。
 * 透明像素（alpha < 128）保持 0（约定：色卡下标 0 是"空"）。
 */

import type { ImageData } from '@/types/image';
import type { PaletteIndex } from './color/nearest-color';
import { rgbToLab } from './color/rgb-to-lab';
import { perf } from '@/utils/perf-monitor';

/** 透明度阈值 */
const ALPHA_THRESHOLD = 128;

/**
 * cells 中表示"无色/透明"的 sentinel 值
 *
 * 选 UINT16_MAX（65535）而非 0 的原因：
 *   色卡下标 0 是合法值（H1 等），不能用 0 兼作"空"。
 *   UINT16_MAX 是真实色卡永远到不了的下标（当前色板最多 138 色）。
 */
export const EMPTY_CELL = 0xffff;

/**
 * 把 ImageData 量化为色卡下标数组
 *
 * @param image 降采样后的网格图像
 * @param index 色板 Lab 索引
 * @returns Uint16Array，长度 = image.width * image.height；透明格 = EMPTY_CELL
 */
export function quantize(image: ImageData, index: PaletteIndex): Uint16Array {
  return perf.measureSync(
    'quantize',
    () => quantizeImpl(image, index),
    { w: image.width, h: image.height, paletteSize: index.palette.entries.length },
  );
}

function quantizeImpl(image: ImageData, index: PaletteIndex): Uint16Array {
  const w = image.width;
  const h = image.height;
  const data = image.data;
  const cells = new Uint16Array(w * h);

  for (let i = 0; i < w * h; i++) {
    const off = i * 4;
    const a = data[off + 3];
    if (a < ALPHA_THRESHOLD) {
      cells[i] = EMPTY_CELL;
      continue;
    }
    const lab = rgbToLab(data[off], data[off + 1], data[off + 2]);
    cells[i] = index.find(lab);
  }
  return cells;
}
