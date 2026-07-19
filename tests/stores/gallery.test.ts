/**
 * gallery store 测试
 */

import { describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useGalleryStore } from '@/stores/gallery';
import { buildBeadGrid } from '@/core/grid-builder';
import { rgbToLab } from '@/core/color/rgb-to-lab';
import type { Palette, PaletteEntry } from '@/types/palette';
import type { Lab } from '@/types/palette';

function makeRgbPalette(): Palette {
  const entries: PaletteEntry[] = [
    { code: 'R', hex: '#FF0000', lab: rgbToLab(255, 0, 0) as unknown as Lab },
    { code: 'G', hex: '#00FF00', lab: rgbToLab(0, 255, 0) as unknown as Lab },
  ];
  return { id: 'rgb', name: 'RGB', source: 'custom', entries };
}

function makeGrid(palette: Palette, w = 5, h = 5): ReturnType<typeof buildBeadGrid> {
  const cells = new Uint16Array(w * h);
  cells[0] = 1;
  cells[1] = 1;
  cells[2] = 1;
  return buildBeadGrid(cells, w, h, palette);
}

describe('gallery store', () => {
  it('初始为空', () => {
    setActivePinia(createPinia());
    const g = useGalleryStore();
    expect(g.items.length).toBe(0);
  });

  it('保存一张图纸 → items 长度 1', () => {
    setActivePinia(createPinia());
    const g = useGalleryStore();
    const palette = makeRgbPalette();
    const grid = makeGrid(palette);
    const id = g.save(grid, 'RGB 测试');
    expect(id).toBeTruthy();
    expect(g.items.length).toBe(1);
    expect(g.items[0].paletteName).toBe('RGB 测试');
    expect(g.items[0].width).toBe(5);
    expect(g.items[0].height).toBe(5);
    // cells 全填（22 个 H1 + 3 个 H2）→ colorCount=2, totalBeads=25
    expect(g.items[0].colorCount).toBe(2);
    expect(g.items[0].totalBeads).toBe(25);
  });

  it('保存多张 → 最新在前', () => {
    setActivePinia(createPinia());
    const g = useGalleryStore();
    const palette = makeRgbPalette();
    g.save(makeGrid(palette), '第一张');
    g.save(makeGrid(palette), '第二张');
    g.save(makeGrid(palette), '第三张');
    expect(g.items.length).toBe(3);
    expect(g.items[0].paletteName).toBe('第三张');
  });

  it('最多保留 10 张（超过淘汰最旧）', () => {
    setActivePinia(createPinia());
    const g = useGalleryStore();
    const palette = makeRgbPalette();
    for (let i = 0; i < 15; i++) {
      g.save(makeGrid(palette), `第 ${i + 1} 张`);
    }
    expect(g.items.length).toBe(10);
    expect(g.items[0].paletteName).toBe('第 15 张');
    expect(g.items[9].paletteName).toBe('第 6 张');
  });

  it('remove(id) 移除指定项', () => {
    setActivePinia(createPinia());
    const g = useGalleryStore();
    const palette = makeRgbPalette();
    const id1 = g.save(makeGrid(palette), 'A');
    const id2 = g.save(makeGrid(palette), 'B');
    g.remove(id1);
    expect(g.items.length).toBe(1);
    expect(g.items[0].id).toBe(id2);
  });

  it('clear() 清空', () => {
    setActivePinia(createPinia());
    const g = useGalleryStore();
    const palette = makeRgbPalette();
    g.save(makeGrid(palette), 'A');
    g.save(makeGrid(palette), 'B');
    g.clear();
    expect(g.items.length).toBe(0);
  });

  it('getById 找到对应项', () => {
    setActivePinia(createPinia());
    const g = useGalleryStore();
    const palette = makeRgbPalette();
    const id = g.save(makeGrid(palette), 'Test');
    expect(g.getById(id)?.paletteName).toBe('Test');
    expect(g.getById('not-exist')).toBeNull();
  });

  it('cellsBase64 序列化正确', () => {
    setActivePinia(createPinia());
    const g = useGalleryStore();
    const palette = makeRgbPalette();
    const grid = makeGrid(palette, 3, 3);
    const id = g.save(grid, 'Test');
    const item = g.getById(id);
    expect(item).not.toBeNull();
    // 反序列化：cells[0] = 1, cells[1] = 1, cells[2] = 1, 其余 0
    const restored = g.toBeadGrid(item!, palette);
    expect(restored.cells[0]).toBe(1);
    expect(restored.cells[1]).toBe(1);
    expect(restored.cells[2]).toBe(1);
    expect(restored.cells[3]).toBe(0);
    expect(restored.cells.length).toBe(9);
  });
});
