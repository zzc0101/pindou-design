/**
 * 权限适配层
 *
 * @author zhuzc
 * @date 2026-06-22
 */

export type PermissionStatus = 'granted' | 'denied' | 'not-determined';

/**
 * 申请相册写入权限
 *
 * 微信：uni.authorize({ scope: 'scope.writePhotosAlbum' })
 * 抖音：基础库 1.78+ 起，需用 uni.authorize 或 tt.authorize
 */
export async function requestAlbumWritePermission(): Promise<PermissionStatus> {
  return new Promise((resolve) => {
    uni.authorize({
      scope: 'scope.writePhotosAlbum',
      success: () => resolve('granted'),
      fail: () => resolve('denied'),
    });
  });
}

/**
 * 申请相机权限（V2 拍照上传时使用）
 */
export async function requestCameraPermission(): Promise<PermissionStatus> {
  return new Promise((resolve) => {
    uni.authorize({
      scope: 'scope.camera',
      success: () => resolve('granted'),
      fail: () => resolve('denied'),
    });
  });
}
