/**
 * Canvas 像素读取适配
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * uni.canvasGetImageData 是异步 API，统一 Promise 包装便于业务层 await。
 * 输出与浏览器 ImageData 结构一致：{ data: Uint8ClampedArray, width, height }
 */

export interface CanvasImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * 从 Canvas 读取指定区域的像素数据
 *
 * @param canvasId canvas 元素的 id
 * @param canvas  canvas 元素实例（新版 type="2d" 需要传）
 * @param x 起始 X 坐标
 * @param y 起始 Y 坐标
 * @param width 区域宽度
 * @param height 区域高度
 * @returns CanvasImageData
 */
export function canvasGetImageData(
  canvasId: string,
  canvas: unknown,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<CanvasImageData> {
  return new Promise((resolve, reject) => {
    uni.canvasGetImageData({
      canvasId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas: canvas as any,
      x,
      y,
      width,
      height,
      success: (res) => {
        resolve({
          data: res.data as unknown as Uint8ClampedArray,
          width: res.width,
          height: res.height,
        });
      },
      fail: (err) => reject(new Error(err.errMsg ?? 'canvasGetImageData failed')),
    });
  });
}
