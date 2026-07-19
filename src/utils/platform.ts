/**
 * 平台判断工具
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 通过运行时检测 wx/tt 全局对象是否存在来判断当前平台，
 * 不依赖条件编译（条件编译是源码级替换，会让 Vitest 无法运行）。
 */

import type { Platform } from '@/types/platform';

/**
 * 检测微信 wx 全局是否存在
 */
function hasWx(): boolean {
  try {
    return typeof (globalThis as { wx?: unknown }).wx !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * 检测抖音 tt 全局是否存在
 */
function hasTt(): boolean {
  try {
    return typeof (globalThis as { tt?: unknown }).tt !== 'undefined';
  } catch {
    return false;
  }
}

/** 是否运行在微信小程序环境 */
export function isWeixin(): boolean {
  return hasWx();
}

/** 是否运行在抖音小程序环境 */
export function isToutiao(): boolean {
  return hasTt();
}

/** 是否运行在小程序环境（微信 + 抖音） */
export function isMiniProgram(): boolean {
  return isWeixin() || isToutiao();
}

/** 获取当前平台标识 */
export function getPlatform(): Platform {
  if (isWeixin()) return 'mp-weixin';
  if (isToutiao()) return 'mp-toutiao';
  // H5 / App 后续补充
  return 'unknown';
}
