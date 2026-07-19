/**
 * template-trim.ts 测试
 */

import { describe, expect, it } from 'vitest';
import { trimTemplate, padCells } from '@/core/template-trim';
import type { Template } from '@/data/templates';

function makeTemplate(cells: number[][], w: number, h: number): Template {
  return {
    id: 'test',
    name: 'Test',
    emoji: '🧪',
    description: 'test',
    width: w,
    height: h,
    cells: new Uint8Array(cells.flat()),
    colors: [],
  };
}

describe('trimTemplate', () => {
  it('全透明 → isEmpty=true', () => {
    const tpl = makeTemplate(
      Array.from({ length: 5 }, () => Array(5).fill(0)),
      5,
      5,
    );
    const r = trimTemplate(tpl);
    expect(r.isEmpty).toBe(true);
    expect(r.width).toBe(0);
    expect(r.height).toBe(0);
  });

  it('裁剪外圈透明行/列', () => {
    // 5×5，外圈 0，中心 1×1
    const cells = [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ];
    const tpl = makeTemplate(cells, 5, 5);
    const r = trimTemplate(tpl);
    expect(r.isEmpty).toBe(false);
    expect(r.width).toBe(1);
    expect(r.height).toBe(1);
    expect(r.cells[0]).toBe(1);
    expect(r.trimmedRows).toBe(4);
    expect(r.trimmedCols).toBe(4);
  });

  it('裁剪部分透明边', () => {
    // 6×4：左右各 1 列 0
    const cells = [
      [0, 1, 1, 1, 1, 0],
      [0, 1, 2, 2, 1, 0],
      [0, 1, 1, 1, 1, 0],
      [0, 1, 1, 1, 1, 0],
    ];
    const tpl = makeTemplate(cells, 6, 4);
    const r = trimTemplate(tpl);
    expect(r.width).toBe(4); // 6-2
    expect(r.height).toBe(4);
    expect(r.cells[0]).toBe(1);
    expect(r.cells[5]).toBe(2);
  });

  it('无透明边 → 大小不变', () => {
    const cells = [
      [1, 1, 1],
      [1, 2, 1],
      [1, 1, 1],
    ];
    const tpl = makeTemplate(cells, 3, 3);
    const r = trimTemplate(tpl);
    expect(r.width).toBe(3);
    expect(r.height).toBe(3);
    expect(r.trimmedRows).toBe(0);
    expect(r.trimmedCols).toBe(0);
  });
});

describe('padCells', () => {
  it('padding=0 → 不变', () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const r = padCells(data, 2, 2, 0);
    expect(r.cells).toBe(data);
    expect(r.width).toBe(2);
    expect(r.height).toBe(2);
  });

  it('padding=2 → 外扩 2 圈', () => {
    // 2×2 数据 = [1, 2, 3, 4]：(0,0)=1, (1,0)=2, (0,1)=3, (1,1)=4
    const data = new Uint8Array([1, 2, 3, 4]);
    const r = padCells(data, 2, 2, 2);
    expect(r.width).toBe(6);
    expect(r.height).toBe(6);
    expect(r.cells.length).toBe(36);
    // padding 后 (0,0) 移到 (2,2)
    const px = 2 * 6 + 2;
    expect(r.cells[px]).toBe(1);
    expect(r.cells[px + 1]).toBe(2);
    expect(r.cells[px + 6]).toBe(3);
    expect(r.cells[px + 7]).toBe(4);
  });
});
