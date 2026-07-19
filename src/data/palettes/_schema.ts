/**
 * 色板数据 schema 与类型守卫
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * MARD/Perler/Hama JSON 文件遵循此 schema。
 * 加载时必须经过类型守卫校验。
 */

import type { Lab, Palette, PaletteEntry } from '@/types/palette';

/** 色板 JSON 原始结构（hex/code/name 是必备，lab 可缺省由运行时算） */
interface PaletteJson {
  id: string;
  name: string;
  source: 'mard' | 'perler' | 'hama' | 'custom';
  entries: Array<{
    code: string;
    name?: string;
    hex: string;
    lab?: readonly [number, number, number];
  }>;
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** 校验 + 转换色板 JSON → Palette */
export function parsePalette(json: unknown): Palette {
  if (!isObject(json)) throw new Error('Palette JSON 根节点必须是对象');
  const j = json as Partial<PaletteJson>;
  if (typeof j.id !== 'string' || !j.id) throw new Error('Palette.id 必填');
  if (typeof j.name !== 'string' || !j.name) throw new Error('Palette.name 必填');
  if (!['mard', 'perler', 'hama', 'custom'].includes(j.source ?? '')) {
    throw new Error(`Palette.source 非法: ${String(j.source)}`);
  }
  if (!Array.isArray(j.entries)) throw new Error('Palette.entries 必须是数组');

  const entries: PaletteEntry[] = j.entries.map((e, idx) => {
    if (!isObject(e)) throw new Error(`entries[${idx}] 不是对象`);
    if (typeof e.code !== 'string' || !e.code) {
      throw new Error(`entries[${idx}].code 必填`);
    }
    if (typeof e.hex !== 'string' || !HEX_RE.test(e.hex)) {
      throw new Error(`entries[${idx}].hex 非法: ${String(e.hex)}`);
    }
    if (!Array.isArray(e.lab) || e.lab.length !== 3) {
      throw new Error(`entries[${idx}].lab 必填且为三元组（启动时已预计算）`);
    }
    const lab = e.lab as unknown as Lab;
    return {
      code: e.code,
      name: e.name,
      hex: e.hex.toUpperCase(),
      lab,
    };
  });

  return {
    id: j.id,
    name: j.name,
    source: j.source as Palette['source'],
    entries,
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
