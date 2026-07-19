<script setup lang="ts">
/**
 * 首页 / 生成器主页
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 单页一站式：上传 → 配置 → 预览 → 跳结果页
 */

import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { onShareAppMessage } from '@dcloudio/uni-app';
import { useSettingsStore } from '@/stores/settings';
import { usePaletteStore } from '@/stores/palette';
import { useGeneratorStore } from '@/stores/generator';
import { chooseImage, getImageInfo, canvasGetImageData } from '@/platforms';
import type { ImageData } from '@/types/image';
import { imageToBeads } from '@/core/image-to-beads';
import { computeResizeSize, resizeImage } from '@/utils/image-resize';
import { logger } from '@/utils/logger';

const settings = useSettingsStore();
const palette = usePaletteStore();
const generator = useGeneratorStore();
const { t } = useI18n();

const sourceCanvasId = 'src-canvas';
const resizeCanvasId = 'resize-canvas';
const MAX_INPUT_EDGE = 2048;
const previewScale = ref(1);

async function onSelect(source: 'album' | 'camera' = 'album'): Promise<void> {
  try {
    const result = await chooseImage({
      count: 1,
      sourceType: source === 'camera' ? ['camera'] : ['album', 'camera'],
    });
    if (result.tempFilePaths.length === 0) return;
    const path = result.tempFilePaths[0];
    const info = await getImageInfo(path);
    const { w, h } = computeResizeSize(info.width, info.height, MAX_INPUT_EDGE);
    generator.setSource(path, {
      width: info.width,
      height: info.height,
      tempFilePath: path,
      size: result.tempFiles[0]?.size,
    });
    if (w !== info.width || h !== info.height) {
      uni.showLoading({ title: `压缩 ${info.width}×${info.height} → ${w}×${h}`, mask: true });
      await new Promise((r) => setTimeout(r, 50));
    }
    scheduleGenerate();
  } catch (e) {
    const msg = (e as Error).message ?? '';
    if (msg.includes('cancel') || msg.includes('auth')) return;
    uni.showToast({ title: '选图失败', icon: 'none' });
    logger.error('chooseImage failed:', e);
  }
}

/**
 * 把源图（可能 > 2048）画到隐藏 canvas 后读像素；
 * 若超过 MAX_INPUT_EDGE，先在 canvas 上缩小。
 */
async function loadImageData(path: string, srcW: number, srcH: number): Promise<{ data: ImageData; processedW: number; processedH: number }> {
  const target = computeResizeSize(srcW, srcH, MAX_INPUT_EDGE);
  if (target.w === srcW && target.h === srcH) {
    // 不需要缩放：直接画到 source-canvas 后读像素
    const ctx = uni.createCanvasContext(sourceCanvasId);
    ctx.drawImage(path, 0, 0, srcW, srcH);
    await new Promise<void>((resolve) => {
      ctx.draw(false, () => resolve());
    });
    const data = await canvasGetImageData(sourceCanvasId, null, 0, 0, srcW, srcH);
    return { data, processedW: srcW, processedH: srcH };
  }

  // 需要缩放：先画原图到 source-canvas 读像素，再用 JS 缩小（避免 canvas 二次绘制精度损失）
  const srcCtx = uni.createCanvasContext(sourceCanvasId);
  srcCtx.drawImage(path, 0, 0, srcW, srcH);
  await new Promise<void>((resolve) => {
    srcCtx.draw(false, () => resolve());
  });
  const raw = await canvasGetImageData(sourceCanvasId, null, 0, 0, srcW, srcH);
  const resized = resizeImage(raw, target.w, target.h);
  return { data: resized, processedW: target.w, processedH: target.h };
}

function onClear(): void {
  generator.reset();
}

/** 草稿箱弹层 */
const showDrafts = ref(false);

function onOpenDrafts(): void {
  showDrafts.value = true;
}
function onCloseDrafts(): void {
  showDrafts.value = false;
}

function onLoadDraftById(id: string): void {
  if (generator.loadDraftById(id)) {
    showDrafts.value = false;
    uni.showToast({ title: '已恢复草稿', icon: 'success' });
    // 触发重新生成（如果有图片源数据）
    if (generator.sourceImagePath) {
      scheduleGenerate();
    }
  } else {
    uni.showToast({ title: '草稿不存在', icon: 'none' });
  }
}

function onDeleteDraftById(event: { stopPropagation?: () => void }, id: string): void {
  if (event?.stopPropagation) event.stopPropagation();
  uni.showModal({
    title: '删除草稿',
    content: '确定删除该草稿？',
    success: (res) => {
      if (res.confirm) generator.deleteDraft(id);
    },
  });
}

function formatTimeShort(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function onGridSizeChange(value: number): void {
  generator.setGridSize(value);
  settings.setDefaultGridSize(value);
  scheduleGenerate();
}

function onToggleDither(e: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (e as any)?.detail?.value ?? false;
  settings.setDitheringEnabled(Boolean(value));
  scheduleGenerate();
}

function onToggleRemoveBg(e: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (e as any)?.detail?.value ?? false;
  settings.setRemoveBackground(Boolean(value));
  scheduleGenerate();
}

function onToggleEnhance(e: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (e as any)?.detail?.value ?? false;
  settings.setImageEnhancement(Boolean(value));
  scheduleGenerate();
}

function onToggleBead3D(e: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (e as any)?.detail?.value ?? false;
  settings.setBead3DEnabled(Boolean(value));
  scheduleGenerate();
}

let generateTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleGenerate(): void {
  if (generateTimer) {
    clearTimeout(generateTimer);
  }
  generateTimer = setTimeout(() => {
    void generate();
  }, 300);
}

async function generate(): Promise<void> {
  if (!generator.sourceImagePath || !generator.sourceMeta) return;
  generator.setProcessing();
  try {
    const { width, height } = generator.sourceMeta;
    const { data: imageData, processedW, processedH } = await loadImageData(
      generator.sourceImagePath,
      width,
      height,
    );
    // 图像增强（可选）—— 提升偏色/模糊图片效果
    let processedImage = imageData;
    if (settings.imageEnhancement) {
      const { enhance, DEFAULT_ENHANCE_OPTIONS } = await import('@/core/image-enhance');
      processedImage = enhance(imageData, {
        ...DEFAULT_ENHANCE_OPTIONS,
        autoWhiteBalance: true,
        autoContrast: true,
        sharpen: 0.3,
      });
    }

    const grid = imageToBeads(processedImage, {
      gridWidth: generator.gridSize,
      gridHeight: generator.gridSize,
      palette: palette.active,
      dithering: settings.ditheringEnabled,
      removeBackground: settings.removeBackground,
    });
    generator.runGeneration(grid);
    uni.hideLoading();
    logger.info(
      `生成完成: ${grid.width}x${grid.height}, 处理 ${processedW}x${processedH}, 使用 ${grid.stats.colorCounts.size} 色`,
    );
  } catch (e) {
    uni.hideLoading();
    generator.setError((e as Error).message);
    uni.showToast({ title: '生成失败，请重试', icon: 'none' });
    logger.error('generate failed:', e);
  }
}

function onGoResult(): void {
  uni.navigateTo({ url: '/pages/result/result' });
}

function onZoomIn(): void {
  previewScale.value = Math.min(2, Number((previewScale.value + 0.2).toFixed(2)));
}
function onZoomOut(): void {
  previewScale.value = Math.max(0.5, Number((previewScale.value - 0.2).toFixed(2)));
}
function onZoomReset(): void {
  previewScale.value = 1;
}

/**
 * 微信好友分享（首页默认分享）
 */
onShareAppMessage(() => {
  return {
    title: t('app.name') + ' - 一键把图片变成拼豆图纸',
    path: '/pages/index/index',
  };
});
</script>

<template>
  <view class="container">
    <view class="header">
      <text class="title">{{ t('app.name') }}</text>
      <text class="subtitle">{{ t('app.tagline') }}</text>
    </view>

    <UploadCard
      :image-path="generator.sourceImagePath"
      :meta="generator.sourceMeta"
      @select="onSelect($event)"
      @clear="onClear"
    />

    <view v-if="generator.drafts.length > 0" class="section">
      <view class="btn-primary drafts-btn" @tap="onOpenDrafts">
        <text>📂 草稿箱（{{ generator.drafts.length }}）</text>
      </view>
    </view>

    <view v-if="generator.sourceImagePath" class="section">
      <GridSizeSlider
        :model-value="generator.gridSize"
        @update:model-value="onGridSizeChange"
      />
    </view>

    <view v-if="generator.sourceImagePath" class="section">
      <view class="dither-row">
        <view class="row-between">
          <view class="col">
            <text class="dither-label">{{ t('index.dither') }}</text>
            <text class="dither-meta">{{ t('index.ditherMeta') }}</text>
          </view>
          <switch
            :checked="settings.ditheringEnabled"
            color="#E60012"
            @change="onToggleDither"
          />
        </view>
        <view class="row-between option-row">
          <view class="col">
            <text class="dither-label">{{ t('index.removeBg') }}</text>
            <text class="dither-meta">{{ t('index.removeBgMeta') }}</text>
          </view>
          <switch
            :checked="settings.removeBackground"
            color="#E60012"
            @change="onToggleRemoveBg"
          />
        </view>
        <view class="row-between option-row">
          <view class="col">
            <text class="dither-label">{{ t('index.bead3D') }}</text>
            <text class="dither-meta">{{ t('index.bead3DMeta') }}</text>
          </view>
          <switch
            :checked="settings.bead3DEnabled"
            color="#E60012"
            @change="onToggleBead3D"
          />
        </view>
        <view class="row-between option-row">
          <view class="col">
            <text class="dither-label">{{ t('index.enhance') }}</text>
            <text class="dither-meta">{{ t('index.enhanceMeta') }}</text>
          </view>
          <switch
            :checked="settings.imageEnhancement"
            color="#E60012"
            @change="onToggleEnhance"
          />
        </view>
      </view>
    </view>

    <view class="section">
      <ColorBarPreview :palette="palette.active" :count="12" />
    </view>

    <view v-if="generator.result" class="section preview-section">
      <view class="row-between">
        <text class="label">预览</text>
        <text class="status">
          {{ generator.status === 'done' ? '✓ 完成' : '处理中…' }}
        </text>
      </view>
      <view class="canvas-wrapper">
        <BeadCanvas :grid="generator.result" :cell-size="Math.round(12 * previewScale)" />
      </view>
      <PreviewToolbar
        :scale="previewScale"
        @zoom-in="onZoomIn"
        @zoom-out="onZoomOut"
        @reset="onZoomReset"
      />
    </view>

    <view v-if="generator.result" class="section">
      <view class="btn-primary" @tap="onGoResult">
        <text>查看完整图纸</text>
      </view>
    </view>

    <view v-if="generator.status === 'error'" class="error">
      <text>生成失败：{{ generator.error }}</text>
    </view>

    <canvas
      :canvas-id="sourceCanvasId"
      :id="sourceCanvasId"
      class="src-canvas"
    />
    <canvas
      :canvas-id="resizeCanvasId"
      :id="resizeCanvasId"
      class="src-canvas"
    />
  </view>

  <!-- 草稿箱弹层 -->
  <view v-if="showDrafts" class="history-mask" @tap="onCloseDrafts">
    <view class="pages-panel" @tap.stop>
      <view class="history-header">
        <text class="history-title">草稿箱</text>
        <text class="history-meta">本地保存 {{ generator.drafts.length }} 张图纸</text>
      </view>
      <scroll-view scroll-y class="pages-scroll">
        <view
          v-for="d in generator.drafts"
          :key="d.id"
          class="draft-item"
          @tap="onLoadDraftById(d.id)"
        >
          <view class="col">
            <text class="draft-name">{{ d.name }}</text>
            <text class="draft-meta">{{ d.width }} × {{ d.height }} · {{ formatTimeShort(d.createdAt) }}</text>
          </view>
          <view class="draft-delete" @tap.stop="onDeleteDraftById($event, d.id)">
            <text>✕</text>
          </view>
        </view>
        <view v-if="generator.drafts.length === 0" class="history-empty">
          <text>暂无草稿</text>
        </view>
      </scroll-view>
      <view class="pages-footer">
        <view class="btn-primary" @tap="onCloseDrafts">
          <text>关闭</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.container {
  padding: $space-4;
  display: flex;
  flex-direction: column;
  gap: $space-4;
  min-height: 100vh;
}
.header {
  .title {
    font-size: $font-xxl;
    font-weight: 700;
    color: $color-text;
  }
  .subtitle {
    display: block;
    font-size: $font-sm;
    color: $color-text-tertiary;
    margin-top: $space-1;
  }
}
.section {
  display: block;
}
.preview-section {
  display: flex;
  flex-direction: column;
  gap: $space-3;
}
.label {
  font-size: $font-sm;
  color: $color-text-secondary;
}
.status {
  font-size: $font-sm;
  color: $color-success;
}
.canvas-wrapper {
  height: 380px;
  background: $color-card;
  border-radius: $radius-md;
  box-shadow: $shadow-sm;
  overflow: hidden;
}
.dither-row {
  background: $color-card;
  border-radius: $radius-md;
  padding: $space-3 $space-4;
  box-shadow: $shadow-sm;
  display: flex;
  flex-direction: column;
  gap: $space-3;
}
.option-row {
  padding-top: $space-3;
  border-top: 1px solid $color-divider;
}
.dither-label {
  font-size: $font-md;
  color: $color-text;
  font-weight: 500;
}
.dither-meta {
  font-size: $font-xs;
  color: $color-text-tertiary;
  margin-top: $space-1;
  display: block;
}
.src-canvas {
  position: fixed;
  top: -10000px;
  left: -10000px;
  width: 4096px;
  height: 4096px;
  pointer-events: none;
}
.drafts-btn {
  width: 100%;
  text-align: center;
  font-size: $font-md;
}
.history-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pages-panel {
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  background: var(--card);
  border-radius: $radius-lg;
  padding: $space-4;
  display: flex;
  flex-direction: column;
  gap: $space-3;
  box-shadow: $shadow-lg;
}
.history-header {
  display: flex;
  flex-direction: column;
  gap: $space-1;
}
.history-title {
  font-size: $font-lg;
  font-weight: 700;
  color: var(--text);
}
.history-meta {
  font-size: $font-sm;
  color: var(--text-tertiary);
}
.pages-scroll {
  flex: 1;
  max-height: 60vh;
}
.draft-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $space-3;
  background: var(--bg);
  border-radius: $radius-sm;
  margin-bottom: $space-2;
}
.draft-name {
  font-size: $font-md;
  color: var(--text);
  font-weight: 500;
}
.draft-meta {
  font-size: $font-xs;
  color: var(--text-tertiary);
  margin-top: $space-1;
}
.draft-delete {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card);
  border-radius: $radius-sm;
  color: var(--error);
}
.history-empty {
  text-align: center;
  color: var(--text-tertiary);
  font-size: $font-sm;
  padding: $space-6 0;
}
.pages-footer {
  display: flex;
  gap: $space-3;
  padding-top: $space-3;
  border-top: 1px solid var(--divider);
  .btn-primary {
    flex: 1;
  }
}
.error {
  background: rgba(255, 77, 79, 0.08);
  color: $color-error;
  padding: $space-3;
  border-radius: $radius-md;
  font-size: $font-sm;
}
</style>
