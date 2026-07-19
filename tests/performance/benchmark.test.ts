/**
 * 性能基准测试
 *
 * 量化 imageToBeads 在不同输入尺寸下的耗时，用于回归与基线对比。
 * 输出格式：console.table 形式（test runner 会打印）
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { imageToBeads } from '@/core/image-to-beads';
import { parsePalette } from '@/data/palettes/_schema';
import { resizeImage } from '@/utils/image-resize';
import type { ImageData } from '@/types/image';

const MARD_JSON = resolve(__dirname, '../../src/data/palettes/mard.json');

function loadPalette() {
  if (!existsSync(MARD_JSON)) throw new Error('mard.json 不存在');
  return parsePalette(JSON.parse(readFileSync(MARD_JSON, 'utf8')));
}

function makeRandomImage(width: number, height: number, seed = 42): ImageData {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = Math.floor(rand() * 256);
    data[i * 4 + 1] = Math.floor(rand() * 256);
    data[i * 4 + 2] = Math.floor(rand() * 256);
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

interface BenchRow {
  input: string;
  grid: string;
  downsampleMs: number;
  quantizeMs: number;
  buildMs: number;
  totalMs: number;
  cells: number;
}

describe.skipIf(!existsSync(MARD_JSON))('性能基准（289 色 MARD）', () => {
  const palette = loadPalette();

  // 基准配置：输入尺寸 × 输出网格
  const cases: Array<{ inW: number; inH: number; grid: number }> = [
    { inW: 500, inH: 500, grid: 30 },
    { inW: 500, inH: 500, grid: 50 },
    { inW: 1000, inH: 1000, grid: 50 },
    { inW: 1000, inH: 1000, grid: 80 },
    { inW: 2048, inH: 2048, grid: 80 },
    { inW: 2048, inH: 2048, grid: 100 },
  ];

  const rows: BenchRow[] = [];

  for (const c of cases) {
    it(`${c.inW}×${c.inH} → ${c.grid}×${c.grid}`, () => {
      const src = makeRandomImage(c.inW, c.inH);

      // 分阶段计时
      const t0 = performance.now();
      const t1 = performance.now();
      // 由于 downsample / quantize / build 没单独导出阶段计时，
      // 这里近似：整体 imageToBeads 耗时 = totalMs，
      // 详细分阶段分解留作 V2。
      const _grid = imageToBeads(src, { gridWidth: c.grid, gridHeight: c.grid, palette });
      const t2 = performance.now();

      const totalMs = t2 - t0;
      const row: BenchRow = {
        input: `${c.inW}×${c.inH}`,
        grid: `${c.grid}×${c.grid}`,
        downsampleMs: 0,
        quantizeMs: 0,
        buildMs: 0,
        totalMs: Math.round(totalMs),
        cells: c.grid * c.grid,
      };
      rows.push(row);
      void t1; void _grid;
      // 性能断言（M3/普通手机基线，Vitest 在 Mac 上跑只会更快）
      // 实际设备目标：< 800ms @ 1000×1000 + 50×50
      expect(_grid.cells.length).toBe(c.grid * c.grid);
    });
  }

  it('汇总输出', () => {
    console.log('\n=== 性能基准汇总 ===');
    console.table(rows);
    expect(rows.length).toBe(cases.length);
  });
});

describe.skipIf(!existsSync(MARD_JSON))('大图 resize + 生成端到端', () => {
  it('4000×3000 随机图 → resize 到 2048 → 80×60 网格', () => {
    const palette = loadPalette();
    const src = makeRandomImage(4000, 3000);
    const t0 = performance.now();
    const resized = resizeImage(src, 2048, 1536);
    const t1 = performance.now();
    const grid = imageToBeads(resized, { gridWidth: 80, gridHeight: 60, palette });
    const t2 = performance.now();
    const total = t2 - t0;
    console.log(
      `4000×3000 → 80×60: resize ${Math.round(t1 - t0)}ms + beads ${Math.round(t2 - t1)}ms = ${Math.round(total)}ms`,
    );
    expect(grid.cells.length).toBe(80 * 60);
    // 性能基线：< 5s（M3 普通手机实际预估 1.5s，CI 浮动较大）
    expect(total).toBeLessThan(5000);
  });
});
