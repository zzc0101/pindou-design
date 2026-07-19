# 拼豆图纸生成器（pindou）

图片转拼豆图纸小程序，**一套代码同时发布到微信小程序和抖音小程序**。

> 拼豆（Perler Beads / Fuse Beads）是一种像素风手工艺术。本工具把任意图片转为带色号标注的拼豆图纸（PDF/PNG 导出），让你按图施工即可。

## ✨ 特性

- 🎨 **289 色 MARD 漫漫色板**：覆盖国产主流拼豆
- 🔬 **专业算法**：CIE Lab 色彩空间 + CIEDE2000 色差 + 桶排序 Dominant Color 降采样
- 📐 **20-100 网格可调**：从钥匙扣到大作品
- 📱 **双端发布**：uni-app Vue 3 + Vite + TS，一套代码 → 微信小程序 + 抖音小程序
- 🧪 **高测试覆盖**：74 个单元 + 集成 + 性能测试，core/ 覆盖率 95%+

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18（推荐 20）
- npm 9+
- （可选）HBuilderX 用于真机调试

### 安装

```bash
npm install
```

### 开发命令

```bash
# 微信小程序 dev（带 sourcemap）
npm run dev:mp-weixin

# 抖音小程序 dev
npm run dev:mp-toutiao

# 单元测试
npm test

# 单元测试 + 覆盖率
npm run test:cov

# 生成 MARD 色卡（首次运行，或更新色板数据时）
npm run fetch:palettes

# TypeScript 严格模式检查
npm run type-check
```

### 构建命令

```bash
# 微信小程序 build
npm run build:mp-weixin

# 抖音小程序 build
npm run build:mp-toutiao

# 体积校验（需先 build）
npm run check:pkg-size
```

### 真机调试

1. 下载 [HBuilderX](https://www.dcloud.io/hbuilderx.html)（可选，推荐）
2. **或**直接用各平台开发者工具：
   - [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
   - [抖音开发者工具](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/developer-instrument/download/developer-instrument-update-and-download)

## 📱 平台 appid 配置

打开 `src/manifest.json`：

```json
{
  "mp-weixin": {
    "appid": "wx_YOUR_APPID_HERE"   // 替换为你的微信 appid
  },
  "mp-toutiao": {
    "appid": "ttYOUR_APPID_HERE"   // 替换为你的抖音 appid
  }
}
```

未填 appid 也能 build，但无法在开发者工具中预览真机。

## 📐 体积限制

| 平台 | 主包上限 | 总体积上限 | 实际目标 |
|------|---------|-----------|---------|
| 微信 | 2 MB | 20 MB | 主包 ≤ 1.8 MB |
| 抖音 | 2 MB | **16 MB**（更紧） | 主包 ≤ 1.8 MB |

CI 自动校验：`npm run build:mp-weixin && npm run check:pkg-size`。

## 🧩 项目结构

```
pindou/
├── src/
│   ├── core/                # ⭐ 算法引擎（97% 测试覆盖）
│   │   ├── color/           # sRGB↔Lab + CIEDE2000 + 最近邻
│   │   ├── downsample.ts    # 桶排序 Dominant Color 降采样
│   │   ├── color-quantize.ts
│   │   ├── grid-builder.ts
│   │   ├── image-to-beads.ts# 主流程
│   │   └── bead-renderer.ts # 同色行合并的渲染指令
│   ├── utils/               # 平台/图像/日志工具
│   ├── data/palettes/       # MARD 漫漫色板（289 色）
│   ├── types/               # Bead / Palette / ImageData
│   ├── stores/              # Pinia (settings/palette/generator)
│   ├── platforms/           # 微信/抖音差异适配层
│   ├── components/          # 6 个自研组件
│   ├── pages/
│   │   ├── index/           # 单页一站式生成器
│   │   └── result/          # 高清图 + 导出 + 颜色用量
│   └── styles/              # 设计 token
├── tests/
│   ├── core/                # 11 个测试文件
│   ├── integration/         # 端到端集成
│   └── performance/         # 性能基准
├── scripts/
│   ├── fetch-palettes.mjs   # 本地优先 + 计算 Lab
│   └── check-pkg-size.mjs   # 体积红线校验
├── docs/
│   ├── algorithm.md         # 算法说明（详细）
│   └── platform-differences.md # 微信/抖音差异
├── .github/workflows/ci.yml # GitHub Actions
└── README.md
```

## 🎯 核心流程

```
图片上传 → 网格尺寸调整 → 实时预览 → 高清图纸 → 导出 / 保存
   ↓            ↓             ↓          ↓
chooseImage  20-100       BeadCanvas   result.vue
             滑块         缩放 0.5-2×   PNG/JPG
```

详细算法：[docs/algorithm.md](docs/algorithm.md)

## 🧪 测试

```bash
# 单元测试（74 个用例）
npm test

# 覆盖率（≥ 90% 行覆盖）
npm run test:cov

# 性能基准（Vitest 环境，CI 浮动较大）
npm run test:cov  # 包含 tests/performance/
```

当前状态：
- **74/74 测试通过**
- **TypeScript 严格模式 0 错误**
- **`core/` 覆盖率 95.36%**（`core/color/` 100%）

## 🎨 色卡数据

来源：`zippland/perler-beads` 开源 `colorSystemMapping.json`（291 标准 hex），人工筛选 + 去重 + 计算 Lab 后得 **289 色 MARD 漫漫子集**。

### 更新色卡

1. 替换 `src/data/palettes/_raw/colorSystemMapping.json`
2. 跑 `npm run fetch:palettes`
3. 跑 `npm test` 验证

## ⚠️ 已知限制（MVP）

- **拍照上传**：不支持，仅相册
- **背景移除**：不支持，假设主体居中
- **PDF 导出**：不支持（小程序无 PDF API）
- **登录/账号/云保存**：不支持，纯本地
- **色卡切换**：仅 MARD（V2 加 Perler/Hama）

详细见 [docs/algorithm.md §已知限制](docs/algorithm.md#已知限制与未来优化)。

## 📜 编码规范

- 4 空格缩进，单行 ≤ 120 字符
- 类名 `UpperCamelCase`，方法/变量 `lowerCamelCase`，常量 `UPPER_SNAKE_CASE`
- 每个公共函数必须有 JSDoc 注释（功能 / 入参 / 响应）
- 核心代码必须有行内步骤注释
- 禁用 `console.log`（用 `utils/logger.ts`）
- 适配层（`platforms/`）是唯一允许 `#ifdef` 的目录

## 📦 CI/CD

GitHub Actions 自动跑：

1. `npm ci`
2. `npm run type-check`
3. `npm run test:cov`（含性能基准）
4. `npm run build:mp-weixin && npm run build:mp-toutiao`
5. `npm run check:pkg-size`

## 📄 License

MIT

## 🙏 致谢

- [zippland/perler-beads](https://github.com/zippland/perler-beads) — 色卡数据来源与设计灵感
- [uni-app](https://uniapp.dcloud.net.cn/) — 跨端框架
- [Vitest](https://vitest.dev/) — 测试框架

# pindou-design
