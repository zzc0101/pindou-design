/**
 * Canvas 适配层
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * OffscreenCanvas 跨端差异：
 *   - 微信：wx.createOffscreenCanvas({ type: '2d', width, height })
 *   - 抖音：tt.createOffscreenCanvas(width, height)（同步），1.78+ 才支持
 *
 * 已知风险：抖音同时只能激活一个 OffscreenCanvas Worker。
 */

// 微信/抖音全局对象声明（uni-app 条件编译生效时这两个全局才存在）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const wx: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const tt: any;

export interface OffscreenCanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): CanvasRenderingContext2D | null;
}

/**
 * 创建离屏 Canvas（用于大图处理）
 *
 * @param width 画布宽度
 * @param height 画布高度
 * @returns OffscreenCanvasLike（小程序返回原生对象）
 */
export function createOffscreenCanvas(width: number, height: number): OffscreenCanvasLike {
  // #ifdef MP-WEIXIN
  return wx.createOffscreenCanvas({ type: '2d', width, height });
  // #endif
  // #ifdef MP-TOUTIAO
  return tt.createOffscreenCanvas(width, height);
  // #endif
  // #ifndef MP-WEIXIN || MP-TOUTIAO
  throw new Error('OffscreenCanvas 仅在小程序环境可用');
  // #endif
}

/**
 * 检测当前环境是否支持 OffscreenCanvas
 */
export function isOffscreenCanvasSupported(): boolean {
  // #ifdef MP-WEIXIN
  return typeof wx.createOffscreenCanvas === 'function';
  // #endif
  // #ifdef MP-TOUTIAO
  return typeof tt.createOffscreenCanvas === 'function';
  // #endif
  // #ifndef MP-WEIXIN || MP-TOUTIAO
  return false;
  // #endif
}
