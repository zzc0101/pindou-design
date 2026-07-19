import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';
import { fileURLToPath } from 'node:url';

/**
 * Vite 配置
 *
 * - uni 跨端插件
 * - SCSS 全局变量自动注入（每个 <style lang="scss"> 顶部自动 prepend variables.scss）
 *
 * @author zhuzc
 * @date 2026-06-22
 */

export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`,
        // 关闭 Sass 3.0 警告噪音（Dart Sass 暂未到 3.0）
        silenceDeprecations: ['legacy-js-api', 'import'],
      },
    },
  },
});
