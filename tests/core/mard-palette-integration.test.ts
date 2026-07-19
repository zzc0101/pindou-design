/**
 * mard.json 集成测试
 *
 * 加载真实的 MARD 漫漫色卡（290 色），验证：
 *   1. JSON 解析与 schema 校验通过
 *   2. 所有条目 lab 字段有效（数字三元组）
 *   3. imageToBeads 端到端能跑通
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePalette } from '@/data/palettes/_schema';
import { imageToBeads } from '@/core/image-to-beads';
import type { ImageData } from '@/types/image';

const MARD_JSON = resolve(__dirname, '../../src/data/palettes/mard.json');

function loadMardPalette() {
  if (!existsSync(MARD_JSON)) {
    throw new Error(
      `mard.json 不存在: ${MARD_JSON}\n请先运行: npm run fetch:palettes`,
    );
  }
  return parsePalette(JSON.parse(readFileSync(MARD_JSON, 'utf8')));
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

describe.skipIf(!existsSync(MARD_JSON))('MARD 漫漫色卡集成', () => {
  it('加载成功且 ≥ 100 色', () => {
    const palette = loadMardPalette();
    expect(palette.entries.length).toBeGreaterThanOrEqual(100);
    expect(palette.id).toBe('mard');
    expect(palette.source).toBe('mard');
  });

  it('每条都有合法 Lab（L∈[0,100], a∈[-128,127], b∈[-128,127]）', () => {
    const palette = loadMardPalette();
    for (const e of palette.entries) {
      expect(e.lab.length).toBe(3);
      const [L, a, b] = e.lab;
      expect(L).toBeGreaterThanOrEqual(0);
      expect(L).toBeLessThanOrEqual(100);
      expect(a).toBeGreaterThanOrEqual(-128);
      expect(a).toBeLessThanOrEqual(127);
      expect(b).toBeGreaterThanOrEqual(-128);
      expect(b).toBeLessThanOrEqual(127);
    }
  });

  it('hex 全部为大写且 # 开头', () => {
    const palette = loadMardPalette();
    for (const e of palette.entries) {
      expect(e.hex).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('色号唯一性', () => {
    const palette = loadMardPalette();
    const seen = new Set<string>();
    for (const e of palette.entries) {
      expect(seen.has(e.code)).toBe(false);
      seen.add(e.code);
    }
  });

  it('imageToBeads 用 MARD 色板跑 100×100 纯红 → 8×8 网格有结果', () => {
    const palette = loadMardPalette();
    const src = makeSolidImage(100, 100, 255, 0, 0);
    const start = performance.now();
    const grid = imageToBeads(src, { gridWidth: 8, gridHeight: 8, palette });
    const elapsed = performance.now() - start;

    expect(grid.cells.length).toBe(64);
    expect(grid.stats.filledCells).toBe(64);
    // 64 格都应该映射到色卡中某个有效条目（实际可能是接近纯红的某个红色色号）
    for (let i = 0; i < 64; i++) {
      expect(grid.cells[i]).toBeLessThan(palette.entries.length);
    }
    // 性能：64 格端到端 < 500ms
    expect(elapsed).toBeLessThan(500);
  });

  it('多色测试：红/绿/蓝分区 → 输出颜色种类 ≥ 2', () => {
    const palette = loadMardPalette();
    const src: ImageData = {
      data: (() => {
        const d = new Uint8ClampedArray(30 * 30 * 4);
        for (let y = 0; y < 30; y++) {
          for (let x = 0; x < 30; x++) {
            const i = (y * 30 + x) * 4;
            if (x < 10) { d[i] = 255; d[i + 1] = 0; d[i + 2] = 0; }       // 红
            else if (x < 20) { d[i] = 0; d[i + 1] = 255; d[i + 2] = 0; }  // 绿
            else { d[i] = 0; d[i + 1] = 0; d[i + 2] = 255; }              // 蓝
            d[i + 3] = 255;
          }
        }
        return d;
      })(),
      width: 30,
      height: 30,
    };
    const grid = imageToBeads(src, { gridWidth: 6, gridHeight: 6, palette });
    // 至少应该出现 2 种不同的色卡下标
    const uniqueColors = new Set<number>();
    for (let i = 0; i < grid.cells.length; i++) {
      uniqueColors.add(grid.cells[i]);
    }
    expect(uniqueColors.size).toBeGreaterThanOrEqual(2);
  });
});
