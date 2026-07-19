/**
 * undo-redo store 测试（带标签版本）
 */

import { describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUndoRedoStore } from '@/stores/undo-redo';
import { buildBeadGrid } from '@/core/grid-builder';
import { rgbToLab } from '@/core/color/rgb-to-lab';
import type { BeadGrid } from '@/types/bead';
import type { Palette, PaletteEntry } from '@/types/palette';
import type { Lab } from '@/types/palette';

function makeRgbPalette(): Palette {
  const entries: PaletteEntry[] = [
    { code: 'R', hex: '#FF0000', lab: rgbToLab(255, 0, 0) as unknown as Lab },
    { code: 'G', hex: '#00FF00', lab: rgbToLab(0, 255, 0) as unknown as Lab },
  ];
  return { id: 'rgb', name: 'RGB', source: 'custom', entries };
}

function makeGrid(palette: Palette, w = 5, h = 5): BeadGrid {
  return buildBeadGrid(new Uint16Array(w * h), w, h, palette);
}

describe('undo-redo store (带标签)', () => {
  it('record 携带标签', () => {
    setActivePinia(createPinia());
    const ur = useUndoRedoStore();
    const palette = makeRgbPalette();
    const g = makeGrid(palette);
    ur.record(g, '生成 50×50');
    expect(ur.past[0].label).toBe('生成 50×50');
    expect(ur.past[0].ts).toBeGreaterThan(0);
  });

  it('record 同 grid + 同 label 去重', () => {
    setActivePinia(createPinia());
    const ur = useUndoRedoStore();
    const palette = makeRgbPalette();
    const g = makeGrid(palette);
    ur.record(g, '改色');
    ur.record(g, '改色'); // 应去重
    expect(ur.past.length).toBe(1);
  });

  it('同 grid + 不同 label 不去重', () => {
    setActivePinia(createPinia());
    const ur = useUndoRedoStore();
    const palette = makeRgbPalette();
    const g = makeGrid(palette);
    ur.record(g, '操作 A');
    ur.record(g, '操作 B');
    expect(ur.past.length).toBe(2);
  });

  it('jumpTo 跳到指定位置', () => {
    setActivePinia(createPinia());
    const ur = useUndoRedoStore();
    const palette = makeRgbPalette();
    const g0 = makeGrid(palette);
    const g1 = makeGrid(palette);
    g1.cells[0] = 1;
    const g2 = makeGrid(palette);
    g2.cells[0] = 0;
    g2.cells[1] = 1;
    ur.record(g0, 'step 0');
    ur.record(g1, 'step 1');
    ur.record(g2, 'step 2');
    // 当前在 g3（无 record，仅在 past 里）
    // 跳到 past[1]（g1），g2 移入 future
    const g3 = makeGrid(palette);
    g3.cells[0] = 0;
    g3.cells[1] = 0;
    g3.cells[2] = 1;
    const target = ur.jumpTo(1, g3);
    expect(target?.grid).toBe(g1);
    expect(ur.past.length).toBe(2); // g0, g1
    expect(ur.future.length).toBe(2); // g2, g3
  });

  it('jumpTo 越界返回 null', () => {
    setActivePinia(createPinia());
    const ur = useUndoRedoStore();
    const palette = makeRgbPalette();
    const g = makeGrid(palette);
    ur.record(g);
    expect(ur.jumpTo(-1, g)).toBeNull();
    expect(ur.jumpTo(99, g)).toBeNull();
  });

  it('pastLength / futureLength 反映栈大小', () => {
    setActivePinia(createPinia());
    const ur = useUndoRedoStore();
    const palette = makeRgbPalette();
    const g = makeGrid(palette);
    expect(ur.pastLength).toBe(0);
    ur.record(g);
    expect(ur.pastLength).toBe(1);
    const g2 = makeGrid(palette);
    g2.cells[0] = 1;
    ur.undo(g2);
    expect(ur.pastLength).toBe(0);
    expect(ur.futureLength).toBe(1);
  });

  it('undo/redo 返回 entry 含 label', () => {
    setActivePinia(createPinia());
    const ur = useUndoRedoStore();
    const palette = makeRgbPalette();
    const g1 = makeGrid(palette);
    const g2 = makeGrid(palette);
    g2.cells[0] = 1;
    ur.record(g1, '初稿');
    const prev = ur.undo(g2, '撤销操作');
    expect(prev?.label).toBe('初稿');
  });
});
