/**
 * 拼豆专用降采样
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 算法：**格内桶排序 Dominant Color**
 *
 * 与"区域均值"不同：
 *   - 均值会把红色 + 蓝色拉成紫色，丢失清晰边缘
 *   - Dominant 取每格出现频率最高的颜色，保留主体色与边缘
 *
 * 桶设计：每像素压缩为 5-bit RGB key（32³ = 32768 桶），
 * 计数用 Uint32Array。空间与时间均远小于 HashMap。
 *
 * 透明像素（alpha < 128）不计入桶，避免背景色"污染"主体。
 */

import type { ImageData } from '@/types/image';

/** 透明度阈值（低于此值视为透明，不参与 Dominant 统计） */
const ALPHA_THRESHOLD = 128;

/**
 * 把单个 RGB 像素压缩为 5-bit-per-channel key（0-32767）
 *
 * @param r 0-255
 * @param g 0-255
 * @param b 0-255
 * @returns 15-bit key
 */
function rgbKey(r: number, g: number, b: number): number {
  // 截断到 5 位（每通道 0-31）
  const r5 = r >> 3;
  const g5 = g >> 3;
  const b5 = b >> 3;
  return (r5 << 10) | (g5 << 5) | b5;
}

/** 从 15-bit key 还原到原始 RGB（每通道乘 8 + 4 中点） */
function keyToRgb(key: number): [number, number, number] {
  const r5 = (key >> 10) & 0x1f;
  const g5 = (key >> 5) & 0x1f;
  const b5 = key & 0x1f;
  return [r5 * 8 + 4, g5 * 8 + 4, b5 * 8 + 4];
}

/**
 * 降采样到目标网格
 *
 * @param src 原图 ImageData
 * @param gridW 目标网格宽度
 * @param gridH 目标网格高度
 * @returns ImageData（gridW × gridH）
 */
export function downsampleToGrid(
  src: ImageData,
  gridW: number,
  gridH: number,
): ImageData {
  if (gridW <= 0 || gridH <= 0) {
    throw new Error(`Invalid grid size: ${gridW}x${gridH}`);
  }
  if (src.width <= 0 || src.height <= 0) {
    throw new Error(`Invalid source size: ${src.width}x${src.height}`);
  }

  const srcW = src.width;
  const srcH = src.height;
  const srcData = src.data;
  const outData = new Uint8ClampedArray(gridW * gridH * 4);

  // 桶数量：32³ = 32768（5-bit per channel）
  const BUCKET_COUNT = 32768;
  const buckets = new Uint32Array(BUCKET_COUNT);

  // 每格在原图上的覆盖范围（亚像素精度）
  const cellW = srcW / gridW;
  const cellH = srcH / gridH;

  for (let gy = 0; gy < gridH; gy++) {
    // 取样范围 [y0, y1)
    const y0 = Math.floor(gy * cellH);
    const y1 = Math.min(srcH, Math.max(y0 + 1, Math.floor((gy + 1) * cellH)));
    const ySpan = y1 - y0;

    for (let gx = 0; gx < gridW; gx++) {
      const x0 = Math.floor(gx * cellW);
      const x1 = Math.min(srcW, Math.max(x0 + 1, Math.floor((gx + 1) * cellW)));
      const xSpan = x1 - x0;

      // 清空桶（重置为零）
      buckets.fill(0);

      // 桶排序格内像素
      let totalOpaque = 0;
      for (let y = y0; y < y1; y++) {
        const rowStart = y * srcW * 4;
        for (let x = x0; x < x1; x++) {
          const i = rowStart + x * 4;
          const a = srcData[i + 3];
          if (a < ALPHA_THRESHOLD) continue;
          const key = rgbKey(srcData[i], srcData[i + 1], srcData[i + 2]);
          buckets[key]++;
          totalOpaque++;
        }
      }

      // 找桶计数最大值（平局取 key 较小者 → 颜色更纯）
      let bestKey = 0;
      let bestCount = 0;
      for (let k = 0; k < BUCKET_COUNT; k++) {
        const c = buckets[k];
        if (c > bestCount) {
          bestCount = c;
          bestKey = k;
        }
      }

      const outIdx = (gy * gridW + gx) * 4;
      if (totalOpaque === 0) {
        // 全透明格 → 输出透明
        outData[outIdx] = 0;
        outData[outIdx + 1] = 0;
        outData[outIdx + 2] = 0;
        outData[outIdx + 3] = 0;
      } else {
        const [r, g, b] = keyToRgb(bestKey);
        outData[outIdx] = r;
        outData[outIdx + 1] = g;
        outData[outIdx + 2] = b;
        // alpha 用格内总不透明像素的覆盖率（不是主色像素数）
        // 这样随机噪声图也能正确输出不透明格 → 后续 quantize 不会误判为透明
        const opacity = Math.min(255, Math.round((totalOpaque * 255) / (xSpan * ySpan)));
        outData[outIdx + 3] = opacity;
      }
    }
  }

  return {
    data: outData,
    width: gridW,
    height: gridH,
  };
}
