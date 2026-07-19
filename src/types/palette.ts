/**
 * 色板类型定义
 *
 * @author zhuzc
 * @date 2026-06-22
 */

/** CIE Lab 颜色值（L, a, b），L ∈ [0, 100]，a/b ∈ [-128, 127] */
export type Lab = readonly [number, number, number];

/** 色板来源 */
export type PaletteSource = 'mard' | 'perler' | 'hama' | 'custom';

/** 单个色卡条目 */
export interface PaletteEntry {
  /** 色号（如 MARD "H1"，Perler "P01"，Hama "H01"） */
  code: string;
  /** 中文名（可选） */
  name?: string;
  /** 16 进制颜色值（含 #，大写） */
  hex: string;
  /** 预计算的 Lab 值（启动时一次性算好，量化时直接用） */
  lab: Lab;
}

/** 色板（一组 PaletteEntry） */
export interface Palette {
  /** 色板唯一 id（如 "mard"、"perler"、"custom-uuid"） */
  id: string;
  /** 色板显示名 */
  name: string;
  /** 色板来源 */
  source: PaletteSource;
  /** 色板条目 */
  entries: PaletteEntry[];
}
