/**
 * 自定义色板导入
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 支持格式：
 *   1. JSON 数组：`[{ "code": "R", "name": "红", "hex": "#FF0000" }, ...]`
 *   2. CSV 文本：`code,name,hex\nR,红,#FF0000\n...`
 *
 * 解析后用现有的 parsePalette schema 校验，错误抛出含原因的 Error。
 */

import type { Palette, PaletteSource } from '@/types/palette';
import { parsePalette } from '@/data/palettes/_schema';
import { rgbToLab } from './color/rgb-to-lab';

/** 解析用户输入（自动识别 JSON / CSV） */
export function parseUserPalette(input: string, nameHint?: string): Palette {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('内容为空');

  let rawEntries: Array<{ code: string; hex: string; name?: string }>;
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    rawEntries = parseJsonPalette(trimmed);
  } else {
    rawEntries = parseCsvPalette(trimmed);
  }

  // 校验每条 entry 都有 code 和 hex
  for (const e of rawEntries) {
    if (!e.code || typeof e.code !== 'string') {
      throw new Error('每个色卡条目必须有 code 字段（字符串）');
    }
    if (!e.hex || typeof e.hex !== 'string') {
      throw new Error(`条目 "${e.code}" 缺少 hex 字段或 hex 不是字符串`);
    }
  }

  // 自动补 lab（parsePalette schema 必填）
  const entries = rawEntries.map((e) => {
    const hex = e.hex.startsWith('#') ? e.hex : `#${e.hex}`;
    const [r, g, b] = hexToRgb(hex);
    const [L, a, bb] = rgbToLab(r, g, b);
    return {
      code: e.code,
      hex: hex.toUpperCase(),
      name: e.name,
      lab: [Number(L.toFixed(2)), Number(a.toFixed(2)), Number(bb.toFixed(2))],
    };
  });

  const obj = {
    id: `custom-${Date.now().toString(36)}`,
    name: nameHint ?? '自定义色板',
    source: 'custom' as PaletteSource,
    entries,
  };
  return parsePalette(obj);
}

/** JSON 格式：[{ code, hex, name? }] */
function parseJsonPalette(input: string): Array<{ code: string; hex: string; name?: string }> {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch (e) {
    throw new Error(`JSON 解析失败: ${(e as Error).message}`);
  }

  if (!Array.isArray(raw)) {
    // 单个对象包成数组
    raw = [raw];
  }
  if ((raw as unknown[]).length === 0) {
    throw new Error('JSON 数组为空');
  }
  return raw as Array<{ code: string; hex: string; name?: string }>;
}

/** CSV 格式：code,name,hex（第一行是表头） */
function parseCsvPalette(
  input: string,
): Array<{ code: string; hex: string; name?: string }> {
  const lines = input.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV 至少需要 2 行（表头 + 1 个色）');
  }
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const codeIdx = header.indexOf('code');
  const hexIdx = header.indexOf('hex');
  const nameIdx = header.indexOf('name');
  if (codeIdx < 0 || hexIdx < 0) {
    throw new Error('CSV 必须包含 code 和 hex 列');
  }
  const entries: Array<{ code: string; hex: string; name?: string }> = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const code = cells[codeIdx]?.trim();
    const hex = cells[hexIdx]?.trim();
    const name = nameIdx >= 0 ? cells[nameIdx]?.trim() : undefined;
    if (!code || !hex) continue;
    entries.push({ code, hex, name });
  }
  if (entries.length === 0) {
    throw new Error('CSV 中没有有效条目');
  }
  return entries;
}

/** hex → RGB */
function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace(/^#/, '');
  return [
    parseInt(s.substring(0, 2), 16),
    parseInt(s.substring(2, 4), 16),
    parseInt(s.substring(4, 6), 16),
  ];
}

/** 简易 CSV 行解析（支持双引号包裹） */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  cells.push(cur);
  return cells;
}
