/**
 * nearest-color.ts 测试
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPaletteIndex, findNearestByIndex, getEntry } from '@/core/color/nearest-color';
import { rgbToLab } from '@/core/color/rgb-to-lab';
import { parsePalette } from '@/data/palettes/_schema';

function loadFixturePalette() {
  const path = resolve(__dirname, '../fixtures/palette-mard-3.json');
  const json = JSON.parse(readFileSync(path, 'utf8'));
  return parsePalette(json);
}

describe('parsePalette', () => {
  it('校验 fixture 色板', () => {
    const palette = loadFixturePalette();
    expect(palette.id).toBe('mard-test');
    expect(palette.entries.length).toBe(3);
  });

  it('hex 统一转大写', () => {
    const palette = loadFixturePalette();
    for (const e of palette.entries) {
      expect(e.hex).toBe(e.hex.toUpperCase());
    }
  });
});

describe('buildPaletteIndex', () => {
  it('find 纯红 → 应命中 H1 樱红', () => {
    const palette = loadFixturePalette();
    const index = buildPaletteIndex(palette);
    const lab = rgbToLab(255, 0, 0);
    const idx = index.find(lab);
    expect(palette.entries[idx].code).toBe('H1');
  });

  it('find 纯白 → 应命中 H2', () => {
    const palette = loadFixturePalette();
    const index = buildPaletteIndex(palette);
    const lab = rgbToLab(255, 255, 255);
    expect(palette.entries[index.find(lab)].code).toBe('H2');
  });

  it('find 纯黑 → 应命中 H3', () => {
    const palette = loadFixturePalette();
    const index = buildPaletteIndex(palette);
    const lab = rgbToLab(0, 0, 0);
    expect(palette.entries[index.find(lab)].code).toBe('H3');
  });
});

describe('findNearestByIndex', () => {
  it('与 find 结果一致', () => {
    const palette = loadFixturePalette();
    const index = buildPaletteIndex(palette);
    const lab = rgbToLab(200, 50, 50);
    expect(findNearestByIndex(index.labs, index.palette.entries.length, lab)).toBe(
      index.find(lab),
    );
  });
});

describe('getEntry', () => {
  it('合法下标返回条目', () => {
    const palette = loadFixturePalette();
    expect(getEntry(palette, 0)?.code).toBe('H1');
  });

  it('越界返回 null', () => {
    const palette = loadFixturePalette();
    expect(getEntry(palette, -1)).toBeNull();
    expect(getEntry(palette, 99)).toBeNull();
  });
});
