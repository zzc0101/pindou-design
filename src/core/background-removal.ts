/**
 * 背景移除（自动四边 flood fill）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 算法：BFS 4 邻域 flood fill
 *   1) 取图像四角的像素作为"背景种子"（4 个 Lab 值）
 *   2) 从种子开始 BFS：相邻像素 Lab 与种子 ΔE2000 < tolerance → 标记为背景
 *   3) 把背景像素的 alpha 设为 0（让 quantize 当作 EMPTY_CELL）
 *
 * 假设：主体居中、背景在边角（最常见情况）。
 * 局限性：若主体紧贴边角，会被误判为背景。
 *
 * 性能：gridW × gridH ≤ 10000 时 < 5ms（M3）。
 */

import type { ImageData } from '@/types/image';
import { rgbToLab } from './color/rgb-to-lab';
import { deltaE2000 } from './color/delta-e';

/** 默认色差容差（ΔE2000 < 30 视为同色） */
const DEFAULT_TOLERANCE = 30;

/**
 * 移除图像背景
 *
 * @param image 降采样后的网格图像
 * @param tolerance ΔE2000 容差阈值
 * @returns 新的 ImageData（背景像素 alpha=0）
 */
export function removeBackground(image: ImageData, tolerance: number = DEFAULT_TOLERANCE): ImageData {
  const w = image.width;
  const h = image.height;
  const src = image.data;
  const out = new Uint8ClampedArray(src);

  if (w === 0 || h === 0) return image;

  // 1) 取四角的 Lab 种子
  const seedIndices = [0, w - 1, (h - 1) * w, (h - 1) * w + (w - 1)];
  const seedLabs: Array<readonly [number, number, number]> = [];
  for (const si of seedIndices) {
    const r = src[si * 4];
    const g = src[si * 4 + 1];
    const b = src[si * 4 + 2];
    if (src[si * 4 + 3] >= 128) {
      // 只用不透明的角作为种子（透明角无意义）
      seedLabs.push(rgbToLab(r, g, b));
    }
  }
  // 如果四角都透明，无法判别 → 直接返回原图
  if (seedLabs.length === 0) return image;

  // 2) BFS flood fill
  const visited = new Uint8Array(w * h);
  const queue: number[] = [];

  // 初始化：把所有"与任一种子接近"的角像素入队
  for (const si of seedIndices) {
    if (visited[si]) continue;
    const r = src[si * 4];
    const g = src[si * 4 + 1];
    const b = src[si * 4 + 2];
    const lab = rgbToLab(r, g, b);
    if (isNearAnySeed(lab, seedLabs, tolerance)) {
      queue.push(si);
      visited[si] = 1;
    }
  }

  // BFS
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    // 标记为背景
    out[idx * 4 + 3] = 0;

    // 4 邻域
    const x = idx % w;
    const y = Math.floor(idx / w);
    const neighbors = [
      x > 0 ? idx - 1 : -1,
      x < w - 1 ? idx + 1 : -1,
      y > 0 ? idx - w : -1,
      y < h - 1 ? idx + w : -1,
    ];
    for (const ni of neighbors) {
      if (ni < 0 || visited[ni]) continue;
      const nr = src[ni * 4];
      const ng = src[ni * 4 + 1];
      const nb = src[ni * 4 + 2];
      const na = src[ni * 4 + 3];
      if (na < 128) {
        // 已经透明的像素：跳过 flood fill 但仍标记 visited
        visited[ni] = 1;
        continue;
      }
      const nLab = rgbToLab(nr, ng, nb);
      if (isNearAnySeed(nLab, seedLabs, tolerance)) {
        visited[ni] = 1;
        queue.push(ni);
      }
    }
  }

  return { data: out, width: w, height: h, colorSpace: 'srgb' };
}

/** 检查 Lab 是否与任一种子色差 < tolerance */
function isNearAnySeed(
  lab: readonly [number, number, number],
  seeds: ReadonlyArray<readonly [number, number, number]>,
  tolerance: number,
): boolean {
  for (const s of seeds) {
    if (deltaE2000(lab, s) < tolerance) return true;
  }
  return false;
}
