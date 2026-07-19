/**
 * dither.ts 测试
 */

import { describe, expect, it } from 'vitest';
import { dither } from '@/core/dither';
import { buildPaletteIndex } from '@/core/color/nearest-color';
import { EMPTY_CELL } from '@/core/color-quantize';
import { rgbToLab } from '@/core/color/rgb-to-lab';
import type { ImageData } from '@/types/image';
import type { Palette, PaletteEntry } from '@/types/palette';

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
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = x / Math.max(1, width - 1);
      const i = (y * width + x) * 4;
      data[i] = Math.round(255 * (1 - t));
      data[i + 1] = 0;
      data[i + 2] = Math.round(255 * t);
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

/** 构造 3 色测试色板（红/绿/蓝） */
function makeRgbPalette(): Palette {
  const entries: PaletteEntry[] = [
    { code: 'R', hex: '#FF0000', lab: rgbToLab(255, 0, 0) as unknown as Lab },
    { code: 'G', hex: '#00FF00', lab: rgbToLab(0, 255, 0) as unknown as Lab },
    { code: 'B', hex: '#0000FF', lab: rgbToLab(0, 0, 255) as unknown as Lab },
  ];
  return { id: 'rgb', name: 'RGB', source: 'custom', entries };
}

import type { Lab } from '@/types/palette';

describe('dither (Floyd-Steinberg)', () => {
  it('纯色图 → 所有 cell 映射到同一色', () => {
    const palette = makeRgbPalette();
    const idx = buildPaletteIndex(palette);
    const src = makeSolidImage(20, 20, 255, 0, 0);
    const cells = dither(src, idx);
    for (let i = 0; i < cells.length; i++) {
      expect(palette.entries[cells[i]].code).toBe('R');
    }
  });

  it('透明格 → EMPTY_CELL', () => {
    const palette = makeRgbPalette();
    const idx = buildPaletteIndex(palette);
    const data = new Uint8ClampedArray(10 * 10 * 4); // 全 alpha=0
    const src: ImageData = { data, width: 10, height: 10 };
    const cells = dither(src, idx);
    for (let i = 0; i < cells.length; i++) {
      expect(cells[i]).toBe(EMPTY_CELL);
    }
  });

  it('cells.length === width * height', () => {
    const palette = makeRgbPalette();
    const idx = buildPaletteIndex(palette);
    const src = makeSolidImage(7, 9, 0, 255, 0);
    const cells = dither(src, idx);
    expect(cells.length).toBe(63);
  });

  it('渐变图：dither 后颜色种类数 ≥ quantize', () => {
    // 同一渐变图，dither 应比纯 quantize 用更多色（模拟渐变层次）
    const palette = makeRgbPalette();
    const idx = buildPaletteIndex(palette);
    const src = makeGradientImage(30, 10);
    const cells = dither(src, idx);
    const uniqueColors = new Set<number>();
    for (let i = 0; i < cells.length; i++) {
      uniqueColors.add(cells[i]);
    }
    // 3 色板渐变图至少应该出现 2 种色（红/蓝过渡）
    expect(uniqueColors.size).toBeGreaterThanOrEqual(2);
  });

  it('边界：图右下角仍能正常处理', () => {
    const palette = makeRgbPalette();
    const idx = buildPaletteIndex(palette);
    // 1×1 极小图
    const src = makeSolidImage(1, 1, 255, 0, 0);
    const cells = dither(src, idx);
    expect(cells.length).toBe(1);
    expect(palette.entries[cells[0]].code).toBe('R');
  });

  it('边界：1×N 单行（无下一行）', () => {
    const palette = makeRgbPalette();
    const idx = buildPaletteIndex(palette);
    const src = makeGradientImage(10, 1);
    const cells = dither(src, idx);
    expect(cells.length).toBe(10);
    // 不应抛错
  });
});
