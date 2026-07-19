#!/usr/bin/env node
/**
 * 色卡数据生成脚本（多品牌版）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 数据源：zippland/perler-beads 的 colorSystemMapping.json
 * 下载地址（任选其一）：
 *   1. GitHub raw：https://raw.githubusercontent.com/zippland/perler-beads/master/src/app/colorSystemMapping.json
 *   2. jsDelivr CDN：https://cdn.jsdelivr.net/gh/zippland/perler-beads@master/src/app/colorSystemMapping.json
 *
 * 使用方式：
 *   1) 把下载的 JSON 重命名为 colorSystemMapping.json
 *   2) 放到 src/data/palettes/_raw/colorSystemMapping.json
 *   3) 运行 `npm run fetch:palettes`
 *   4) 脚本自动为每个品牌生成对应 JSON + 计算 Lab
 *
 * 支持品牌（基于源数据字段）：
 *   - MARD 漫漫（MARD 优先，漫漫 fallback）→ mard.json
 *   - COCO  → coco.json
 *   - 盼盼   → panpan.json
 *   - 咪小窝 → mixiao.json
 *
 * 不支持：
 *   - Perler / Hama（源数据无此字段，需另外数据源）
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const RAW_DIR = join(ROOT, 'src', 'data', 'palettes', '_raw');
const RAW_FILE = join(RAW_DIR, 'colorSystemMapping.json');
const OUT_DIR = join(ROOT, 'src', 'data', 'palettes');

/** 候选下载源（按可用性顺序） */
const CANDIDATE_URLS = [
  'https://raw.githubusercontent.com/zippland/perler-beads/master/src/app/colorSystemMapping.json',
  'https://cdn.jsdelivr.net/gh/zippland/perler-beads@master/src/app/colorSystemMapping.json',
];

/** 品牌定义：brandKeys 是优先级（首个命中即用） */
const BRANDS = [
  { id: 'mard',    name: 'MARD 漫漫拼豆色卡', source: 'mard',    brandKeys: ['漫漫', 'MARD'] },
  { id: 'coco',    name: 'COCO 拼豆色卡',     source: 'coco',    brandKeys: ['COCO'] },
  { id: 'panpan',  name: '盼盼拼豆色卡',      source: 'panpan',  brandKeys: ['盼盼'] },
  { id: 'mixiao',  name: '咪小窝拼豆色卡',    source: 'mixiao',  brandKeys: ['咪小窝'] },
];

/** 从 URL 下载（自动跟随重定向，超时 30s） */
function downloadJson(url, redirects = 0) {
  return new Promise((resolvePromise, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const req = https.get(url, { timeout: 30_000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolvePromise(downloadJson(res.headers.location, redirects + 1));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          resolvePromise(JSON.parse(text));
        } catch (e) {
          reject(new Error(`Invalid JSON from ${url}: ${e.message}`));
        }
      });
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`Timeout after 30s: ${url}`)));
    req.on('error', reject);
  });
}

/** 加载原始 JSON：本地优先，下载兜底 */
async function loadRaw() {
  if (existsSync(RAW_FILE)) {
    console.log(`✓ 读取本地 ${RAW_FILE}`);
    return JSON.parse(readFileSync(RAW_FILE, 'utf8'));
  }
  console.log('本地不存在 _raw/colorSystemMapping.json，尝试下载...');
  for (const url of CANDIDATE_URLS) {
    try {
      console.log(`  - ${url}`);
      const json = await downloadJson(url);
      mkdirSync(RAW_DIR, { recursive: true });
      writeFileSync(RAW_FILE, JSON.stringify(json, null, 2));
      console.log(`  ✓ 下载成功，已存到 ${RAW_FILE}`);
      return json;
    } catch (e) {
      console.log(`  ✗ ${e.message}`);
    }
  }
  throw new Error(
    '所有下载源失败。请手动下载 colorSystemMapping.json 并放到 src/data/palettes/_raw/ 目录',
  );
}

/** sRGB → linear → XYZ (D65) → Lab（与 src/core/color/rgb-to-lab.ts 保持一致） */
function rgbToLab(r, g, b) {
  const srgbToLinear = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
  const z = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041;
  const D65 = [0.95047, 1.0, 1.08883];
  const labF = (t) => {
    const delta = 6 / 29;
    return t > Math.pow(delta, 3) ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29;
  };
  const fx = labF(x / D65[0]);
  const fy = labF(y / D65[1]);
  const fz = labF(z / D65[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function hexToRgb(hex) {
  const s = hex.replace(/^#/, '');
  return [
    parseInt(s.substring(0, 2), 16),
    parseInt(s.substring(2, 4), 16),
    parseInt(s.substring(4, 6), 16),
  ];
}

/**
 * 从原始 JSON 中按品牌筛选色号
 *
 * @param raw 原始 JSON
 * @param brandKeys 优先级品牌 key 列表（如 ['漫漫', 'MARD']）
 * @returns { entries, hits, fallback }
 */
function pickEntriesByBrand(raw, brandKeys) {
  const entries = [];
  let hits = 0;
  let fallback = 0;

  for (const [hex, mapping] of Object.entries(raw)) {
    if (!mapping || typeof mapping !== 'object') continue;
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) continue;

    // 按优先级查找首个有效色号
    let code = null;
    for (const key of brandKeys) {
      const v = mapping[key];
      if (typeof v === 'string' && v.trim() !== '' && v.trim() !== '-') {
        code = v.trim();
        if (key === brandKeys[0]) hits++;
        else fallback++;
        break;
      }
    }
    if (!code) continue;
    entries.push({ code, hex });
  }

  // 按 code 去重（保留首条）
  const seen = new Set();
  const deduped = entries.filter((e) => {
    if (seen.has(e.code)) return false;
    seen.add(e.code);
    return true;
  });

  // 按色号排序
  deduped.sort((a, b) => a.code.localeCompare(b.code, 'zh-Hans-CN', { numeric: true }));
  return { entries: deduped, hits, fallback };
}

/** 构造 Palette 对象（含 Lab） */
function buildPalette(brand, rawEntries) {
  return {
    id: brand.id,
    name: brand.name,
    source: brand.source,
    entries: rawEntries.map(({ code, hex }) => {
      const [r, g, b] = hexToRgb(hex);
      const [L, a, bb] = rgbToLab(r, g, b);
      return {
        code,
        hex: hex.toUpperCase(),
        lab: [Number(L.toFixed(2)), Number(a.toFixed(2)), Number(bb.toFixed(2))],
      };
    }),
  };
}

/** 主流程 */
async function main() {
  console.log('--- 拼豆色卡生成器（多品牌）---\n');
  const raw = await loadRaw();

  mkdirSync(OUT_DIR, { recursive: true });

  // 1) 国产品牌：从开源源数据提取
  for (const brand of BRANDS) {
    const { entries, hits, fallback } = pickEntriesByBrand(raw, brand.brandKeys);
    if (entries.length === 0) {
      console.log(`⚠ ${brand.id}: 源数据无此品牌字段（${brand.brandKeys.join('/')}），跳过`);
      continue;
    }
    const palette = buildPalette(brand, entries);
    const outFile = join(OUT_DIR, `${brand.id}.json`);
    writeFileSync(outFile, JSON.stringify(palette, null, 2) + '\n', 'utf8');
    console.log(`✓ ${outFile}`);
    console.log(`  ${palette.entries.length} 色（首字段 ${brand.brandKeys[0]} 命中 ${hits}, fallback ${fallback}）`);
    if (palette.entries.length > 0) {
      const e = palette.entries[0];
      console.log(`  示例: ${e.code}  ${e.hex}  Lab=(${e.lab.join(', ')})`);
    }
  }

  // 2) 国际品牌：Perler / Hama（手工整理数据）
  await generateInternationalPalettes();

  console.log('\n--- 完成 ---');
}

/** 生成 Perler / Hama 色板（从手工整理的 TS 数据） */
async function generateInternationalPalettes() {
  const sources = [
    {
      id: 'perler',
      name: 'Perler 拼豆色卡',
      source: 'custom', // 标记为 custom 但实际是国际品牌
      module: await import('../src/data/palettes/_raw/perler-source.ts'),
    },
    {
      id: 'hama',
      name: 'Hama 拼豆色卡',
      source: 'custom',
      module: await import('../src/data/palettes/_raw/hama-source.ts'),
    },
  ];

  for (const s of sources) {
    const entries = s.module[`${s.id.toUpperCase()}_ENTRIES`];
    if (!entries) {
      console.log(`⚠ ${s.id}: 源数据缺失`);
      continue;
    }
    const palette = {
      id: s.id,
      name: s.name,
      source: s.source,
      entries: entries.map((e) => {
        const hex = e.hex.toUpperCase();
        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);
        const [L, A, B] = rgbToLab(r, g, b);
        return {
          code: e.code,
          name: e.name,
          hex,
          lab: [Number(L.toFixed(2)), Number(A.toFixed(2)), Number(B.toFixed(2))],
        };
      }),
    };
    const outFile = join(OUT_DIR, `${s.id}.json`);
    writeFileSync(outFile, JSON.stringify(palette, null, 2) + '\n', 'utf8');
    console.log(`✓ ${outFile}`);
    console.log(`  ${palette.entries.length} 色（国际品牌手工数据）`);
    if (palette.entries.length > 0) {
      const e = palette.entries[0];
      console.log(`  示例: ${e.code} ${e.name}  ${e.hex}  Lab=(${e.lab.join(', ')})`);
    }
  }
}

main().catch((e) => {
  console.error('\n✗ 失败:', e.message);
  process.exit(1);
});
