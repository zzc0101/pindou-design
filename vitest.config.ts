import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Vitest 配置
 *
 * - 启用全局 API（describe/it/expect），无需 import
 * - Node 环境（不模拟浏览器）
 * - 测试包含 src/ 与 tests/，但排除 uni-app 平台特定文件
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/**/index.ts', 'src/core/**/*.d.ts'],
      thresholds: {
        lines: 70,
        functions: 80,
        branches: 70,
        statements: 70,
      },
    },
  },
});
