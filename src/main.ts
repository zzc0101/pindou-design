/**
 * uni-app 入口
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 接入 Pinia（持久化插件）
 */

import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { i18n } from './i18n';

export function createApp() {
  const app = createSSRApp(App);
  app.use(createPinia());
  app.use(i18n);
  return { app };
}
