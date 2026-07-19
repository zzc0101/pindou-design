/**
 * CIEDE2000 色差公式
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 参考标准：Sharma, Wu, Dalal 2005 "The CIEDE2000 Color-Difference Formula"
 * 实现要点：
 *   1. h_bar 色调要做环形平均（涉及 360°→0° 跳变）
 *   2. T 项是色调权重，包含 S_L、S_C、S_H 三项加权函数
 *   3. R_T 是旋转项（修正蓝色区域感知偏差）
 */

import type { Lab } from '@/types/palette';

/** 角度归一化到 [0, 360) */
function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * 计算两个 Lab 颜色之间的 CIEDE2000 色差
 *
 * @param lab1 Lab 三元组 [L, a, b]
 * @param lab2 Lab 三元组 [L, a, b]
 * @returns ΔE2000 值，越小越相似；0 = 完全相同
 */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  // 1) C*ab, h*ab (输入 Lab 的极坐标)
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;

  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const h1p = hueAngle(b1, a1p);
  const h2p = hueAngle(b2, a2p);

  // 2) ΔL', ΔC', Δh'
  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else {
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180) dhp = diff;
    else if (diff > 180) dhp = diff - 360;
    else dhp = diff + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(degToRad(dhp / 2));

  // 3) 平均值 L̄', C̄', h̄'
  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp: number;
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p;
  } else {
    const sum = h1p + h2p;
    if (Math.abs(h1p - h2p) <= 180) hbarp = sum / 2;
    else if (sum < 360) hbarp = (sum + 360) / 2;
    else hbarp = (sum - 360) / 2;
  }

  // 4) T 项（色调权重）
  const T = 1
    - 0.17 * Math.cos(degToRad(hbarp - 30))
    + 0.24 * Math.cos(degToRad(2 * hbarp))
    + 0.32 * Math.cos(degToRad(3 * hbarp + 6))
    - 0.20 * Math.cos(degToRad(4 * hbarp - 63));

  // 5) ΔΘ（旋转角）
  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(degToRad(2 * dTheta)) * Rc;

  // 6) 最终 ΔE2000
  const kL = 1;
  const kC = 1;
  const kH = 1;

  const term1 = dLp / (kL * Sl);
  const term2 = dCp / (kC * Sc);
  const term3 = dHp / (kH * Sh);
  const inside = term1 * term1 + term2 * term2 + term3 * term3 + Rt * term2 * term3;

  return Math.sqrt(inside);
}

/** 极坐标角度计算（0° 在 +a 轴，逆时针） */
function hueAngle(b: number, ap: number): number {
  if (b === 0 && ap === 0) return 0;
  let h = radToDeg(Math.atan2(b, ap));
  if (h < 0) h += 360;
  return h;
}
