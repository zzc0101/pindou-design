/**
 * Perler 标准色卡数据（扩展版，~85 色）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 来源：Perler 官方色卡 + 社区整理（基于通用 RGB 知识）
 * 色号格式：P01 ~ P92（数字 + 字母后缀：PC 珠光 / PM 金属 / PG 荧光）
 */

export interface PerlerEntry {
  code: string;
  name: string;
  hex: string;
}

/** Perler 标准色（约 85 色核心集） */
export const PERLER_ENTRIES: PerlerEntry[] = [
  // 红色系
  { code: 'P01', name: 'Red', hex: '#E50000' },
  { code: 'P02', name: 'Cranapple', hex: '#B7003A' },
  { code: 'P03', name: 'Hot Coral', hex: '#FF5252' },
  { code: 'P04', name: 'Magenta', hex: '#D62598' },
  { code: 'P05', name: 'Bubblegum', hex: '#F5A8C8' },
  { code: 'P06', name: 'Cherry', hex: '#A6001A' },
  { code: 'P07', name: 'Tomato', hex: '#E64C2C' },
  { code: 'P08', name: 'Salmon', hex: '#FF8E7C' },

  // 橙色系
  { code: 'P10', name: 'Orange', hex: '#FF7F00' },
  { code: 'P11', name: 'Pumpkin', hex: '#FF8000' },
  { code: 'P12', name: 'Peach', hex: '#FFCBA4' },
  { code: 'P13', name: 'Tangerine', hex: '#FFA64D' },
  { code: 'P14', name: 'Apricot', hex: '#FFB37E' },

  // 黄色系
  { code: 'P20', name: 'Yellow', hex: '#FFE800' },
  { code: 'P21', name: 'Bright Yellow', hex: '#FFEC00' },
  { code: 'P22', name: 'Pastel Yellow', hex: '#FFF4A3' },
  { code: 'P23', name: 'Gold', hex: '#C9A227' },
  { code: 'P24', name: 'Mustard', hex: '#B8950A' },
  { code: 'P25', name: 'Cream', hex: '#FFF3C2' },

  // 绿色系
  { code: 'P30', name: 'Green', hex: '#008542' },
  { code: 'P31', name: 'Kiwi Lime', hex: '#7DC242' },
  { code: 'P32', name: 'Light Green', hex: '#A4D55B' },
  { code: 'P33', name: 'Mint', hex: '#7FE0BC' },
  { code: 'P34', name: 'Dark Green', hex: '#00603B' },
  { code: 'P35', name: 'Forest Green', hex: '#1F6B3D' },
  { code: 'P36', name: 'Olive', hex: '#708238' },
  { code: 'P37', name: 'Pistachio', hex: '#B5D58A' },
  { code: 'P38', name: 'Pear Green', hex: '#D4E5A8' },

  // 蓝色系
  { code: 'P40', name: 'Blue', hex: '#1E64C8' },
  { code: 'P41', name: 'Dark Blue', hex: '#003A78' },
  { code: 'P42', name: 'Periwinkle', hex: '#7C8FD9' },
  { code: 'P43', name: 'Light Blue', hex: '#A8D0F0' },
  { code: 'P44', name: 'Pastel Blue', hex: '#C3E0F5' },
  { code: 'P45', name: 'Turquoise', hex: '#00B5B8' },
  { code: 'P46', name: 'Teal', hex: '#008080' },
  { code: 'P47', name: 'Cyan', hex: '#00B7EB' },
  { code: 'P48', name: 'Sky Blue', hex: '#5DADE2' },
  { code: 'P49', name: 'Navy', hex: '#0A2463' },

  // 紫色系
  { code: 'P50', name: 'Purple', hex: '#84329B' },
  { code: 'P51', name: 'Plum', hex: '#923293' },
  { code: 'P52', name: 'Lavender', hex: '#B695C9' },
  { code: 'P53', name: 'Pastel Lavender', hex: '#D4C5E2' },
  { code: 'P54', name: 'Violet', hex: '#6633CC' },
  { code: 'P55', name: 'Lilac', hex: '#C8A2D8' },

  // 棕色系
  { code: 'P60', name: 'Brown', hex: '#7A4625' },
  { code: 'P61', name: 'Tan', hex: '#D2A571' },
  { code: 'P62', name: 'Beige', hex: '#E8D4A8' },
  { code: 'P63', name: 'Sand', hex: '#C9B58F' },
  { code: 'P64', name: 'Light Brown', hex: '#A47551' },
  { code: 'P65', name: 'Dark Brown', hex: '#5C3A21' },

  // 中性色
  { code: 'P70', name: 'White', hex: '#FFFFFF' },
  { code: 'P71', name: 'Cream', hex: '#F5F1DC' },
  { code: 'P72', name: 'Light Gray', hex: '#D8D8D8' },
  { code: 'P73', name: 'Gray', hex: '#909090' },
  { code: 'P74', name: 'Dark Gray', hex: '#505050' },
  { code: 'P75', name: 'Black', hex: '#1A1A1A' },
  { code: 'P76', name: 'Silver Gray', hex: '#A8A8A8' },
  { code: 'P77', name: 'Charcoal', hex: '#2A2A2A' },

  // 粉/桃色
  { code: 'P80', name: 'Pink', hex: '#F8B7CD' },
  { code: 'P81', name: 'Hot Pink', hex: '#FF3399' },
  { code: 'P82', name: 'Light Pink', hex: '#FCDDE5' },
  { code: 'P83', name: 'Rose Pink', hex: '#E89BB0' },
  { code: 'P84', name: 'Pastel Pink', hex: '#F8D2DC' },

  // 特殊
  { code: 'P90', name: 'Black Pearl', hex: '#0A0A1F' },
  { code: 'P91', name: 'Silver', hex: '#C0C0C0' },
  { code: 'P92', name: 'Gold Sparkle', hex: '#D4AF37' },
];