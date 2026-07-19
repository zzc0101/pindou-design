# 微信 / 抖音 小程序差异备忘

> 本文档汇总 `src/platforms/` 适配层涉及的平台差异。
> 维护者：每发现一个新差异，先尝试封装到 `platforms/`，再记入本文档。

## 1. 基础信息

| 项 | 微信小程序 | 抖音小程序 |
|----|-----------|-----------|
| appid 字段 | `mp-weixin.appid` | `mp-toutiao.appid` |
| 全局对象 | `wx` | `tt` |
| 跨端兼容层 | `uni.*` | `uni.*` |
| 主包上限 | 2 MB | **2 MB** |
| 总体积上限 | 20 MB | **16 MB**（更紧） |
| 基础库版本（2026.06） | 3.x | 1.78+ |

## 2. Canvas 2D 差异

| 项 | 微信 | 抖音 | 应对 |
|----|------|------|------|
| `<canvas type="2d">` | 2.7.0+ | 1.78+ | 用 `#ifdef` 探测 |
| `wx.createOffscreenCanvas({type:'2d',w,h})` | ✅ | `tt.createOffscreenCanvas(w,h)` | 适配层封装 |
| 同时激活 worker 数量 | 多 | **单** | 串行任务队列 |
| `ctx.clip` / `lineDashOffset` | ✅ | ❌ | 不用 |
| `ctx.isPointInPath` / `isPointInStroke` | ✅ | ❌ | 不用 |
| 旧版 `wx.createCanvasContext` | ✅ | ✅ | **MVP 主用（跨端稳定）** |

## 3. 图像处理 API

| API | 微信 | 抖音 | 差异 |
|-----|------|------|------|
| `uni.chooseImage` | ✅ | ✅ | 一致（`sourceType: ['album','camera']`） |
| `uni.getImageInfo` | ✅ | ✅ | 一致 |
| `uni.canvasGetImageData` | 异步 | 异步 | 输出结构一致（`Uint8ClampedArray` RGBA） |
| `uni.canvasToTempFilePath` | ✅ | ✅ | 抖音开放数据域下禁用 |
| `uni.saveImageToPhotosAlbum` | ✅ | ✅ | 抖音 Android 仅 `jpeg\|webp\|png\|bmp\|gif` |
| `wx.drawImage` 临时路径 | ✅ | ✅ | **无需先 readFile 转 base64**（WebFetch 误报） |

## 4. 已知 BUG 与限制

### 抖音
1. **单 Worker**：同时只能激活一个 OffscreenCanvas Worker，超出会覆盖前一个
2. **开放数据域**：主域所有 canvas 不可 `toDataURL` / `toTempFilePath`
3. **`disable-scroll` / `@longtap` / `@error`**：canvas 元素不支持
4. **Canvas 像素硬上限**：官方文档未明文，实测 4096×4096 是安全阈值
5. **保存相册错误码**：Android 错误码 112089/112090/112002/112079/112080/112099/112001/112003/112093

### 微信
1. **Canvas 是原生组件**：禁止嵌套 `scroll-view` / `swiper` / `picker-view` / `movable-view`
2. **canvas 像素硬上限**：官方文档未明文披露

## 5. 包大小限制

| 平台 | 单包 | 总体 | 校验脚本 |
|------|------|------|---------|
| 微信 | ≤ 2 MB | ≤ 20 MB | `scripts/check-pkg-size.mjs` |
| 抖音 | ≤ 2 MB | ≤ 16 MB（更紧） | 同上 |

**实际目标**：主包 ≤ 1.8 MB，留 200 KB buffer。

## 6. 条件编译语法

```vue
<script setup lang="ts">
// #ifdef MP-WEIXIN
const appName = '微信小程序';
// #endif
// #ifdef MP-TOUTIAO
const appName = '抖音小程序';
// #endif
</script>
```

业务代码优先用 `uni.*`（跨端一致），只在平台差异处用 `#ifdef`。

## 7. 调试工具

| 工具 | 微信 | 抖音 |
|------|------|------|
| IDE | 微信开发者工具 | 抖音开发者工具 |
| 真机调试 | 扫码预览 | 扫码预览 |
| 性能分析 | 微信开发者工具 → Trace | 抖音开发者工具 → 性能 |

## 8. 上线审核

| 平台 | 类目 | 资质 |
|------|------|------|
| 微信 | 工具 → 图片处理 | 通常无需特殊资质 |
| 抖音 | 工具 → 实用工具 | 通常无需特殊资质 |
| 两者都要 | - | 内容安全（用户上传图片需审核） |
