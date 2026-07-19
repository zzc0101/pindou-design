/**
 * 内置模板库
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 提供 5 个简单图案（爱心、五角星、像素猫、笑脸、OK 表情）
 * 模板尺寸固定 20×20，每个 cell 用 Uint8Array 编码：
 *   0 = 透明
 *   1, 2, 3 = 色板下标（MARD 漫漫：1=H1 红, 2=H2 白, 3=H3 黑）
 */

import type { BeadGrid } from '@/types/bead';
import { buildBeadGrid } from '@/core/grid-builder';
import { EMPTY_CELL } from '@/core/color-quantize';
import { parsePalette } from '@/data/palettes/_schema';
import mardJson from '@/data/palettes/mard.json';
import type { Palette } from '@/types/palette';

/** 模板接口 */
export interface Template {
  /** 唯一 id */
  id: string;
  /** 显示名 */
  name: string;
  /** 图案 emoji */
  emoji: string;
  /** 描述 */
  description: string;
  /** 宽（格子数） */
  width: number;
  /** 高（格子数） */
  height: number;
  /** 单元数组（每像素 1 字节：0=透明, 1=R红, 2=W白, 3=K黑） */
  cells: Uint8Array;
  /** 推荐色板（用于查看） */
  colors: Array<{ code: string; hex: string }>;
}

/** 共享 MARD 漫漫色板（用于模板渲染） */
const MARD_PALETTE: Palette = parsePalette(mardJson);

/** MARD 漫漫中适合做模板的预定义色（按顺序：背景 / 红 / 白 / 黑） */
const TEMPLATE_COLORS: Array<{ code: string; hex: string }> = [
  { code: '-', hex: 'transparent' },
  { code: 'H1', hex: '#E60012' }, // 红
  { code: 'H2', hex: '#FFFFFF' }, // 白
  { code: 'H3', hex: '#000000' }, // 黑
];

// ---------- 图案定义（用 1/2/3 表示色：红/白/黑）----------

/** 爱心 20×20 */
const HEART_20 = `
33333333333333333333
32222222222222222223
32222333333333222223
32223333333333322223
32233333333333332223
32233333333333333223
32233333333333333223
32233333333333333223
32223333333333333223
32222333333333333223
32222333333333333223
32222233333333333223
32222223333333333223
32222222333333333223
32222222233333333223
32222222223333333223
32222222222333333223
32222222222233333223
32222222222223333223
33333333333333333333
`
  .trim()
  .split('\n')
  .map((row) => row.split('').map(Number));

/** 五角星 20×20 */
const STAR_20 = `
33333333333333333333
33333333333333333333
33333333331133333333
33333333333113333333
33333333333113333333
33333333313331333333
33333333133331333333
33333313333313333333
33333111111113333333
33333111111113333333
33333333313331333333
33333333133331333333
33333333133331333333
33333333333333333333
33333333333333333333
33333333333333333333
33333333333333333333
33333333333333333333
33333333333333333333
33333333333333333333
`
  .trim()
  .split('\n')
  .map((row) => row.split('').map(Number));

/** 笑脸 20×20 */
const SMILE_20 = `
33333333333333333333
33333333333333333333
33333333333333333333
33333333333333333333
33333333333333333333
33333333111333133333
33333333111333133333
33333333111333133333
33333333111333133333
33333333333333333333
33333333333333333333
33333222222222223333
33333222222222223333
33333222111111223333
33333222111111223333
33333222222222223333
33333222222222223333
33333333333333333333
33333333333333333333
33333333333333333333
`
  .trim()
  .split('\n')
  .map((row) => row.split('').map(Number));

/** 像素猫 20×20 */
const CAT_20 = `
33333333333333333333
33333333333333333333
33222223322222233233
33211111321111113233
33211331321133113233
33211331321133113233
33222222322222233233
33333333333333333333
33311131113311311333
33111113111331111333
33111113111331111333
33111113111331111333
33333331113311311333
33331113311331113333
33331111111111113333
33331111111111113333
33333333333333333333
33333333333333333333
33333333333333333333
33333333333333333333
`
  .trim()
  .split('\n')
  .map((row) => row.split('').map(Number));

/** OK 表情 20×20 */
const OK_20 = `
33333333333333333333
33333333333333333333
33333333333333333333
33333333111333133333
33333333111333133333
33333333111333133333
33333333111333133333
33333333111333133333
33333333111333133333
33333333111333133333
33333333111333133333
33333333111333133333
33333333111333133333
33333333111333133333
33333333111333133333
33333333111333133333
33333333111333133333
33333333111333133333
33333333333333333333
33333333333333333333
`
  .trim()
  .split('\n')
  .map((row) => row.split('').map(Number));

/** 把二维数组转 Uint8Array（一维） */
function toCells(grid: number[][]): Uint8Array {
  const w = grid[0].length;
  const h = grid.length;
  const arr = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      arr[y * w + x] = grid[y][x];
    }
  }
  return arr;
}

/** 内置模板列表 */
export const TEMPLATES: Template[] = [
  {
    id: 'heart',
    name: '爱心',
    emoji: '❤️',
    description: '经典爱心 20×20',
    width: 20,
    height: 20,
    cells: toCells(HEART_20),
    colors: TEMPLATE_COLORS,
  },
  {
    id: 'star',
    name: '五角星',
    emoji: '⭐',
    description: '五角星 20×20',
    width: 20,
    height: 20,
    cells: toCells(STAR_20),
    colors: TEMPLATE_COLORS,
  },
  {
    id: 'smile',
    name: '笑脸',
    emoji: '😊',
    description: '简单笑脸 20×20',
    width: 20,
    height: 20,
    cells: toCells(SMILE_20),
    colors: TEMPLATE_COLORS,
  },
  {
    id: 'cat',
    name: '像素猫',
    emoji: '🐱',
    description: '可爱像素猫 20×20',
    width: 20,
    height: 20,
    cells: toCells(CAT_20),
    colors: TEMPLATE_COLORS,
  },
  {
    id: 'ok',
    name: 'OK 表情',
    emoji: '👌',
    description: 'OK 表情 20×20',
    width: 20,
    height: 20,
    cells: toCells(OK_20),
    colors: TEMPLATE_COLORS,
  },
];

/** 模板 → BeadGrid */
export function templateToBeadGrid(template: Template): BeadGrid {
  // 模板 cells: 0=透明(EMPTY_CELL), 1=R, 2=W, 3=K
  const w = template.width;
  const h = template.height;
  const beadCells = new Uint16Array(w * h);
  // 在 MARD 中找最接近的色号（红/白/黑）
  // 简化：1→A2 樱红, 2→白（找一个白色色号）, 3→黑色
  const COLOR_INDEX: Record<number, number> = {
    0: EMPTY_CELL,
    1: findColorIndex('#E60012'), // 红
    2: findColorIndex('#FFFFFF'), // 白
    3: findColorIndex('#000000'), // 黑
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = template.cells[y * w + x];
      beadCells[y * w + x] = COLOR_INDEX[c] ?? EMPTY_CELL;
    }
  }
  return buildBeadGrid(beadCells, w, h, MARD_PALETTE);
}

/** 在 MARD 中找最接近 hex 的色卡下标（精确匹配，否则取第一个） */
function findColorIndex(hex: string): number {
  const target = hex.toUpperCase();
  for (let i = 0; i < MARD_PALETTE.entries.length; i++) {
    if (MARD_PALETTE.entries[i].hex.toUpperCase() === target) return i;
  }
  return 0; // fallback
}
