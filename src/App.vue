<script setup lang="ts">
/**
 * 应用根组件
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 仅做生命周期日志与全局样式导入，业务逻辑放在 pages/ 与 stores/。
 */

// 微信/抖音全局对象声明（uni-app 条件编译生效时才存在）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const wx: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const tt: any;

import { onLaunch, onShow, onHide } from '@dcloudio/uni-app';
import { logger } from '@/utils/logger';
import { initErrorReporter } from '@/utils/error-reporter';
import { useSettingsStore } from '@/stores/settings';
import { setLocale } from './i18n';

const settings = useSettingsStore();

/** 应用主题到根元素 */
function applyTheme(): void {
  // 真机运行时 wx.getSystemInfoSync / tt.getSystemInfoSync
  let resolved: 'light' | 'dark' = 'light';
  if (settings.theme === 'auto') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sys = typeof wx !== 'undefined'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (wx as any).getSystemInfoSync?.()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : typeof tt !== 'undefined' ? (tt as any).getSystemInfoSync?.() : null;
      resolved = sys?.theme === 'dark' ? 'dark' : 'light';
    } catch {
      resolved = 'light';
    }
  } else {
    resolved = settings.theme;
  }
  // 通过设置 body data-theme 触发 CSS 切换
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = typeof document !== 'undefined' ? document : null;
  if (doc?.body) {
    doc.body.dataset.theme = resolved;
  }
  // 小程序端：通过 plus / 设置 navigationBarTextStyle
  // #ifdef MP-WEIXIN
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (wx as any).setNavigationBarColor?.({
      frontColor: resolved === 'dark' ? '#ffffff' : '#000000',
      backgroundColor: resolved === 'dark' ? '#1a1a1a' : '#ffffff',
    });
  } catch {
    // ignore
  }
  // #endif
}

onLaunch(() => {
  logger.info('App launched');
  applyTheme();
  initErrorReporter();
  setLocale(settings.locale);
});

onShow(() => {
  logger.debug('App shown');
  applyTheme();
});

onHide(() => {
  logger.debug('App hidden');
});
</script>

<style lang="scss">
@import '@/styles/variables.scss';
@import '@/styles/reset.scss';
@import '@/styles/common.scss';
</style>
