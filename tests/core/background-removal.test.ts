/**
 * background-removal.ts 测试
 */

import { describe, expect, it } from 'vitest';
import { removeBackground } from '@/core/background-removal';
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

describe('removeBackground (flood fill)', () => {
  it('四角白 + 中心红 → 中心仍红色，背景透明', () => {
    const src = makeImage(20, 20, (x, y) => {
      // 中心 10×10 红色
      if (x >= 5 && x < 15 && y >= 5 && y < 15) {
        return [255, 0, 0, 255];
      }
      return [255, 255, 255, 255]; // 背景白
    });
    const out = removeBackground(src);
    // 中心像素应保持不透明
    const centerIdx = (10 * 20 + 10) * 4;
    expect(out.data[centerIdx + 3]).toBe(255);
    // 角应是透明的（被 flood fill）
    const cornerIdx = 0;
    expect(out.data[cornerIdx + 3]).toBe(0);
  });

  it('全白图（无边角主体）→ 全透明', () => {
    const src = makeImage(10, 10, () => [255, 255, 255, 255]);
    const out = removeBackground(src);
    // 角都是白 → flood fill 全图
    let opaqueCount = 0;
    for (let i = 0; i < 100; i++) {
      if (out.data[i * 4 + 3] === 255) opaqueCount++;
    }
    expect(opaqueCount).toBe(0);
  });

  it('全透明图 → 直接返回（无种子）', () => {
    const src = makeImage(10, 10, () => [0, 0, 0, 0]);
    const out = removeBackground(src);
    // 应该等于原图（因为种子为空）
    expect(out.data.length).toBe(src.data.length);
  });

  it('小尺寸（3×3）也能跑', () => {
    const src = makeImage(3, 3, (x, y) => {
      // 中心红
      if (x === 1 && y === 1) return [255, 0, 0, 255];
      return [255, 255, 255, 255];
    });
    const out = removeBackground(src);
    const centerIdx = (1 * 3 + 1) * 4;
    expect(out.data[centerIdx + 3]).toBe(255);
  });

  it('原图 width/height 不变', () => {
    const src = makeImage(40, 30, () => [255, 255, 255, 255]);
    const out = removeBackground(src);
    expect(out.width).toBe(40);
    expect(out.height).toBe(30);
  });

  it('容差调整：默认容差足够分离浅蓝 vs 深蓝', () => {
    const src = makeImage(20, 20, (x, y) => {
      if (x >= 5 && x < 15 && y >= 5 && y < 15) {
        return [50, 50, 150, 255]; // 深蓝（主体）
      }
      return [220, 230, 240, 255]; // 浅蓝（背景）
    });
    const out = removeBackground(src);
    const centerIdx = (10 * 20 + 10) * 4;
    expect(out.data[centerIdx + 3]).toBe(255);
    const cornerIdx = 0;
    expect(out.data[cornerIdx + 3]).toBe(0);
  });
});
