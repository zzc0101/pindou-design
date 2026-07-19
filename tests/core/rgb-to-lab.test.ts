/**
 * rgb-to-lab.ts 测试
 */

import { describe, expect, it } from 'vitest';
import { rgbToLab, rgbaBytesToLabs } from '@/core/color/rgb-to-lab';

describe('rgbToLab', () => {
  it('纯白 (255,255,255) → L≈100, a≈0, b≈0', () => {
    const [L, a, b] = rgbToLab(255, 255, 255);
    expect(L).toBeCloseTo(100, 0);
    expect(a).toBeCloseTo(0, 0);
    expect(b).toBeCloseTo(0, 0);
  });

  it('纯黑 (0,0,0) → L≈0, a=0, b=0', () => {
    const [L, a, b] = rgbToLab(0, 0, 0);
    expect(L).toBeCloseTo(0, 0);
    expect(a).toBe(0);
    expect(b).toBe(0);
  });

  it('纯红 (255,0,0) → a>50, b>50', () => {
    const [, a, b] = rgbToLab(255, 0, 0);
    expect(a).toBeGreaterThan(50);
    expect(b).toBeGreaterThan(30);
  });

  it('纯绿 (0,255,0) → a<0, b>50', () => {
    const [, a, b] = rgbToLab(0, 255, 0);
    expect(a).toBeLessThan(0);
    expect(b).toBeGreaterThan(50);
  });

  it('纯蓝 (0,0,255) → a>0, b<-50', () => {
    const [, a, b] = rgbToLab(0, 0, 255);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeLessThan(-50);
  });

  it('中性灰 (128,128,128) → a≈0, b≈0', () => {
    const [, a, b] = rgbToLab(128, 128, 128);
    expect(a).toBeCloseTo(0, 3);
    expect(b).toBeCloseTo(0, 3);
  });

  it('返回 Lab 是 readonly 三元组', () => {
    const lab = rgbToLab(100, 100, 100);
    expect(lab.length).toBe(3);
  });
});

describe('rgbaBytesToLabs', () => {
  it('输出长度 = 像素数 * 3', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
    const labs = rgbaBytesToLabs(data, 2);
    expect(labs.length).toBe(6);
  });

  it('像素 0 是纯红 → Lab a>50', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255]);
    const labs = rgbaBytesToLabs(data, 1);
    expect(labs[1]).toBeGreaterThan(50);
    expect(labs[2]).toBeGreaterThan(30);
  });
});
