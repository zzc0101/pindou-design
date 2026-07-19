/**
 * 模板自动裁剪（去除主体外的透明格）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 算法：找模板中非透明区域的 bounding box，把 box 外的行/列去除。
 * 用途：应用模板时，主体居中、提高渲染密度。
 */

import type { Template } from '@/data/templates';

/** 裁剪结果 */
export interface TrimResult {
  /** 裁剪后的 cells（去除外部透明格） */
  cells: Uint8Array;
  /** 裁剪后宽度 */
  width: number;
  /** 裁剪后高度 */
  height: number;
  /** 裁剪掉的行数（顶部 + 底部） */
  trimmedRows: number;
  /** 裁剪掉的列数（左 + 右） */
  trimmedCols: number;
  /** 原图是否无内容（全部透明） */
  isEmpty: boolean;
}

/**
 * 裁剪模板（去除外圈全透明行/列）
 *
 * 保留主体 bounding box + 主体内部的透明格
 */
export function trimTemplate(template: Template): TrimResult {
  const w = template.width;
  const h = template.height;
  const cells = template.cells;

  // 1) 找主体 bounding box
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (cells[y * w + x] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    // 全透明
    return {
      cells: new Uint8Array(0),
      width: 0,
      height: 0,
      trimmedRows: h,
      trimmedCols: w,
      isEmpty: true,
    };
  }
  // 2) 裁剪到 bounding box
  const newW = maxX - minX + 1;
  const newH = maxY - minY + 1;
  const newCells = new Uint8Array(newW * newH);
  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      newCells[y * newW + x] = cells[(y + minY) * w + (x + minX)];
    }
  }
  return {
    cells: newCells,
    width: newW,
    height: newH,
    trimmedRows: minY + (h - 1 - maxY),
    trimmedCols: minX + (w - 1 - maxX),
    isEmpty: false,
  };
}

/**
 * 主体外扩 N 像素（用于模板与原图合成时预留边距）
 */
export function padCells(
  cells: Uint8Array,
  width: number,
  height: number,
  padding: number,
): { cells: Uint8Array; width: number; height: number } {
  if (padding <= 0) return { cells, width, height };
  const newW = width + padding * 2;
  const newH = height + padding * 2;
  const newCells = new Uint8Array(newW * newH);
  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      const srcX = x - padding;
      const srcY = y - padding;
      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        newCells[y * newW + x] = cells[srcY * width + srcX];
      }
      // 边界外默认 0（透明）
    }
  }
  return { cells: newCells, width: newW, height: newH };
}
