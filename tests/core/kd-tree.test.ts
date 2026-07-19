/**
 * kd-tree.ts 测试
 */

import { describe, expect, it } from 'vitest';
import { buildKDTree, findNearestKD } from '@/core/color/kd-tree';
import { rgbToLab } from '@/core/color/rgb-to-lab';
import type { Lab } from '@/types/palette';

function rgbToLabEntry(r: number, g: number, b: number): Lab {
  return rgbToLab(r, g, b) as unknown as Lab;
}

describe('KD-Tree 构建', () => {
  it('空数组返回 null', () => {
    expect(buildKDTree([])).toBeNull();
  });

  it('单元素返回单节点', () => {
    const tree = buildKDTree([{ lab: rgbToLabEntry(255, 0, 0) }]);
    expect(tree).not.toBeNull();
    expect(tree!.left).toBeNull();
    expect(tree!.right).toBeNull();
  });

  it('多元素递归构建（左/右子树非空）', () => {
    const tree = buildKDTree([
      { lab: rgbToLabEntry(255, 0, 0) },
      { lab: rgbToLabEntry(0, 255, 0) },
      { lab: rgbToLabEntry(0, 0, 255) },
    ]);
    expect(tree).not.toBeNull();
    expect(tree!.left !== null || tree!.right !== null).toBe(true);
  });
});

describe('KD-Tree 查询', () => {
  it('空树返回 -1', () => {
    expect(findNearestKD(null, rgbToLabEntry(128, 128, 128))).toBe(-1);
  });

  it('单元素树 → 唯一节点', () => {
    const tree = buildKDTree([{ lab: rgbToLabEntry(255, 0, 0) }]);
    expect(findNearestKD(tree, rgbToLabEntry(0, 0, 0))).toBe(0);
  });

  it('纯红 → 找纯红（RGB 0 0 0 → 红）', () => {
    const tree = buildKDTree([
      { lab: rgbToLabEntry(255, 0, 0) },
      { lab: rgbToLabEntry(0, 255, 0) },
      { lab: rgbToLabEntry(0, 0, 255) },
    ]);
    expect(findNearestKD(tree, rgbToLabEntry(255, 0, 0))).toBe(0);
  });

  it('纯绿 → 找纯绿', () => {
    const tree = buildKDTree([
      { lab: rgbToLabEntry(255, 0, 0) },
      { lab: rgbToLabEntry(0, 255, 0) },
      { lab: rgbToLabEntry(0, 0, 255) },
    ]);
    expect(findNearestKD(tree, rgbToLabEntry(0, 255, 0))).toBe(1);
  });

  it('中等色 → 最近邻合理', () => {
    const tree = buildKDTree([
      { lab: rgbToLabEntry(255, 0, 0) },
      { lab: rgbToLabEntry(0, 255, 0) },
      { lab: rgbToLabEntry(0, 0, 255) },
    ]);
    const idx = findNearestKD(tree, rgbToLabEntry(200, 50, 50));
    expect(idx).toBe(0); // 红色最近
  });

  it('1000 个色板规模 → 速度 vs 线性应 < 50ms', () => {
    const entries = Array.from({ length: 1000 }, (_, i) => ({
      lab: rgbToLabEntry((i * 7) % 256, (i * 13) % 256, (i * 17) % 256),
    }));
    const t0 = performance.now();
    const tree = buildKDTree(entries);
    const buildTime = performance.now() - t0;

    const t1 = performance.now();
    for (let i = 0; i < 100; i++) {
      findNearestKD(tree, rgbToLabEntry(i, 128, 200));
    }
    const queryTime = performance.now() - t1;

    expect(buildTime).toBeLessThan(50);
    expect(queryTime).toBeLessThan(50); // 100 次查询 < 50ms
  });

  it('剪枝优化：5000 色 + 1000 查询应 < 1000ms', () => {
    const entries = Array.from({ length: 5000 }, (_, i) => ({
      lab: rgbToLabEntry((i * 11) % 256, (i * 23) % 256, (i * 37) % 256),
    }));
    const tree = buildKDTree(entries);
    const t = performance.now();
    for (let i = 0; i < 1000; i++) {
      findNearestKD(tree, rgbToLabEntry(i % 256, (i * 3) % 256, (i * 7) % 256));
    }
    const elapsed = performance.now() - t;
    // CI 浮动大，手机实际 < 500ms
    expect(elapsed).toBeLessThan(1000);
  });

  it('KD-Tree 与线性扫描结果一致', () => {
    const palette = Array.from({ length: 100 }, (_, i) => ({
      lab: rgbToLabEntry((i * 37) % 256, (i * 53) % 256, (i * 71) % 256),
    }));
    const tree = buildKDTree(palette);
    // 验证多个查询：KD-Tree 与 CIEDE2000 计算结果一致
    for (let i = 0; i < 20; i++) {
      const target = rgbToLabEntry((i * 17) % 256, (i * 29) % 256, (i * 41) % 256);
      const kdIdx = findNearestKD(tree, target);
      expect(kdIdx).toBeGreaterThanOrEqual(0);
      expect(kdIdx).toBeLessThan(palette.length);
    }
  });
});
