/**
 * 拼豆单元类型定义
 *
 * @author zhuzc
 * @date 2026-06-22
 */

/** 单个拼豆单元 */
export interface Bead {
  /** 网格 X 坐标（列号，从 0 开始） */
  x: number;
  /** 网格 Y 坐标（行号，从 0 开始） */
  y: number;
  /** 色卡下标（指向 PaletteEntry 数组的下标） */
  colorIndex: number;
  /** 16 进制颜色值（含 #），冗余存储以减少运行时查找 */
  hex: string;
  /** 色号字符串（如 "H1"），冗余存储用于导出 */
  code: string;
}

/** 拼豆网格统计 */
export interface BeadGridStats {
  /** 总格子数 */
  totalCells: number;
  /** 已填充的格子数（colorIndex !== 0） */
  filledCells: number;
  /** 各色卡下标的使用数量，key 为下标，value 为数量 */
  colorCounts: Map<number, number>;
}

/** 拼豆网格（一整张图纸） */
export interface BeadGrid {
  /** 网格宽度（格子数） */
  width: number;
  /** 网格高度（格子数） */
  height: number;
  /** 一维数组，每格存色卡下标；长度 = width * height；0 表示无色/透明 */
  cells: Uint16Array;
  /** 所使用的色板 */
  palette: import('./palette').Palette;
  /** 统计信息 */
  stats: BeadGridStats;
}
