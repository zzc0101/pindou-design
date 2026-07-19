/**
 * 图像增强 + 边缘检测（纯 JS 实现）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 提供 8 种增强手段：
 *   1. 自动白平衡（灰度世界假设）
 *   2. 自动对比度（直方图拉伸）
 *   3. 直方图均衡化（增强对比度）
 *   4. 亮度调整
 *   5. 饱和度调整
 *   6. 锐化（4-邻域 unsharp mask）
 *   7. Sobel 边缘检测（核心算法）
 *   8. Otsu 自适应阈值二值化
 */

import type { ImageData } from '@/types/image';
import { perf } from '@/utils/perf-monitor';

/** 增强选项 */
export interface EnhanceOptions {
  /** 自动白平衡 */
  autoWhiteBalance: boolean;
  /** 自动对比度（直方图拉伸） */
  autoContrast: boolean;
  /** 直方图均衡化（更强对比度） */
  histogramEqualization: boolean;
  /** 亮度调整（-100 ~ +100，0 = 不变） */
  brightness: number;
  /** 饱和度调整（-100 ~ +100，0 = 不变） */
  saturation: number;
  /** 锐化强度（0 ~ 1，0 = 不锐化） */
  sharpen: number;
  /** Sobel 边缘强度（0 ~ 1，0 = 不检测；>0 = 输出"线稿 + 底图"叠加） */
  sobel: number;
  /** Otsu 二值化阈值（0-255，0 = 不启用；>0 = 输出卡通风格） */
  otsuThreshold: number;
}

/** 默认 */
export const DEFAULT_ENHANCE_OPTIONS: EnhanceOptions = {
  autoWhiteBalance: false,
  autoContrast: false,
  histogramEqualization: false,
  brightness: 0,
  saturation: 0,
  sharpen: 0,
  sobel: 0,
  otsuThreshold: 0,
};

/**
 * 图像增强主入口
 */
export function enhance(image: ImageData, opts: EnhanceOptions): ImageData {
  return perf.measureSync(
    'enhance',
    () => enhanceImpl(image, opts),
    {
      whiteBalance: opts.autoWhiteBalance,
      contrast: opts.autoContrast,
      histogramEq: opts.histogramEqualization,
      sharpen: opts.sharpen > 0,
      sobel: opts.sobel > 0,
      otsu: opts.otsuThreshold > 0,
    },
  );
}

function enhanceImpl(image: ImageData, opts: EnhanceOptions): ImageData {
  let data = new Uint8ClampedArray(image.data);

  if (opts.autoWhiteBalance) {
    data = autoWhiteBalance({ data, width: image.width, height: image.height }).data;
  }
  if (opts.brightness !== 0) {
    data = adjustBrightness(data, opts.brightness);
  }
  if (opts.saturation !== 0) {
    data = adjustSaturation(data, opts.saturation);
  }
  if (opts.autoContrast) {
    data = autoContrast(data);
  }
  if (opts.histogramEqualization) {
    data = histogramEqualization(data);
  }
  if (opts.sharpen > 0) {
    data = sharpen(data, image.width, image.height, opts.sharpen);
  }
  if (opts.otsuThreshold > 0) {
    data = otsuBinarize(data, opts.otsuThreshold);
  }
  if (opts.sobel > 0) {
    data = sobelEdgeOverlay(data, image.width, image.height, opts.sobel);
  }

  return { data, width: image.width, height: image.height };
}

/**
 * 自动白平衡（灰度世界假设）
 */
export function autoWhiteBalance(image: ImageData): ImageData {
  const data = image.data;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;
  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    if (data[i + 3] < 128) continue;
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
    count++;
  }
  if (count === 0) return image;
  const rMean = rSum / count;
  const gMean = gSum / count;
  const bMean = bSum / count;
  const gray = (rMean + gMean + bMean) / 3;
  if (rMean === 0 || gMean === 0 || bMean === 0) return image;
  const rScale = gray / rMean;
  const gScale = gray / gMean;
  const bScale = gray / bMean;
  const out = new Uint8ClampedArray(len);
  for (let i = 0; i < len; i += 4) {
    if (data[i + 3] < 128) {
      out[i] = data[i];
      out[i + 1] = data[i + 1];
      out[i + 2] = data[i + 2];
      out[i + 3] = data[i + 3];
      continue;
    }
    out[i] = clamp(data[i] * rScale);
    out[i + 1] = clamp(data[i + 1] * gScale);
    out[i + 2] = clamp(data[i + 2] * bScale);
    out[i + 3] = data[i + 3];
  }
  return { data: out, width: image.width, height: image.height };
}

export function adjustBrightness(data: Uint8ClampedArray, value: number): Uint8ClampedArray {
  const offset = Math.round((value / 100) * 128);
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = clamp(data[i] + offset);
    out[i + 1] = clamp(data[i + 1] + offset);
    out[i + 2] = clamp(data[i + 2] + offset);
    out[i + 3] = data[i + 3];
  }
  return out;
}

export function adjustSaturation(data: Uint8ClampedArray, value: number): Uint8ClampedArray {
  const sat = 1 + value / 100;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) {
      out[i] = data[i];
      out[i + 1] = data[i + 1];
      out[i + 2] = data[i + 2];
      out[i + 3] = data[i + 3];
      continue;
    }
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    out[i] = clamp(gray + (data[i] - gray) * sat);
    out[i + 1] = clamp(gray + (data[i + 1] - gray) * sat);
    out[i + 2] = clamp(gray + (data[i + 2] - gray) * sat);
    out[i + 3] = data[i + 3];
  }
  return out;
}

export function autoContrast(data: Uint8ClampedArray): Uint8ClampedArray {
  let rMin = 255;
  let rMax = 0;
  let gMin = 255;
  let gMax = 0;
  let bMin = 255;
  let bMax = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    if (data[i] < rMin) rMin = data[i];
    if (data[i] > rMax) rMax = data[i];
    if (data[i + 1] < gMin) gMin = data[i + 1];
    if (data[i + 1] > gMax) gMax = data[i + 1];
    if (data[i + 2] < bMin) bMin = data[i + 2];
    if (data[i + 2] > bMax) bMax = data[i + 2];
  }
  const rRange = rMax - rMin || 1;
  const gRange = gMax - gMin || 1;
  const bRange = bMax - bMin || 1;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) {
      out[i] = data[i];
      out[i + 1] = data[i + 1];
      out[i + 2] = data[i + 2];
      out[i + 3] = data[i + 3];
      continue;
    }
    out[i] = clamp(((data[i] - rMin) * 255) / rRange);
    out[i + 1] = clamp(((data[i + 1] - gMin) * 255) / gRange);
    out[i + 2] = clamp(((data[i + 2] - bMin) * 255) / bRange);
    out[i + 3] = data[i + 3];
  }
  return out;
}

export function histogramEqualization(data: Uint8ClampedArray): Uint8ClampedArray {
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const y = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    hist[y]++;
  }
  const cdf = new Uint32Array(256);
  cdf[0] = hist[0];
  for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];
  let cdfMin = 0;
  for (let i = 0; i < 256; i++) {
    if (cdf[i] > 0) {
      cdfMin = cdf[i];
      break;
    }
  }
  const totalPixels = cdf[255];
  if (totalPixels === 0 || totalPixels === cdfMin) return data;
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = clamp(Math.round(((cdf[i] - cdfMin) * 255) / (totalPixels - cdfMin)));
  }
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) {
      out[i] = data[i];
      out[i + 1] = data[i + 1];
      out[i + 2] = data[i + 2];
      out[i + 3] = data[i + 3];
      continue;
    }
    const y = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    const newY = lut[y];
    if (y === 0) {
      out[i] = newY;
      out[i + 1] = newY;
      out[i + 2] = newY;
    } else {
      const scale = newY / y;
      out[i] = clamp(data[i] * scale);
      out[i + 1] = clamp(data[i + 1] * scale);
      out[i + 2] = clamp(data[i + 2] * scale);
    }
    out[i + 3] = data[i + 3];
  }
  return out;
}

export function sharpen(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  strength: number,
): Uint8ClampedArray {
  if (strength <= 0 || width < 3 || height < 3) return data;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) {
        out[i] = data[i];
        out[i + 1] = data[i + 1];
        out[i + 2] = data[i + 2];
        out[i + 3] = data[i + 3];
        continue;
      }
      const left = x > 0 ? i - 4 : i;
      const right = x < width - 1 ? i + 4 : i;
      const top = y > 0 ? i - width * 4 : i;
      const bottom = y < height - 1 ? i + width * 4 : i;
      for (let c = 0; c < 3; c++) {
        const center = data[i + c];
        const avg =
          (data[left + c] + data[right + c] + data[top + c] + data[bottom + c]) / 4;
        const high = center - avg;
        out[i + c] = clamp(center + high * strength);
      }
      out[i + 3] = data[i + 3];
    }
  }
  return out;
}

/**
 * Sobel 边缘检测
 *
 * 算法：3×3 卷积核，计算 X/Y 方向梯度，取绝对值之和。
 *
 * @returns 边缘图（黑白，0 = 无边缘，255 = 强边缘）
 */
export function sobelEdge(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  if (width < 3 || height < 3) return data;
  const out = new Uint8ClampedArray(data.length);
  // Sobel 核
  const Gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const Gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      let sumX = 0;
      let sumY = 0;
      // 3x3 邻域（用亮度计算）
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const ni = ((y + ky) * width + (x + kx)) * 4;
          const lum = 0.299 * data[ni] + 0.587 * data[ni + 1] + 0.114 * data[ni + 2];
          const kid = (ky + 1) * 3 + (kx + 1);
          sumX += lum * Gx[kid];
          sumY += lum * Gy[kid];
        }
      }
      const mag = Math.min(255, Math.sqrt(sumX * sumX + sumY * sumY));
      out[i] = mag;
      out[i + 1] = mag;
      out[i + 2] = mag;
      out[i + 3] = 255;
    }
  }
  // 边界：复制原图
  for (let y = 0; y < height; y++) {
    if (y === 0 || y === height - 1) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        out[i] = data[i];
        out[i + 1] = data[i + 1];
        out[i + 2] = data[i + 2];
        out[i + 3] = data[i + 3];
      }
    } else {
      const left = (y * width) * 4;
      const right = (y * width + width - 1) * 4;
      out[left] = data[left];
      out[left + 1] = data[left + 1];
      out[left + 2] = data[left + 2];
      out[left + 3] = data[left + 3];
      out[right] = data[right];
      out[right + 1] = data[right + 1];
      out[right + 2] = data[right + 2];
      out[right + 3] = data[right + 3];
    }
  }
  return out;
}

/**
 * Sobel 边缘叠加（在原图上叠加黑色线稿）
 */
function sobelEdgeOverlay(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  strength: number,
): Uint8ClampedArray {
  const edge = sobelEdge(data, width, height);
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const eVal = edge[i]; // 灰度边缘强度
    if (eVal > 50) {
      // 边缘像素：黑色覆盖（按 strength 混合）
      out[i] = clamp(data[i] * (1 - strength));
      out[i + 1] = clamp(data[i + 1] * (1 - strength));
      out[i + 2] = clamp(data[i + 2] * (1 - strength));
    } else {
      out[i] = data[i];
      out[i + 1] = data[i + 1];
      out[i + 2] = data[i + 2];
    }
    out[i + 3] = data[i + 3];
  }
  return out;
}

/**
 * Otsu 自适应阈值
 *
 * 算法：找使类间方差最大的灰度阈值
 *
 * @param fixedThreshold 固定阈值（>0 时用固定值，0 时自动计算 Otsu）
 * @returns 二值化后的数据
 */
export function otsuBinarize(data: Uint8ClampedArray, fixedThreshold: number): Uint8ClampedArray {
  // 1) 亮度直方图
  const hist = new Uint32Array(256);
  let totalPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const y = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    hist[y]++;
    totalPixels++;
  }
  if (totalPixels === 0) return data;

  let threshold = fixedThreshold;
  if (fixedThreshold <= 0) {
    // 2) Otsu：找类间方差最大的阈值
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0;
    let wB = 0;
    let maxVar = 0;
    let bestT = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = totalPixels - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > maxVar) {
        maxVar = between;
        bestT = t;
      }
    }
    threshold = bestT;
  }

  // 3) 应用阈值：> threshold = 白（255），< threshold = 黑（0）
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) {
      out[i] = data[i];
      out[i + 1] = data[i + 1];
      out[i + 2] = data[i + 2];
      out[i + 3] = data[i + 3];
      continue;
    }
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const v = y >= threshold ? 255 : 0;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }
  return out;
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}