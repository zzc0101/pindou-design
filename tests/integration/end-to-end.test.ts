/**
 * 端到端集成测试
 *
 * 模拟小程序端的完整处理流程：
 *   选图 → （可能 resize）→ imageToBeads → 出 BeadGrid
 *
 * 不依赖 canvas / uni，直接用 Uint8ClampedArray 模拟像素数据。
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { imageToBeads } from '@/core/image-to-beads';
import { parsePalette } from '@/data/palettes/_schema';
import { resizeImage, computeResizeSize } from '@/utils/image-resize';
import { EMPTY_CELL } from '@/core/color-quantize';
import type { ImageData } from '@/types/image';

const MARD_JSON = resolve(__dirname, '../../src/data/palettes/mard.json');

function loadPalette() {
  if (!existsSync(MARD_JSON)) throw new Error('mard.json 不存在，先 npm run fetch:palettes');
  return parsePalette(JSON.parse(readFileSync(MARD_JSON, 'utf8')));
}

function makeSolidImage(width: number, height: number, r: number, g: number, b: number, a = 255): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return { data, width, height };
}

function makeGradientImage(width: number, height: number): ImageData {
  // 左红 → 右蓝，垂直均匀
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = x / (width - 1);
      const i = (y * width + x) * 4;
      data[i] = Math.round(255 * (1 - t));
      data[i + 1] = 0;
      data[i + 2] = Math.round(255 * t);
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

function makeRandomImage(width: number, height: number, seed = 42): ImageData {
  // 简单 LCG 伪随机，测试用
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = Math.floor(rand() * 256);
    data[i * 4 + 1] = Math.floor(rand() * 256);
    data[i * 4 + 2] = Math.floor(rand() * 256);
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

function makeTransparentBorderImage(width: number, height: number, innerR: number, innerG: number, innerB: number): ImageData {
  // 周围 20% 边距透明，内部填充纯色
  const data = new Uint8ClampedArray(width * height * 4);
  const border = Math.floor(Math.min(width, height) * 0.2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (x < border || x >= width - border || y < border || y >= height - border) {
        data[i + 3] = 0;
      } else {
        data[i] = innerR;
        data[i + 1] = innerG;
        data[i + 2] = innerB;
        data[i + 3] = 255;
      }
    }
  }
  return { data, width, height };
}

describe.skipIf(!existsSync(MARD_JSON))('端到端：选图 → resize → imageToBeads', () => {
  it('小图（≤2048）直通不缩放，色卡覆盖', () => {
    const palette = loadPalette();
    const src = makeSolidImage(500, 500, 255, 0, 0);
    const grid = imageToBeads(src, { gridWidth: 50, gridHeight: 50, palette });
    expect(grid.width).toBe(50);
    expect(grid.height).toBe(50);
    expect(grid.stats.filledCells).toBe(2500);
    // 所有 cells 都应是合法下标
    for (let i = 0; i < grid.cells.length; i++) {
      expect(grid.cells[i]).toBeLessThan(palette.entries.length);
    }
  });

  it('大图（4000×3000）先 resize 再生成', () => {
    const palette = loadPalette();
    const src = makeSolidImage(4000, 3000, 255, 0, 0);
    const { w, h } = computeResizeSize(src.width, src.height, 2048);
    expect(w).toBe(2048);
    expect(h).toBe(1536);
    const resized = resizeImage(src, w, h);
    const grid = imageToBeads(resized, { gridWidth: 80, gridHeight: 60, palette });
    expect(grid.width).toBe(80);
    expect(grid.height).toBe(60);
    expect(grid.stats.filledCells).toBe(80 * 60);
  });

  it('透明边图：透明边 → EMPTY_CELL', () => {
    const palette = loadPalette();
    const src = makeTransparentBorderImage(200, 200, 255, 0, 0);
    const grid = imageToBeads(src, { gridWidth: 40, gridHeight: 40, palette });
    // 边角 8×8 应该是 EMPTY_CELL
    let emptyCount = 0;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (grid.cells[y * 40 + x] === EMPTY_CELL) emptyCount++;
      }
    }
    expect(emptyCount).toBeGreaterThan(50); // 至少大部分是 EMPTY
    // 中心 24×24 应该全部填充
    let filledInCenter = 0;
    for (let y = 8; y < 32; y++) {
      for (let x = 8; x < 32; x++) {
        if (grid.cells[y * 40 + x] !== EMPTY_CELL) filledInCenter++;
      }
    }
    expect(filledInCenter).toBe(24 * 24);
  });

  it('渐变图（红→蓝）：横跨色卡的平滑过渡', () => {
    const palette = loadPalette();
    const src = makeGradientImage(1000, 100);
    const grid = imageToBeads(src, { gridWidth: 100, gridHeight: 10, palette });
    // 第 0 列（红）和第 99 列（蓝）颜色下标应该不同
    const leftColor = grid.cells[0];
    const rightColor = grid.cells[99];
    expect(leftColor).not.toBe(rightColor);
    // 颜色种类数应该 > 1（渐变）
    const uniqueColors = new Set<number>();
    for (let i = 0; i < grid.cells.length; i++) {
      uniqueColors.add(grid.cells[i]);
    }
    expect(uniqueColors.size).toBeGreaterThan(2);
  });

  it('随机图（噪声）：色彩多样性 + 统计合理', () => {
    const palette = loadPalette();
    const src = makeRandomImage(200, 200);
    const grid = imageToBeads(src, { gridWidth: 50, gridHeight: 50, palette });
    const uniqueColors = new Set<number>();
    for (let i = 0; i < grid.cells.length; i++) {
      uniqueColors.add(grid.cells[i]);
    }
    // 随机噪声应该至少用 20+ 种颜色
    expect(uniqueColors.size).toBeGreaterThan(20);
    expect(uniqueColors.size).toBeLessThanOrEqual(palette.entries.length);
  });
});
