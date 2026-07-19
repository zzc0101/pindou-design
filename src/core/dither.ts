/**
 * Floyd-Steinberg 有序抖动
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 把量化误差扩散到邻居像素，降低大色块区的色阶断层。
 * 系数矩阵：
 *                 *  7
 *             3   5   1
 *             （右下、左、下、左下各分配 1/16）
 *
 * 参考：[Floyd-Steinberg 1976](https://en.wikipedia.org/wiki/Floyd%E2%80%93Steinberg_dithering)
 */

import type { ImageData } from '@/types/image';
import type { PaletteIndex } from './color/nearest-color';
import { rgbToLab } from './color/rgb-to-lab';
import { EMPTY_CELL } from './color-quantize';
import { perf } from '@/utils/perf-monitor';

/** 透明度阈值 */
const ALPHA_THRESHOLD = 128;

/** 把浮点通道值钳制到合法 [0, 255] 整数 */
function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * Floyd-Steinberg 抖动 + Lab 最近邻量化
 *
 * @param image 降采样后的网格图像
 * @param index 色板 Lab 索引
 * @returns Uint16Array cells（含 EMPTY_CELL sentinel）
 */
export function dither(image: ImageData, index: PaletteIndex): Uint16Array {
  return perf.measureSync(
    'dither',
    () => ditherImpl(image, index),
    { w: image.width, h: image.height, paletteSize: index.palette.entries.length },
  );
}

function ditherImpl(image: ImageData, index: PaletteIndex): Uint16Array {
  const w = image.width;
  const h = image.height;
  const srcData = image.data;
  const cells = new Uint16Array(w * h);

  // 可修改的 RGB 浮点 buffer（用于累积误差）
  // 用 Float32Array 避免中间 int 截断
  const buf = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    buf[i * 3] = srcData[i * 4];
    buf[i * 3 + 1] = srcData[i * 4 + 1];
    buf[i * 3 + 2] = srcData[i * 4 + 2];
  }

  // 预解析 hex → rgb（避免循环里重复 parse）
  const entryRgb = new Uint8Array(index.palette.entries.length * 3);
  for (let i = 0; i < index.palette.entries.length; i++) {
    const hex = index.palette.entries[i].hex;
    entryRgb[i * 3] = parseInt(hex.substring(1, 3), 16);
    entryRgb[i * 3 + 1] = parseInt(hex.substring(3, 5), 16);
    entryRgb[i * 3 + 2] = parseInt(hex.substring(5, 7), 16);
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const a = srcData[idx * 4 + 3];

      // 透明像素保持 EMPTY_CELL（不扩散误差）
      if (a < ALPHA_THRESHOLD) {
        cells[idx] = EMPTY_CELL;
        continue;
      }

      // 1) 当前像素（含累积误差）
      const r = clamp(buf[idx * 3]);
      const g = clamp(buf[idx * 3 + 1]);
      const b = clamp(buf[idx * 3 + 2]);

      // 2) Lab 最近邻
      const lab = rgbToLab(r, g, b);
      const paletteIdx = index.find(lab);
      cells[idx] = paletteIdx;

      // 3) 量化色
      const qr = entryRgb[paletteIdx * 3];
      const qg = entryRgb[paletteIdx * 3 + 1];
      const qb = entryRgb[paletteIdx * 3 + 2];

      // 4) 误差
      const er = r - qr;
      const eg = g - qg;
      const eb = b - qb;

      // 5) Floyd-Steinberg 误差扩散
      //    当前位置 * ，扩散到 (x+1, y), (x-1, y+1), (x, y+1), (x+1, y+1)
      if (x + 1 < w) {
        const ni = (y * w + (x + 1)) * 3;
        buf[ni] += er * (7 / 16);
        buf[ni + 1] += eg * (7 / 16);
        buf[ni + 2] += eb * (7 / 16);
      }
      if (y + 1 < h) {
        if (x - 1 >= 0) {
          const ni = ((y + 1) * w + (x - 1)) * 3;
          buf[ni] += er * (3 / 16);
          buf[ni + 1] += eg * (3 / 16);
          buf[ni + 2] += eb * (3 / 16);
        }
        {
          const ni = ((y + 1) * w + x) * 3;
          buf[ni] += er * (5 / 16);
          buf[ni + 1] += eg * (5 / 16);
          buf[ni + 2] += eb * (5 / 16);
        }
        if (x + 1 < w) {
          const ni = ((y + 1) * w + (x + 1)) * 3;
          buf[ni] += er * (1 / 16);
          buf[ni + 1] += eg * (1 / 16);
          buf[ni + 2] += eb * (1 / 16);
        }
      }
    }
  }

  return cells;
}
