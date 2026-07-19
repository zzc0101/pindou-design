/**
 * image-to-beads.ts 测试（端到端）
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { imageToBeads } from '@/core/image-to-beads';
import { buildBeadGrid } from '@/core/grid-builder';
import { parsePalette } from '@/data/palettes/_schema';
import type { ImageData } from '@/types/image';

function loadFixturePalette() {
  const path = resolve(__dirname, '../fixtures/palette-mard-3.json');
  return parsePalette(JSON.parse(readFileSync(path, 'utf8')));
}

function makeSolidImage(width: number, height: number, r: number, g: number, b: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

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

describe('imageToBeads (端到端)', () => {
  it('纯红 100×100 → 5×5 网格全部 H1 樱红', () => {
    const palette = loadFixturePalette();
    const src = makeSolidImage(100, 100, 255, 0, 0);
    const grid = imageToBeads(src, {
      gridWidth: 5,
      gridHeight: 5,
      palette,
    });
    expect(grid.width).toBe(5);
    expect(grid.height).toBe(5);
    for (let i = 0; i < 25; i++) {
      expect(palette.entries[grid.cells[i]].code).toBe('H1');
    }
    expect(grid.stats.filledCells).toBe(25);
  });

  it('纯黑 100×100 → 5×5 网格全部 H3 纯黑', () => {
    const palette = loadFixturePalette();
    const src = makeSolidImage(100, 100, 0, 0, 0);
    const grid = imageToBeads(src, {
      gridWidth: 5,
      gridHeight: 5,
      palette,
    });
    for (let i = 0; i < 25; i++) {
      expect(palette.entries[grid.cells[i]].code).toBe('H3');
    }
  });

  it('左半红 + 右半白 → 网格左右清晰分界', () => {
    const palette = loadFixturePalette();
    const src = makeImage(100, 100, (x) => (x < 50 ? [255, 0, 0, 255] : [255, 255, 255, 255]));
    const grid = imageToBeads(src, {
      gridWidth: 10,
      gridHeight: 10,
      palette,
    });
    // 左半（每行前 5 格）应为 H1
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 5; x++) {
        expect(palette.entries[grid.cells[y * 10 + x]].code).toBe('H1');
      }
    }
    // 右半应为 H2
    for (let y = 0; y < 10; y++) {
      for (let x = 5; x < 10; x++) {
        expect(palette.entries[grid.cells[y * 10 + x]].code).toBe('H2');
      }
    }
  });

  it('全透明 → filledCells = 0', () => {
    const palette = loadFixturePalette();
    const data = new Uint8ClampedArray(10 * 10 * 4); // alpha 全 0
    const src: ImageData = { data, width: 10, height: 10 };
    const grid = imageToBeads(src, {
      gridWidth: 5,
      gridHeight: 5,
      palette,
    });
    expect(grid.stats.filledCells).toBe(0);
  });

  it('cells.length === gridWidth * gridHeight', () => {
    const palette = loadFixturePalette();
    const src = makeSolidImage(50, 50, 128, 128, 128);
    const grid = imageToBeads(src, {
      gridWidth: 7,
      gridHeight: 9,
      palette,
    });
    expect(grid.cells.length).toBe(7 * 9);
  });

  it('colorCounts 统计正确', () => {
    const palette = loadFixturePalette();
    const src = makeSolidImage(50, 50, 255, 0, 0);
    const grid = imageToBeads(src, {
      gridWidth: 4,
      gridHeight: 4,
      palette,
    });
    // 16 格全 H1
    expect(grid.stats.colorCounts.size).toBe(1);
    const count = grid.stats.colorCounts.get(0); // H1 下标 0
    expect(count).toBe(16);
  });

  it('buildBeadGrid: cells.length 与 width*height 不匹配时抛错', () => {
    const palette = loadFixturePalette();
    const bad = new Uint16Array(10);
    expect(() => buildBeadGrid(bad, 5, 5, palette)).toThrow(/cells length mismatch/);
  });
});
