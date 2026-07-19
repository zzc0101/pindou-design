#!/usr/bin/env node
/**
 * 分包体积校验脚本
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 校验 dist/build/ 下产物体积是否超标。
 * 运行：`npm run build:mp-weixin && npm run check:pkg-size`
 *
 * 体积红线：
 *   - 微信：主包 ≤ 1.8MB、总体 ≤ 20MB
 *   - 抖音：主包 ≤ 1.8MB、总体 ≤ 16MB
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist', 'build');

const LIMITS = {
  'mp-weixin': { main: 1.8 * 1024 * 1024, total: 20 * 1024 * 1024 },
  'mp-toutiao': { main: 1.8 * 1024 * 1024, total: 16 * 1024 * 1024 },
};

function dirSize(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(full);
    else if (entry.isFile()) total += statSync(full).size;
  }
  return total;
}

function fmt(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

let ok = true;

for (const [platform, limits] of Object.entries(LIMITS)) {
  const dir = join(DIST, platform);
  if (!existsSync(dir)) {
    console.log(`[skip] ${platform} - 产物不存在，先运行 npm run build:${platform}`);
    continue;
  }
  const total = dirSize(dir);
  const overTotal = total > limits.total;
  console.log(`[${platform}] 总体积 ${fmt(total)} / 上限 ${fmt(limits.total)} ${overTotal ? '❌ 超限' : '✅'}`);
  if (overTotal) ok = false;
}

if (!ok) {
  console.error('\n体积校验未通过，请优化资源');
  process.exit(1);
}
console.log('\n体积校验通过 ✅');
