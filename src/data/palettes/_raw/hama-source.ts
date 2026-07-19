/**
 * Hama 标准色卡数据（扩展版，~50 色）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 来源：Hama 官方色卡 + 社区整理
 * 色号格式：H01 ~ H50
 */

export interface HamaEntry {
  code: string;
  name: string;
  hex: string;
}

/** Hama 标准色（约 50 色核心集） */
export const HAMA_ENTRIES: HamaEntry[] = [
  // 红色系
  { code: 'H01', name: 'Red', hex: '#E60012' },
  { code: 'H02', name: 'Cherry', hex: '#D70B15' },
  { code: 'H03', name: 'Coral', hex: '#FF6F61' },
  { code: 'H04', name: 'Pink', hex: '#F5A8C8' },
  { code: 'H05', name: 'Magenta', hex: '#C8246F' },
  { code: 'H06', name: 'Tomato', hex: '#E04040' },
  { code: 'H07', name: 'Light Pink', hex: '#FBD0D8' },

  // 橙色系
  { code: 'H10', name: 'Orange', hex: '#FF7900' },
  { code: 'H11', name: 'Light Orange', hex: '#FFB660' },
  { code: 'H12', name: 'Apricot', hex: '#FFCBA4' },
  { code: 'H13', name: 'Tangerine', hex: '#FFA552' },

  // 黄色系
  { code: 'H20', name: 'Yellow', hex: '#FFE300' },
  { code: 'H21', name: 'Light Yellow', hex: '#FFF4A3' },
  { code: 'H22', name: 'Lemon', hex: '#FFEC00' },
  { code: 'H23', name: 'Mustard', hex: '#B89C3A' },
  { code: 'H24', name: 'Cream', hex: '#FFF3C2' },

  // 绿色系
  { code: 'H30', name: 'Green', hex: '#009639' },
  { code: 'H31', name: 'Light Green', hex: '#7DC242' },
  { code: 'H32', name: 'Mint', hex: '#80E0A7' },
  { code: 'H33', name: 'Dark Green', hex: '#006A3C' },
  { code: 'H34', name: 'Olive', hex: '#7A7A2C' },
  { code: 'H35', name: 'Pistachio', hex: '#B0D080' },

  // 蓝色系
  { code: 'H40', name: 'Blue', hex: '#0067B3' },
  { code: 'H41', name: 'Dark Blue', hex: '#003A78' },
  { code: 'H42', name: 'Light Blue', hex: '#88B9E0' },
  { code: 'H43', name: 'Cyan', hex: '#00B5B8' },
  { code: 'H44', name: 'Turquoise', hex: '#40C0C0' },
  { code: 'H45', name: 'Sky Blue', hex: '#4DABE5' },
  { code: 'H46', name: 'Navy', hex: '#0A2463' },

  // 紫色系
  { code: 'H50', name: 'Purple', hex: '#84329B' },
  { code: 'H51', name: 'Lavender', hex: '#B695C9' },
  { code: 'H52', name: 'Pink Purple', hex: '#D27BB5' },
  { code: 'H53', name: 'Lilac', hex: '#C8A2D8' },

  // 棕色系
  { code: 'H60', name: 'Brown', hex: '#7A4625' },
  { code: 'H61', name: 'Light Brown', hex: '#A87545' },
  { code: 'H62', name: 'Beige', hex: '#E8D4A8' },
  { code: 'H63', name: 'Sand', hex: '#C9B58F' },
  { code: 'H64', name: 'Dark Brown', hex: '#5C3A21' },

  // 中性色
  { code: 'H70', name: 'White', hex: '#FFFFFF' },
  { code: 'H71', name: 'Cream', hex: '#F5F1DC' },
  { code: 'H72', name: 'Light Gray', hex: '#D8D8D8' },
  { code: 'H73', name: 'Gray', hex: '#909090' },
  { code: 'H74', name: 'Dark Gray', hex: '#404040' },
  { code: 'H75', name: 'Black', hex: '#1A1A1A' },
  { code: 'H76', name: 'Silver', hex: '#A8A8A8' },

  // 粉/桃
  { code: 'H80', name: 'Soft Pink', hex: '#FCDDE5' },
  { code: 'H81', name: 'Hot Pink', hex: '#FF3399' },
  { code: 'H82', name: 'Pastel Pink', hex: '#F8D2DC' },

  // 特殊
  { code: 'H90', name: 'Beige Pearl', hex: '#E6D5B8' },
  { code: 'H91', name: 'Silver Pearl', hex: '#C0C0C0' },
  { code: 'H92', name: 'Copper', hex: '#B87333' },
  { code: 'H93', name: 'Gold Pearl', hex: '#D4AF37' },
];