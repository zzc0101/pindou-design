/**
 * 图像工具
 *
 * @author zhuzc
 * @date 2026-06-22
 */

import type { ImageMeta } from '@/types/image';

/**
 * 把 #RRGGBB 转成 [r, g, b]（0-255）
 *
 * @param hex 6 位十六进制颜色（含或不含 #）
 * @returns RGB 三元组
 */
export function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace(/^#/, '');
  if (s.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return [
    parseInt(s.substring(0, 2), 16),
    parseInt(s.substring(2, 4), 16),
    parseInt(s.substring(4, 6), 16),
  ];
}

/**
 * 把 [r, g, b]（0-255）转成 #RRGGBB（大写）
 *
 * @param r 红色 0-255
 * @param g 绿色 0-255
 * @param b 蓝色 0-255
 * @returns 6 位十六进制颜色（含 #）
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number): string =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** 检测图像是否超过尺寸阈值（最长边） */
export function isOversized(meta: ImageMeta, maxEdge: number): boolean {
  return meta.width > maxEdge || meta.height > maxEdge;
}

/** 计算最长边 */
export function maxEdgeOf(meta: ImageMeta): number {
  return Math.max(meta.width, meta.height);
}

/** 格式化文件大小为可读字符串 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}
