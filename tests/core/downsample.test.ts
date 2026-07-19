/**
 * downsample.ts 测试
 */

import { describe, expect, it } from 'vitest';
import { downsampleToGrid } from '@/core/downsample';
import type { ImageData } from '@/types/image';

function makeSolidImage(width: number, height: number, r: number, g: number, b: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

/** 测试用像素：[x, y, r, g, b, a?] */
type TestPixel = [number, number, number, number, number, number?];

function makeImage(width: number, height: number, pixels: TestPixel[]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y, r, g, b, a = 255] of pixels) {
    const i = (y * width + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return { data, width, height };
}

describe('downsampleToGrid', () => {
  it('非法网格尺寸抛错', () => {
    const src = makeSolidImage(10, 10, 255, 0, 0);
    expect(() => downsampleToGrid(src, 0, 10)).toThrow();
    expect(() => downsampleToGrid(src, 10, 0)).toThrow();
  });

  it('100×100 全红 → 10×10 输出全红', () => {
    const src = makeSolidImage(100, 100, 255, 0, 0);
    const out = downsampleToGrid(src, 10, 10);
    expect(out.width).toBe(10);
    expect(out.height).toBe(10);
    for (let i = 0; i < 100; i++) {
      expect(out.data[i * 4]).toBeGreaterThan(200);
      expect(out.data[i * 4 + 3]).toBe(255);
    }
  });

  it('20×20 每格内 70% 红 + 30% 蓝 → 2×2 输出全红（Dominant）', () => {
    // 20×20 分 2×2，每格 10×10=100 像素
    // 每格内 70 红 + 30 蓝（用确定性位置避免随机）
    const pixels: TestPixel[] = [];
    for (let gy = 0; gy < 2; gy++) {
      for (let gx = 0; gx < 2; gx++) {
        const x0 = gx * 10;
        const y0 = gy * 10;
        // 70 红：每格前 7 列
        for (let i = 0; i < 70; i++) {
          const px = x0 + (i % 10);
          const py = y0 + Math.floor(i / 10);
          pixels.push([px, py, 255, 0, 0, 255]);
        }
        // 30 蓝：每格最后 3 列
        for (let i = 0; i < 30; i++) {
          const px = x0 + 7 + (i % 3);
          const py = y0 + Math.floor(i / 3);
          pixels.push([px, py, 0, 0, 255, 255]);
        }
      }
    }
    const src = makeImage(20, 20, pixels);
    const out = downsampleToGrid(src, 2, 2);
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    for (let i = 0; i < 4; i++) {
      // 每格都应选红（R 通道 > 200）
      expect(out.data[i * 4]).toBeGreaterThan(200);
    }
  });

  it('全透明 → 输出全透明', () => {
    const data = new Uint8ClampedArray(10 * 10 * 4); // alpha 全 0
    const src: ImageData = { data, width: 10, height: 10 };
    const out = downsampleToGrid(src, 2, 2);
    for (let i = 0; i < 4; i++) {
      expect(out.data[i * 4 + 3]).toBe(0);
    }
  });

  it('网格尺寸等于原图 → 一对一', () => {
    const src = makeSolidImage(5, 5, 100, 150, 200);
    const out = downsampleToGrid(src, 5, 5);
    for (let i = 0; i < 25; i++) {
      expect(out.data[i * 4]).toBeGreaterThan(0);
    }
  });
});
