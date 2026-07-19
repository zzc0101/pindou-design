/**
 * sRGB → CIE Lab 颜色空间转换
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 转换链路：sRGB (0-255) → linear sRGB → XYZ (D65) → CIE Lab
 * 之所以用 Lab 而非 RGB 做色差计算：
 *   1. RGB 是设备相关空间，不是感知均匀空间（直接欧氏距离误差大）
 *   2. Lab 由 CIE 1931 标准定义，ΔE 与人眼感知高度相关
 *   3. 工业标准 CIEDE2000 在 Lab 空间定义
 */

import type { Lab } from '@/types/palette';

/**
 * sRGB 反 gamma 校正（带线性段）
 *
 * @param c sRGB 通道值（0-255）
 * @returns linear RGB 通道值（0-1）
 */
function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * linear sRGB → XYZ (D65)
 *
 * 矩阵来自 sRGB IEC 61966-2-1 标准。
 */
function linearRgbToXyz(r: number, g: number, b: number): [number, number, number] {
  // 行向量是 r/g/b，列是 X/Y/Z
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
  return [x, y, z];
}

/** D65 白点 XYZ */
const D65 = [0.95047, 1.0, 1.08883] as const;

/** XYZ → Lab 的 f(t) 函数 */
function labF(t: number): number {
  const delta = 6 / 29;
  return t > Math.pow(delta, 3) ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29;
}

/**
 * sRGB (0-255) → CIE Lab (D65)
 *
 * @param r 红色 0-255
 * @param g 绿色 0-255
 * @param b 蓝色 0-255
 * @returns Lab 三元组 [L, a, b]
 */
export function rgbToLab(r: number, g: number, b: number): Lab {
  // 1) sRGB → linear sRGB
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  // 2) linear sRGB → XYZ
  const [x, y, z] = linearRgbToXyz(lr, lg, lb);

  // 3) XYZ → Lab（用 D65 白点归一化）
  const fx = labF(x / D65[0]);
  const fy = labF(y / D65[1]);
  const fz = labF(z / D65[2]);

  const L = 116 * fy - 16;
  const A = 500 * (fx - fy);
  const B = 200 * (fy - fz);

  return [L, A, B] as const;
}

/**
 * 批量转换：传入 RGBA 字节数组，返回对应长度的 Lab 数组
 *
 * @param data RGBA 字节数组（Uint8ClampedArray）
 * @param pixelCount 像素数
 * @returns Lab 三元组数组
 */
export function rgbaBytesToLabs(
  data: Uint8ClampedArray,
  pixelCount: number,
): Float32Array {
  // 交错存储：每像素 L/a/b 三个 float32
  const out = new Float32Array(pixelCount * 3);
  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const lab = rgbToLab(r, g, b);
    out[i * 3] = lab[0];
    out[i * 3 + 1] = lab[1];
    out[i * 3 + 2] = lab[2];
  }
  return out;
}
