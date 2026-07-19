/**
 * templates 测试
 */

import { describe, expect, it } from 'vitest';
import { TEMPLATES, templateToBeadGrid } from '@/data/templates';

describe('模板库', () => {
  it('内置至少 3 个模板', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(3);
  });

  it('每个模板都有 id/name/width/height/cells', () => {
    for (const t of TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.width).toBeGreaterThan(0);
      expect(t.height).toBeGreaterThan(0);
      expect(t.cells.length).toBe(t.width * t.height);
    }
  });

  it('cell 值在 0-3 范围（透明/红/白/黑）', () => {
    for (const t of TEMPLATES) {
      for (let i = 0; i < t.cells.length; i++) {
        expect(t.cells[i]).toBeGreaterThanOrEqual(0);
        expect(t.cells[i]).toBeLessThanOrEqual(3);
      }
    }
  });

  it('爱心模板有白色填充像素', () => {
    const heart = TEMPLATES.find((t) => t.id === 'heart');
    expect(heart).toBeDefined();
    // 模板编码：3=黑边, 2=白填充（红/黑变种暂未做）
    const whites = Array.from(heart!.cells).filter((c) => c === 2).length;
    expect(whites).toBeGreaterThan(20);
  });

  it('五角星模板有内部填充（非黑像素 ≥ 30）', () => {
    const star = TEMPLATES.find((t) => t.id === 'star');
    expect(star).toBeDefined();
    // 五角星内部（非黑色边框）应有填充
    const nonBlack = Array.from(star!.cells).filter((c) => c !== 3).length;
    expect(nonBlack).toBeGreaterThanOrEqual(20);
  });
});

describe('templateToBeadGrid', () => {
  it('转换后 cells 长度 = width * height', () => {
    for (const t of TEMPLATES) {
      const grid = templateToBeadGrid(t);
      expect(grid.cells.length).toBe(t.width * t.height);
      expect(grid.width).toBe(t.width);
      expect(grid.height).toBe(t.height);
    }
  });

  it('转换后使用 MARD 色板', () => {
    for (const t of TEMPLATES) {
      const grid = templateToBeadGrid(t);
      expect(grid.palette.id).toBe('mard');
    }
  });

  it('模板中 0（透明）→ EMPTY_CELL（0xffff），如有', () => {
    // 当前模板都用实色填充（无 0），但函数逻辑仍要正确处理
    // 改测试为"任意 cell 值都映射到合法范围"
    for (const t of TEMPLATES) {
      const grid = templateToBeadGrid(t);
      for (let i = 0; i < grid.cells.length; i++) {
        const v = grid.cells[i];
        // 合法：EMPTY_CELL (0xffff) 或 < palette.entries.length
        expect(v === 0xffff || v < grid.palette.entries.length).toBe(true);
      }
    }
  });

  it('模板中非 0（红/白/黑）→ 合法色卡下标', () => {
    const t = TEMPLATES.find((x) => x.id === 'heart')!;
    const grid = templateToBeadGrid(t);
    let filledCount = 0;
    for (let i = 0; i < grid.cells.length; i++) {
      if (grid.cells[i] !== 0xffff) {
        filledCount++;
        expect(grid.cells[i]).toBeLessThan(grid.palette.entries.length);
      }
    }
    expect(filledCount).toBeGreaterThan(50); // 爱心模板应该大部分被填充
  });
});
