/**
 * 文件系统适配（选择图片、保存到相册）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * MVP 范围：相册选图 + 保存到相册。
 * V2 范围：拍照上传（需要 scope.camera 权限）。
 */

export interface ChooseImageResult {
  /** 临时文件路径列表 */
  tempFilePaths: string[];
  /** 临时文件列表（含 size、type 等） */
  tempFiles: Array<{ path: string; size: number; type?: string }>;
}

/**
 * 选择图片（相册 / 拍照）
 *
 * @param opts count: 最多选几张（默认 1），sourceType: ['album'] | ['camera'] | ['album', 'camera']
 * @returns ChooseImageResult
 */
export function chooseImage(
  opts: { count?: number; sourceType?: Array<'album' | 'camera'> } = {},
): Promise<ChooseImageResult> {
  const count = opts.count ?? 1;
  const sourceType = opts.sourceType ?? ['album'];
  return new Promise((resolve, reject) => {
    uni.chooseImage({
      count,
      sourceType,
      sizeType: ['original', 'compressed'],
      success: (res) => {
        // uni 类型在多端下 tempFilePaths/tempFiles 是 string|string[]、File|File[]，统一归一化
        const rawPaths = res.tempFilePaths;
        const paths = Array.isArray(rawPaths) ? rawPaths : rawPaths ? [rawPaths] : [];
        const rawFiles = res.tempFiles;
        const filesArr = Array.isArray(rawFiles) ? rawFiles : rawFiles ? [rawFiles] : [];
        resolve({
          tempFilePaths: paths,
          tempFiles: filesArr.map((f) => {
            const file = f as { path?: string; size?: number; type?: string };
            return {
              path: file.path ?? '',
              size: file.size ?? 0,
              type: file.type,
            };
          }),
        });
      },
      fail: (err) => reject(new Error(err.errMsg ?? 'chooseImage failed')),
    });
  });
}

/**
 * 获取图片元信息（宽高、类型）
 *
 * @param src 图片路径（本地临时路径或网络 URL）
 */
export function getImageInfo(src: string): Promise<{
  width: number;
  height: number;
  type?: string;
  size?: number;
}> {
  return new Promise((resolve, reject) => {
    uni.getImageInfo({
      src,
      success: (res) => {
        resolve({
          width: res.width,
          height: res.height,
          type: res.type,
        });
      },
      fail: (err) => reject(new Error(err.errMsg ?? 'getImageInfo failed')),
    });
  });
}

/**
 * 把 Canvas 内容导出为临时文件路径
 *
 * @param canvasId canvas 元素 id
 * @param opts fileType: 'jpg' | 'png'；quality: 0-1（jpg 有效）
 * @returns 临时文件路径
 */
export function canvasToTempFilePath(
  canvasId: string,
  opts: { fileType?: 'jpg' | 'png'; quality?: number } = {},
): Promise<string> {
  const fileType = opts.fileType ?? 'png';
  const quality = opts.quality ?? 1;
  return new Promise((resolve, reject) => {
    uni.canvasToTempFilePath({
      canvasId,
      fileType,
      quality,
      success: (res) => resolve(res.tempFilePath),
      fail: (err) => reject(new Error(err.errMsg ?? 'canvasToTempFilePath failed')),
    });
  });
}

/**
 * 保存图片到相册
 *
 * 抖音 Android 仅支持 image/jpeg|webp|png|bmp|gif；
 * 微信无此限制。
 */
export async function saveImageToAlbum(tempFilePath: string): Promise<void> {
  // 先动态申请权限（部分平台不申请会直接失败）
  await ensureAlbumPermission();
  return new Promise((resolve, reject) => {
    uni.saveImageToPhotosAlbum({
      filePath: tempFilePath,
      success: () => resolve(),
      fail: (err) => reject(new Error(err.errMsg ?? 'saveImageToPhotosAlbum failed')),
    });
  });
}

/** 动态申请相册写入权限 */
async function ensureAlbumPermission(): Promise<void> {
  // #ifdef MP-WEIXIN
  // 微信：通过 wx.authorize 主动申请；用户拒绝后需引导到设置页
  // 此处简化为：由 saveImageToPhotosAlbum 触发系统弹窗
  // #endif
}
