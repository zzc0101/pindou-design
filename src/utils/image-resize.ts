/**
 * 纯 JS 图像缩放工具
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 算法：Box Filter（区域平均）
 *   - 优于最近邻（边缘锯齿少）
 *   - 弱于 Lanczos3（频率信息略损失）
 *   - 不依赖 canvas，可在 Node/Vitest 中直接跑
 *
 * 用途：大图预处理（如 4000×3000 → 2000×1500），喂给 imageToBeads
 */

import type { ImageData } from '@/types/image';
import { perf } from './perf-monitor';

/**
 * 计算等比缩放后的尺寸（保证最长边 ≤ maxEdge）
 *
 * @param srcW 源宽
 * @param srcH 源高
 * @param maxEdge 最长边上限
 * @returns 缩放后尺寸；若原图已 ≤ maxEdge 则返回原尺寸
 */
export function computeResizeSize(
  srcW: number,
  srcH: number,
  maxEdge: number,
): { w: number; h: number } {
  if (srcW <= maxEdge && srcH <= maxEdge) {
    return { w: srcW, h: srcH };
  }
  const ratio = maxEdge / Math.max(srcW, srcH);
  return {
    w: Math.max(1, Math.round(srcW * ratio)),
    h: Math.max(1, Math.round(srcH * ratio)),
  };
}

/**
 * Box Filter 缩放
 *
 * @param src 源图像
 * @param targetW 目标宽度
 * @param targetH 目标高度
 * @returns 缩放后的 ImageData
 */
export function resizeImage(
  src: ImageData,
  targetW: number,
  targetH: number,
): ImageData {
  if (targetW <= 0 || targetH <= 0) {
    throw new Error(`Invalid target size: ${targetW}x${targetH}`);
  }
  if (src.width <= 0 || src.height <= 0) {
    throw new Error(`Invalid source size: ${src.width}x${src.height}`);
  }

  const srcW = src.width;
  const srcH = src.height;
  const srcData = src.data;
  const dst = new Uint8ClampedArray(targetW * targetH * 4);

  for (let dy = 0; dy < targetH; dy++) {
    // 源 y 范围 [y0, y1)
    const y0 = Math.floor((dy * srcH) / targetH);
    const y1 = Math.max(y0 + 1, Math.floor(((dy + 1) * srcH) / targetH));
    const ySpan = y1 - y0;

    for (let dx = 0; dx < targetW; dx++) {
      const x0 = Math.floor((dx * srcW) / targetW);
      const x1 = Math.max(x0 + 1, Math.floor(((dx + 1) * srcW) / targetW));
      const xSpan = x1 - x0;

      let r = 0;
      let g = 0;
      let b = 0;
      let opaqueCount = 0;

      // 区域均值（alpha < 128 不计入）
      for (let y = y0; y < y1; y++) {
        const rowStart = y * srcW * 4;
        for (let x = x0; x < x1; x++) {
          const i = rowStart + x * 4;
          const alpha = srcData[i + 3];
          if (alpha < 128) continue;
          r += srcData[i];
          g += srcData[i + 1];
          b += srcData[i + 2];
          opaqueCount++;
        }
      }

      const o = (dy * targetW + dx) * 4;
      if (opaqueCount === 0) {
        dst[o] = 0;
        dst[o + 1] = 0;
        dst[o + 2] = 0;
        dst[o + 3] = 0;
      } else {
        // opacity 用覆盖比例（不除以 xSpan*ySpan）以反映"该位置实色覆盖率"
        dst[o] = Math.round(r / opaqueCount);
        dst[o + 1] = Math.round(g / opaqueCount);
        dst[o + 2] = Math.round(b / opaqueCount);
        dst[o + 3] = Math.min(255, Math.round((opaqueCount * 255) / (xSpan * ySpan)));
      }
    }
  }

  return { data: dst, width: targetW, height: targetH, colorSpace: 'srgb' };
}

/**
 * 一步到位：把源图等比缩放到最长边 ≤ maxEdge
 */
export function resizeToFit(src: ImageData, maxEdge: number): ImageData {
  return perf.measureSync(
    'resizeToFit',
    () => {
      const { w, h } = computeResizeSize(src.width, src.height, maxEdge);
      if (w === src.width && h === src.height) return src;
      return resizeImage(src, w, h);
    },
    { srcW: src.width, srcH: src.height, maxEdge },
  );
}
