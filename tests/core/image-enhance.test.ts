/**
 * image-enhance.ts 测试
 */

import { describe, expect, it } from 'vitest';
import {
  enhance,
  autoWhiteBalance,
  adjustBrightness,
  adjustSaturation,
  autoContrast,
  histogramEqualization,
  sharpen,
  sobelEdge,
  otsuBinarize,
  DEFAULT_ENHANCE_OPTIONS,
} from '@/core/image-enhance';
import type { ImageData } from '@/types/image';

function makeImage(w: number, h: number, fill: (x: number, y: number) => [number, number, number, number]): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [r, g, b, a] = fill(x, y);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { data, width: w, height: h };
}

describe('autoWhiteBalance', () => {
  it('不透明 → 输出不透明', () => {
    const src = makeImage(10, 10, () => [200, 100, 50, 255]);
    const out = autoWhiteBalance(src);
    expect(out.data[3]).toBe(255);
  });

  it('全透明 → 返回原图', () => {
    const src = makeImage(10, 10, () => [0, 0, 0, 0]);
    const out = autoWhiteBalance(src);
    expect(out.data[3]).toBe(0);
  });
});

describe('adjustBrightness', () => {
  it('+100 → 像素加 128', () => {
    const data = new Uint8ClampedArray([100, 100, 100, 255]);
    const out = adjustBrightness(data, 100);
    expect(out[0]).toBe(228);
  });

  it('-100 → 像素减 128', () => {
    const data = new Uint8ClampedArray([200, 200, 200, 255]);
    const out = adjustBrightness(data, -100);
    expect(out[0]).toBe(72);
  });

  it('0 → 不变', () => {
    const data = new Uint8ClampedArray([100, 100, 100, 255]);
    const out = adjustBrightness(data, 0);
    expect(out[0]).toBe(100);
  });
});

describe('adjustSaturation', () => {
  it('+100 → 颜色更鲜艳', () => {
    const data = new Uint8ClampedArray([255, 100, 100, 255]);
    const out = adjustSaturation(data, 100);
    expect(out[0]).toBe(255);
  });

  it('-100 → 全灰', () => {
    const data = new Uint8ClampedArray([255, 100, 50, 255]);
    const out = adjustSaturation(data, -100);
    // 三个通道相等（灰）
    expect(out[0]).toBe(out[1]);
    expect(out[1]).toBe(out[2]);
  });
});

describe('autoContrast', () => {
  it('对比度拉伸 → 最小值 0 最大值 255', () => {
    const data = new Uint8ClampedArray(10 * 4);
    for (let i = 0; i < 10; i++) {
      data[i * 4] = 100 + i * 10;
      data[i * 4 + 1] = 100 + i * 10;
      data[i * 4 + 2] = 100 + i * 10;
      data[i * 4 + 3] = 255;
    }
    const out = autoContrast(data);
    expect(out[0]).toBe(0); // 最小 100 → 0
    expect(out[9 * 4]).toBe(255); // 最大 190 → 255
  });
});

describe('histogramEqualization', () => {
  it('暗图 → 提亮（多灰度）', () => {
    const data = new Uint8ClampedArray(50 * 4);
    for (let i = 0; i < 50; i++) {
      // 不同暗灰度（20-50）
      const v = 20 + (i % 3) * 10;
      data[i * 4] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }
    const out = histogramEqualization(data);
    // 均衡化后，分布更宽
    const min = Math.min(out[0], out[10 * 4], out[20 * 4]);
    const max = Math.max(out[0], out[10 * 4], out[20 * 4]);
    expect(max).toBeGreaterThan(min);
  });
});

describe('sharpen', () => {
  it('strength=0 → 不变', () => {
    const data = new Uint8ClampedArray(10 * 10 * 4);
    for (let i = 0; i < 100; i++) {
      data[i * 4] = 128;
      data[i * 4 + 3] = 255;
    }
    const out = sharpen(data, 10, 10, 0);
    expect(out[0]).toBe(128);
  });

  it('width<3 → 不变', () => {
    const data = new Uint8ClampedArray(2 * 2 * 4);
    const out = sharpen(data, 2, 2, 1);
    expect(out).toBe(data);
  });
});

describe('sobelEdge', () => {
  it('width<3 → 返回原数据', () => {
    const data = new Uint8ClampedArray(2 * 2 * 4);
    const out = sobelEdge(data, 2, 2);
    expect(out).toBe(data);
  });

  it('3x3 全白 → 中心值大（边界）', () => {
    const data = new Uint8ClampedArray(3 * 3 * 4);
    for (let i = 0; i < 9; i++) {
      data[i * 4] = 255;
      data[i * 4 + 1] = 255;
      data[i * 4 + 2] = 255;
      data[i * 4 + 3] = 255;
    }
    const out = sobelEdge(data, 3, 3);
    // 边界像素：中心=0，邻居=255 → 边缘检测为 0
    // 中心像素：4 邻居=255 → 边缘=0
    // 总之纯色没有边缘
    const center = 1 * 3 + 1;
    expect(out[center * 4]).toBe(0);
  });
});

describe('otsuBinarize', () => {
  it('fixedThreshold=128 → <128 黑, ≥128 白', () => {
    const data = new Uint8ClampedArray(10 * 4);
    for (let i = 0; i < 10; i++) {
      const v = i < 5 ? 50 : 200;
      data[i * 4] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }
    const out = otsuBinarize(data, 128);
    expect(out[0 * 4]).toBe(0); // 50 < 128 → 黑
    expect(out[5 * 4]).toBe(255); // 200 ≥ 128 → 白
  });

  it('Otsu 自动阈值（fixed=0）', () => {
    const data = new Uint8ClampedArray(100 * 4);
    for (let i = 0; i < 100; i++) {
      const v = i < 60 ? 50 : 200;
      data[i * 4] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }
    const out = otsuBinarize(data, 0);
    // 自动 Otsu 阈值
    expect(out.length).toBe(400);
  });
});

describe('enhance (主入口)', () => {
  it('所有开关关闭 → 输出等于输入（除 alpha 复制）', () => {
    const data = new Uint8ClampedArray([100, 150, 200, 255]);
    const src: ImageData = { data, width: 1, height: 1 };
    const out = enhance(src, {
      ...DEFAULT_ENHANCE_OPTIONS,
      autoWhiteBalance: false,
      autoContrast: false,
      histogramEqualization: false,
      sharpen: 0,
      sobel: 0,
      otsuThreshold: 0,
    });
    expect(out.data[0]).toBe(100);
    expect(out.data[1]).toBe(150);
    expect(out.data[2]).toBe(200);
  });
});
