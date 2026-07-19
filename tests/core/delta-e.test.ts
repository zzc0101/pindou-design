/**
 * delta-e.ts 测试
 */

import { describe, expect, it } from 'vitest';
import { deltaE2000 } from '@/core/color/delta-e';

describe('deltaE2000', () => {
  it('同色 ΔE = 0', () => {
    expect(deltaE2000([50, 20, 30], [50, 20, 30])).toBe(0);
  });

  it('对称性：ΔE(A,B) = ΔE(B,A)', () => {
    const lab1 = [60.0, 30.0, -20.0] as const;
    const lab2 = [40.0, -10.0, 50.0] as const;
    const d1 = deltaE2000(lab1, lab2);
    const d2 = deltaE2000(lab2, lab1);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });

  it('纯黑 vs 纯白 ΔE 接近 100（实际 CIEDE2000 公式黑到白 = 100）', () => {
    const black: [number, number, number] = [0, 0, 0];
    const white: [number, number, number] = [100, 0, 0];
    const d = deltaE2000(black, white);
    expect(d).toBeGreaterThan(95);
    expect(d).toBeLessThan(105);
  });

  it('红色 vs 绿色 ΔE 较大（典型值约 86）', () => {
    const red: [number, number, number] = [53.24, 80.09, 67.20];
    const green: [number, number, number] = [87.73, -86.18, 83.18];
    const d = deltaE2000(red, green);
    expect(d).toBeGreaterThan(70);
    expect(d).toBeLessThan(120);
  });

  it('相邻色 ΔE 较小（< 5）', () => {
    const c1: [number, number, number] = [50.0, 25.0, 30.0];
    const c2: [number, number, number] = [51.0, 24.0, 31.0];
    const d = deltaE2000(c1, c2);
    expect(d).toBeLessThan(5);
  });
});
