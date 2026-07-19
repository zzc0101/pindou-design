/**
 * 图像与像素数据类型定义
 *
 * @author zhuzc
 * @date 2026-06-22
 */

/** 单像素 RGBA（0-255） */
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** 图像数据（与浏览器/小程序 ImageData 兼容） */
export interface ImageData {
  /** 像素数据，RGBA 顺序，每像素 4 字节 */
  data: Uint8ClampedArray;
  /** 图像宽度（像素） */
  width: number;
  /** 图像高度（像素） */
  height: number;
  /** 色彩空间（与浏览器标准 ImageData 对齐；小程序可缺省） */
  colorSpace?: 'srgb' | 'display-p3';
}

/** 图像元信息 */
export interface ImageMeta {
  width: number;
  height: number;
  /** 临时文件路径（小程序） */
  tempFilePath?: string;
  /** 文件大小（字节） */
  size?: number;
  /** MIME 类型 */
  mimeType?: string;
}
