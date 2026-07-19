/**
 * image-resize.ts 测试
 */

import { describe, expect, it } from 'vitest';
import { resizeImage, resizeToFit, computeResizeSize } from '@/utils/image-resize';
import type { ImageData } from '@/types/image';

function makeImage(width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { data, width, height };
}

describe('computeResizeSize', () => {
  it('原图已 ≤ maxEdge → 返回原尺寸', () => {
    expect(computeResizeSize(800, 600, 2000)).toEqual({ w: 800, h: 600 });
    expect(computeResizeSize(2000, 1500, 2000)).toEqual({ w: 2000, h: 1500 });
  });

  it('缩放到最长边 = maxEdge', () => {
    expect(computeResizeSize(4000, 3000, 2000)).toEqual({ w: 2000, h: 1500 });
    expect(computeResizeSize(3000, 4000, 2000)).toEqual({ w: 1500, h: 2000 });
    expect(computeResizeSize(8000, 2000, 2000)).toEqual({ w: 2000, h: 500 });
  });

  it('极限：1×1 源图 → 1×1 输出', () => {
    expect(computeResizeSize(1, 1, 100)).toEqual({ w: 1, h: 1 });
  });
});

describe('resizeImage', () => {
  it('非法目标尺寸抛错', () => {
    const src = makeImage(10, 10, () => [255, 0, 0, 255]);
    expect(() => resizeImage(src, 0, 5)).toThrow();
    expect(() => resizeImage(src, 5, 0)).toThrow();
  });

  it('100×100 全红 → 50×50 全红（颜色守恒）', () => {
    const src = makeImage(100, 100, () => [255, 0, 0, 255]);
    const out = resizeImage(src, 50, 50);
    expect(out.width).toBe(50);
    expect(out.height).toBe(50);
    for (let i = 0; i < 50 * 50; i++) {
      expect(out.data[i * 4]).toBe(255);
      expect(out.data[i * 4 + 1]).toBe(0);
      expect(out.data[i * 4 + 2]).toBe(0);
      expect(out.data[i * 4 + 3]).toBe(255);
    }
  });

  it('200×100 半红半蓝（中间垂直分割）→ 缩小到 20×10 后仍可分辨', () => {
    const src = makeImage(200, 100, (x) => (x < 100 ? [255, 0, 0, 255] : [0, 0, 255, 255]));
    const out = resizeImage(src, 20, 10);
    // 左半（x<10）应偏红
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        expect(out.data[(y * 20 + x) * 4]).toBeGreaterThan(out.data[(y * 20 + x) * 4 + 2]);
      }
    }
    // 右半（x>=10）应偏蓝
    for (let y = 0; y < 10; y++) {
      for (let x = 10; x < 20; x++) {
        expect(out.data[(y * 20 + x) * 4 + 2]).toBeGreaterThan(out.data[(y * 20 + x) * 4]);
      }
    }
  });

  it('全透明源 → 输出全透明', () => {
    const src = makeImage(50, 50, () => [255, 0, 0, 0]);
    const out = resizeImage(src, 10, 10);
    for (let i = 0; i < 100; i++) {
      expect(out.data[i * 4 + 3]).toBe(0);
    }
  });

  it('4000×3000 → 2000×1500 耗时 < 1000ms', () => {
    const src = makeImage(4000, 3000, () => [128, 128, 128, 255]);
    const start = performance.now();
    const out = resizeImage(src, 2000, 1500);
    const elapsed = performance.now() - start;
    expect(out.width).toBe(2000);
    expect(out.height).toBe(1500);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe('resizeToFit', () => {
  it('小图不缩放（直接返回原对象）', () => {
    const src = makeImage(800, 600, () => [255, 0, 0, 255]);
    const out = resizeToFit(src, 2000);
    expect(out).toBe(src);
  });

  it('大图自动缩放', () => {
    const src = makeImage(4000, 3000, () => [255, 0, 0, 255]);
    const out = resizeToFit(src, 2000);
    expect(out.width).toBe(2000);
    expect(out.height).toBe(1500);
  });
});
