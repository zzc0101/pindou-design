import { describe, expect, it } from 'vitest';
import type { PaletteEntry } from '@/types/palette';
import { buildPurchaseListItems, formatPurchaseList } from '@/pages/result/purchase-list';

function entry(code: string, hex: string, name?: string): PaletteEntry {
  return { code, hex, name, lab: [0, 0, 0] };
}

describe('采购清单格式化', () => {
  it('按数量降序输出，并在数量相同时保持色板顺序', () => {
    const items = buildPurchaseListItems(
      new Map([[2, 3], [1, 5], [0, 3]]),
      [entry('A1', '#aaaaaa'), entry('B2', '#bbbbbb'), entry('C3', '#cccccc')],
    );

    expect(items.map(({ code, count }) => [code, count])).toEqual([
      ['B2', 5],
      ['A1', 3],
      ['C3', 3],
    ]);
  });

  it('合并重复颜色，并保留中文名称和可识别色值', () => {
    const items = buildPurchaseListItems(
      new Map([[0, 2], [1, 4]]),
      [entry('H1', '#ff0000', '中国红'), entry('H1', '#FF0000', '红色')],
    );

    expect(items).toEqual([{ code: 'H1', hex: '#FF0000', name: '中国红', count: 6, paletteIndex: 0 }]);
    expect(formatPurchaseList(items)).toBe([
      '拼豆采购清单',
      '- H1（中国红） · #FF0000 · 6 颗',
      '总计：6 颗拼豆，共 1 色',
    ].join('\n'));
  });

  it('空统计、无效下标和非正数量不会生成清单', () => {
    const entries = [entry('H1', '#FF0000')];

    expect(buildPurchaseListItems(new Map(), entries)).toEqual([]);
    expect(buildPurchaseListItems(new Map([[3, 2], [0, 0], [0.5, 1]]), entries)).toEqual([]);
    expect(formatPurchaseList([])).toBe('');
  });

  it('长清单完整保留每种颜色与总计', () => {
    const entries = Array.from({ length: 80 }, (_, index) => entry(`C${index + 1}`, `#${index.toString(16).padStart(6, '0')}`));
    const counts = new Map(entries.map((_, index) => [index, 1]));
    const text = formatPurchaseList(buildPurchaseListItems(counts, entries));

    expect(text).toContain('- C1 · #000000 · 1 颗');
    expect(text).toContain('- C80 · #00004F · 1 颗');
    expect(text).toContain('总计：80 颗拼豆，共 80 色');
  });
});
