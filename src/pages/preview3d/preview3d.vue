<script setup lang="ts">
/**
 * 3D 拼豆预览页（独立大图页）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 大尺寸（cellSize = 48 默认）+ 立体视觉（bead3D 中心高光 + 暗边）
 * 让用户在施工前看到接近真实效果的预览。
 */

import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { onLoad } from '@dcloudio/uni-app';
import { useGeneratorStore } from '@/stores/generator';
import { canvasToTempFilePath, saveImageToAlbum } from '@/platforms';
import { buildRenderCommands3D } from '@/core/bead-renderer-3d';
import { logger } from '@/utils/logger';

const generator = useGeneratorStore();
const { t } = useI18n();

const previewCanvasId = 'preview3d-canvas';
const cellSize = ref(48); // 默认大尺寸
const exporting = ref(false);
const saving = ref(false);

onLoad(() => {
  // 跳转到预览页时直接画图
});

/** 当前显示的 BeadGrid */
const grid = computed(() => generator.result);

/** 画布尺寸 */
const canvasSize = computed(() => {
  if (!grid.value) return { w: 0, h: 0 };
  return {
    w: grid.value.width * cellSize.value,
    h: grid.value.height * cellSize.value,
  };
});

/** 缩放（0.5 ~ 2） */
const zoom = ref(1);
const displaySize = computed(() => ({
  w: canvasSize.value.w * zoom.value,
  h: canvasSize.value.h * zoom.value,
}));

function onZoomIn(): void {
  zoom.value = Math.min(2, Number((zoom.value + 0.2).toFixed(2)));
}
function onZoomOut(): void {
  zoom.value = Math.max(0.4, Number((zoom.value - 0.2).toFixed(2)));
}
function onZoomReset(): void {
  zoom.value = 1;
}

/** 调整 cellSize（10 ~ 80） */
function onSizeChange(e: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (e as any)?.detail?.value;
  if (typeof v === 'number') cellSize.value = Math.max(10, Math.min(80, Math.round(v)));
}

/** 渲染立体预览到 canvas */
async function renderPreviewCanvas(): Promise<void> {
  if (!grid.value) return;
  const cs = cellSize.value;
  const ctx = uni.createCanvasContext(previewCanvasId);

  const cmds = buildRenderCommands3D(grid.value, {
    cellSize: cs,
    showGrid: true,
    majorGridStep: 5,
    majorGridColor: 'rgba(0,0,0,0.45)',
    majorGridWidth: 2,
    minorGridColor: 'rgba(0,0,0,0.18)',
    minorGridWidth: 1,
    background: '#FFFFFF',
    highlightAlpha: 0.32,
    shadowAlpha: 0.18,
  });

  for (const cmd of cmds) {
    switch (cmd.type) {
      case 'fillRect':
        ctx.setFillStyle(cmd.color);
        ctx.fillRect(cmd.x, cmd.y, cmd.w, cmd.h);
        break;
      case 'strokeLine':
        ctx.setStrokeStyle(cmd.color);
        ctx.setLineWidth(cmd.width);
        ctx.beginPath();
        ctx.moveTo(cmd.x1, cmd.y1);
        ctx.lineTo(cmd.x2, cmd.y2);
        ctx.stroke();
        break;
    }
  }

  await new Promise<void>((resolve) => ctx.draw(false, () => resolve()));
}

watch([cellSize, grid], () => {
  renderPreviewCanvas().catch((e) => logger.error('render preview failed:', e));
});

async function onExport(): Promise<void> {
  if (exporting.value || !grid.value) return;
  exporting.value = true;
  try {
    await renderPreviewCanvas();
    const path = await canvasToTempFilePath(previewCanvasId, { fileType: 'png' });
    await onSave(path);
  } catch (e) {
    uni.showToast({ title: '导出失败', icon: 'none' });
    logger.error('export failed:', e);
  } finally {
    exporting.value = false;
  }
}

async function onSave(preGeneratedPath?: string): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  try {
    let path = preGeneratedPath;
    if (!path) {
      await renderPreviewCanvas();
      path = await canvasToTempFilePath(previewCanvasId, { fileType: 'png' });
    }
    await saveImageToAlbum(path);
    uni.showToast({ title: '已保存到相册', icon: 'success' });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('auth') || msg.includes('authorize')) {
      uni.showModal({
        title: '需要相册权限',
        content: '请在设置中允许保存到相册',
        showCancel: false,
      });
    } else {
      uni.showToast({ title: '保存失败', icon: 'none' });
    }
    logger.error('save failed:', e);
  } finally {
    saving.value = false;
  }
}

function onBack(): void {
  uni.navigateBack();
}
</script>

<template>
  <view class="container">
    <view v-if="!grid" class="empty">
      <text>暂无图纸数据</text>
      <view class="btn-secondary back-btn" @tap="onBack">
        <text>返回</text>
      </view>
    </view>

    <template v-else>
      <!-- 标题栏 -->
      <view class="header">
        <view class="row-between">
          <view class="col">
            <text class="title">{{ t('preview3d.title') }}</text>
            <text class="subtitle">{{ t('preview3d.subtitle', { w: grid.width, h: grid.height, cs: cellSize }) }}</text>
          </view>
        </view>
      </view>

      <!-- 大尺寸画布 -->
      <scroll-view scroll-x scroll-y class="canvas-scroll">
        <canvas
          :id="previewCanvasId"
          :canvas-id="previewCanvasId"
          :style="{ width: displaySize.w + 'px', height: displaySize.h + 'px' }"
          class="preview-canvas"
          @ready="renderPreviewCanvas"
        />
      </scroll-view>

      <!-- 缩放 + 单元尺寸工具栏 -->
      <view class="toolbar">
        <view class="toolbar-row">
          <text class="toolbar-label">单格尺寸</text>
          <slider
            :value="cellSize"
            :min="10"
            :max="80"
            :step="4"
            activeColor="#E60012"
            backgroundColor="#EEEEEE"
            block-size="20"
            class="toolbar-slider"
            @change="onSizeChange"
          />
          <text class="toolbar-value">{{ cellSize }}px</text>
        </view>
        <view class="toolbar-row">
          <view class="btn-secondary zoom-btn" @tap="onZoomOut">
            <text>−</text>
          </view>
          <text class="toolbar-value">{{ Math.round(zoom * 100) }}%</text>
          <view class="btn-secondary zoom-btn" @tap="onZoomIn">
            <text>+</text>
          </view>
          <view class="btn-secondary zoom-btn" @tap="onZoomReset">
            <text>↺ 重置</text>
          </view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="actions">
        <view class="btn-secondary" :class="{ disabled: exporting }" @tap="onExport">
          <text>{{ exporting ? '导出中…' : '导出 PNG' }}</text>
        </view>
        <view class="btn-primary" :class="{ disabled: saving }" @tap="onSave()">
          <text>{{ saving ? '保存中…' : '保存到相册' }}</text>
        </view>
      </view>

      <text class="tip">立体预览（中心高光 + 暗边）便于施工前确认整体效果</text>
    </template>
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
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $space-4;
  padding-top: 200px;
  color: $color-text-tertiary;
}
.back-btn {
  margin-top: $space-4;
}
.header {
  .title {
    font-size: $font-xl;
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
.canvas-scroll {
  height: 480px;
  background: $color-card;
  border-radius: $radius-md;
  box-shadow: $shadow-sm;
}
.preview-canvas {
  display: block;
}
.toolbar {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  padding: $space-3;
  background: $color-card;
  border-radius: $radius-md;
  box-shadow: $shadow-sm;
}
.toolbar-row {
  display: flex;
  align-items: center;
  gap: $space-3;
}
.toolbar-label {
  font-size: $font-sm;
  color: $color-text-secondary;
  width: 64px;
  flex-shrink: 0;
}
.toolbar-slider {
  flex: 1;
}
.toolbar-value {
  font-size: $font-sm;
  color: $color-text;
  font-weight: 500;
  min-width: 56px;
  text-align: right;
}
.zoom-btn {
  flex: 1;
  padding: $space-1 $space-2;
  font-size: $font-sm;
  text-align: center;
}
.actions {
  display: flex;
  flex-direction: row;
  gap: $space-3;
  .btn-secondary,
  .btn-primary {
    flex: 1;
  }
  .disabled {
    opacity: 0.5;
  }
}
.tip {
  font-size: $font-xs;
  color: $color-text-tertiary;
  text-align: center;
  display: block;
}
</style>
