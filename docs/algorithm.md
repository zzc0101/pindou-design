# 算法说明

> 本文档描述 `src/core/` 下算法引擎的设计原理与实现细节。
> 适用读者：维护者、性能调优者、想深入理解颜色量化原理的开发者。

## 整体流程

```
原图 ImageData（W × H 像素，RGBA）
   │
   ├─→ [可选] resizeImage    ── 大图压缩（> 2048 自动）
   │
   ├─→ downsampleToGrid      ── 格内桶排序 Dominant Color
   │   (W × H) → (gridW × gridH)
   │
   ├─→ quantize              ── Lab 最近邻匹配
   │   每像素 → 色卡下标
   │
   └─→ buildBeadGrid         ── 构造 BeadGrid + 统计
```

总耗时（M3 普通手机，289 色 MARD）：1000×1000 → 50×50 ≈ 500ms。

---

## 1. sRGB → CIE Lab 转换

### 为什么要用 Lab？

| 色彩空间 | 感知均匀性 | 色差距离与"人眼感受"的相关性 |
|---------|-----------|----------------------------|
| sRGB    | ❌ 设备相关、非线性 | 差（ΔRGB=30 的两个色差可能人眼看完全不一样） |
| Lab     | ✅ CIE 1931 标准 | 强（ΔE=1 ≈ 最小可觉差 JND） |
| Oklab   | ✅✅ 2020 年新标准 | 极强（Lab 的现代替代品） |

我们用 **CIE Lab (D65)**，因为：
- 工业标准（CIEDE2000 在 Lab 空间定义）
- 工具链成熟（rgbToLab ~ 50 行）
- 与 Oklab 兼容性可后续切换

### 转换链路

```
sRGB (0-255)
  │
  ├─→ gamma 反校正（sRGB → linear RGB）
  │     v = c/255 ≤ 0.04045 ? v/12.92 : ((v+0.055)/1.055)^2.4
  │
  ├─→ linear RGB → XYZ（D65 白点，IEC 61966-2-1 矩阵）
  │     X = 0.4124 R + 0.3576 G + 0.1804 B
  │     Y = 0.2127 R + 0.7152 G + 0.0722 B
  │     Z = 0.0193 R + 0.1192 G + 0.9503 B
  │
  └─→ XYZ → Lab
        L = 116 f(Y/Yn) - 16
        a = 500 (f(X/Xn) - f(Y/Yn))
        b = 200 (f(Y/Yn) - f(Z/Zn))
        f(t) = t > δ³ ? t^(1/3) : t/(3δ²) + 4/29,  δ = 6/29
```

参考：[CIE 1931](https://en.wikipedia.org/wiki/CIE_1931_color_space) + [sRGB 转换公式](https://en.wikipedia.org/wiki/SRGB)。

### 文件
- `src/core/color/rgb-to-lab.ts`
- 测试：`tests/core/rgb-to-lab.test.ts`（9 用例）

---

## 2. CIEDE2000 色差公式

### 为什么用 CIEDE2000 而非欧氏距离？

Lab 空间内的欧氏距离仍然不完美：
- 蓝色区域的视觉感知非线性（蓝光区域人眼更敏感）
- 色调角度在环形空间，欧氏距离在环形两端会"低估"

CIEDE2000（Sharma, Wu, Dalal 2005）修正：
1. **a' 轴校正**：`a' = a × (1 + G)`，其中 G 由 C̄ 推导出，补偿高饱和度区域的拉伸
2. **h̄ 色调环形平均**：跨越 360°→0° 跳变时取 (h1+h2+360)/2
3. **T 色调权重**：与色调相关的色差加权（蓝色区域权重更大）
4. **R_T 旋转项**：在高彩度蓝色区域旋转色差椭圆，修正感知

### 实现要点

```typescript
const G = 0.5 * (1 - sqrt(C̄^7 / (C̄^7 + 25^7)));  // a' 校正
const T = 1 - 0.17 cos(h̄-30) + 0.24 cos(2h̄)
           + 0.32 cos(3h̄+6) - 0.20 cos(4h̄-63);   // 色调权重
const R_T = -sin(2Δθ) × R_C;                       // 旋转项
const ΔE² = (ΔL'/S_L)² + (ΔC'/S_C)² + (ΔH'/S_H)²
            + R_T × (ΔC'/S_C) × (ΔH'/S_H);          // 含交叉项
```

参考：[Sharma 2005 论文](https://www.researchgate.net/publication/222686900_The_CIEDE2000_Color-Difference_Formula_Implementation_notes_complementary_test_data_and_mathematical_observations)。

### 文件
- `src/core/color/delta-e.ts`
- 测试：`tests/core/delta-e.test.ts`（5 用例，含对称性、黑白 ΔE ≈ 100）

---

## 3. 桶排序 Dominant Color 降采样

### 为什么不用"区域均值"？

**问题**：5×5 像素的格子，14 红 + 11 蓝，区域均值 = 紫红色。
**结果**：原图清晰的红蓝边界被"糊"成紫色，丢失边缘信息。

**解决方案**：每格内桶排序取**出现频率最高的颜色**（Dominant Color）。

### 算法步骤

```
for 每格 (gx, gy) in gridW × gridH:
  1) 计算源图覆盖范围 [x0, x1) × [y0, y1)
  2) 桶排序格内像素：
     key = (R>>3)<<10 | (G>>3)<<5 | (B>>3)   // 5-bit/通道
     buckets[key]++
     跳过 alpha < 128 的像素
  3) 找 max(buckets) → bestKey
  4) 输出 bestKey 对应的 RGB + opacity
```

### 关键设计

| 决策 | 原因 |
|------|------|
| 5-bit/通道（32³ = 32768 桶） | 抗噪（不严格按 RGB 相等归类）+ 内存友好（128KB Uint32Array） |
| 平局取 firstKey | 确定性（避免不同平台差异） |
| **opacity 用 totalOpaque，不是 bestCount** | 随机噪声图 bestCount=1 → opacity=16 被误判为半透明 |
| 跳过 alpha < 128 | 透明背景不污染主体 |

### 性能

500×500 → 50×50 在 M3 上 ≈ 50ms。

### 文件
- `src/core/downsample.ts`
- 测试：`tests/core/downsample.test.ts`（5 用例）

---

## 4. 颜色量化（Lab 最近邻匹配）

### 算法

```
for 每像素 in downsample 输出:
  if alpha < 128:
    cells[i] = EMPTY_CELL (0xFFFF)
  else:
    lab = rgbToLab(R, G, B)
    cells[i] = paletteIndex.find(lab)   // CIEDE2000 找最近色
```

### EMPTY_CELL sentinel

- 透明格用 `0xFFFF`（UINT16_MAX），不与任何色卡下标冲突
- 当前色卡最大 289 色，远不到 UINT16_MAX

### 性能优化空间

- 138/289 色规模：线性扫描 ~ 300 次 ΔE2000/像素 = O(N×M)，1ms/像素
- 1000+ 色规模：可考虑 KD-Tree 或 VP-Tree（V2 优化）

### ⚠️ 历史 bug 复盘

**第一版 nearest-color 有 bug**：

```typescript
// ❌ 错误：用 Lab 欧氏距离作为预筛
if (fastDist >= bestDist) continue;
// 欧氏距离 ≥ CIEDE2000，但预筛在 bestDist 更新为 ΔE2000 后，
// 仍用 fastDist 比较 → 跳过真正更近的色

// ✅ 修复：去掉预筛
for (let i = 0; i < entryCount; i++) {
  const dist = deltaE2000(lab, labs[i]);  // 直接算
  if (dist < bestDist) { bestDist = dist; bestIdx = i; }
}
```

**症状**：纯红 RGB(255,0,0) 被错误映射到 A1 浅粉红而非 A2 纯红。
**修复测试**：`tests/core/mard-palette-integration.test.ts` 多色分区测试发现。

### 文件
- `src/core/color/nearest-color.ts`
- `src/core/color-quantize.ts`
- 测试：`tests/core/nearest-color.test.ts`（8 用例）

---

## 5. Canvas 渲染优化（同色行扫描合并）

### 为什么需要？

100×100 = 10,000 格，每格 `ctx.fillRect` 一次 → 10,000 次 fillRect。
在低端机上单次 fillRect ~0.1ms → 1 秒绘制，UI 卡顿。

### 算法

```
for 每行 y:
  runStart = -1, runColor = ''
  for x = 0 to gridW (含边界):
    curColor = grid[y][x] 的 hex（透明则 ''）
    if curColor !== runColor:
      // 提交 run
      ctx.fillRect(runStart*cs, y*cs, (x-runStart)*cs, cs, runColor)
      runStart = x
      runColor = curColor
```

### 效果

| 场景 | 朴素 fillRect | 合并后 | 节省 |
|------|--------------|--------|------|
| 100×100 全同色 | 10,000 | 100 | 99% |
| 100×100 渐变 30 色 | 10,000 | ~3,000 | 70% |
| 100×100 噪声 100 色 | 10,000 | ~5,000 | 50% |

### 文件
- `src/core/bead-renderer.ts`
- 测试：`tests/core/bead-renderer.test.ts`（11 用例）

---

## 6. 纯 JS 图像缩放

### 为什么不用 canvas resize？

小程序 canvas API 在不同基础库的 resize 行为不一致；且 Vitest 环境无 canvas。
**纯 JS Box Filter**：
- 无依赖
- Node/Vitest 可跑
- 4000×3000 → 2048×1536 ≈ 80ms（M3）

### Box Filter 算法

每目标像素 = 源像素覆盖区域均值：

```
for dy in 0..targetH:
  y0 = floor(dy * srcH / targetH)
  y1 = floor((dy+1) * srcH / targetH)
  for dx in 0..targetW:
    x0 = floor(dx * srcW / targetW)
    x1 = floor((dx+1) * srcW / targetW)
    // (x0..x1) × (y0..y1) 区域的均值
```

### 文件
- `src/utils/image-resize.ts`
- 测试：`tests/core/image-resize.test.ts`（10 用例）

---

## 性能基线（Vitest 实测，Mac M-series）

| 输入 | 输出 | 耗时 | 是否满足基线 |
|------|------|------|-------------|
| 500×500 | 50×50 | ~330ms | ✅ |
| 1000×1000 | 50×50 | ~500ms | ✅ < 800ms |
| 1000×1000 | 80×80 | ~600ms | ✅ |
| 2048×2048 | 100×100 | ~1000ms | ✅ < 1.5s |
| 4000×3000 → 2048 | 80×60 | ~540ms | ✅ < 3s |

> 注：CI 环境机器负载浮动大，基线为普通手机预估（M3）。

---

## 已知限制与未来优化

### 限制
- 138/289 色规模：O(N×M) 线性扫描足够；1000+ 色需 KD-Tree
- 大图（> 5000×5000）：需要 OffscreenCanvas Worker（MVP 输入限制 2048）

### 未来优化（V2+）
- **抖动算法**（dithering）：降低色阶断层感
- **背景移除**：flood fill 4 邻域 + 用户点击种子点
- **透明感视觉补偿**：豆子中心亮、边缘暗的渲染（差异化亮点）
- **KD-Tree 量化**：1000+ 色卡时启用

---

## 参考文献

1. Sharma G, Wu W, Dalal EN. **The CIEDE2000 color-difference formula**. 2005.
2. IEC 61966-2-1:1999. **sRGB standard**.
3. CIE 015:2018. **Colorimetry, 4th Edition**.
4. Björn Ottosson. **A perceptual color space for image processing** (Oklab). 2020.
5. zippland/perler-beads. **拼豆图纸生成器微信小程序**. GitHub 开源实现参考。
