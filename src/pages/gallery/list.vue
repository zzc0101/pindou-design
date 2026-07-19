<script setup lang="ts">
/**
 * 图纸库列表页
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 展示最近生成的图纸（最多 10 张）。
 * 点击 → 加载到 result 页查看详情。
 * 复制 → 把图纸数据复制到剪贴板（便于跨设备分享）。
 * 导入色板 → 自定义 JSON/CSV 色板加入 palette store。
 */

import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { onShareAppMessage } from '@dcloudio/uni-app';
import { useGalleryStore } from '@/stores/gallery';
import { usePaletteStore } from '@/stores/palette';
import { useGeneratorStore } from '@/stores/generator';
import { canvasToTempFilePath, saveImageToAlbum } from '@/platforms';
import { buildRenderCommands } from '@/core/bead-renderer';
import { parseUserPalette } from '@/core/custom-palette';
import { parseUserTemplate } from '@/data/templates/user-template';
import { TEMPLATES, templateToBeadGrid } from '@/data/templates';
import { logger } from '@/utils/logger';
import type { GalleryItem } from '@/stores/gallery';
import type { Template } from '@/data/templates';

const gallery = useGalleryStore();
const palette = usePaletteStore();
const generator = useGeneratorStore();
const { t } = useI18n();

/** 模板列表 */
const templates = TEMPLATES;

const items = computed(() => gallery.items);

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getThumbBg(item: GalleryItem): string {
  const pal = palette.getPalette(item.paletteId);
  if (!pal) return '#F0F0F0';
  const colors = pal.entries.slice(0, 3).map((e) => e.hex);
  if (colors.length === 0) return '#F0F0F0';
  if (colors.length === 1) return colors[0];
  return `linear-gradient(135deg, ${colors.join(', ')})`;
}

function onOpen(item: GalleryItem): void {
  const pal = palette.getPalette(item.paletteId) ?? palette.active;
  const grid = gallery.toBeadGrid(item, pal);
  generator.runGeneration(grid);
  uni.navigateTo({ url: '/pages/result/result' });
}

function onDelete(event: { stopPropagation?: () => void }, id: string): void {
  if (event?.stopPropagation) event.stopPropagation();
  uni.showModal({
    title: '删除图纸',
    content: '确定从图纸库删除此图纸？',
    success: (res) => {
      if (res.confirm) gallery.remove(id);
    },
  });
}

function onClearAll(): void {
  if (items.value.length === 0) return;
  uni.showModal({
    title: '清空图纸库',
    content: `确定删除全部 ${items.value.length} 张图纸？此操作不可恢复`,
    success: (res) => {
      if (res.confirm) gallery.clear();
    },
  });
}

/** 模板选择弹窗 */
const showTemplates = ref(false);

function onOpenTemplates(): void {
  showTemplates.value = true;
}

function onCloseTemplates(): void {
  showTemplates.value = false;
}

function onPickTemplate(template: Template): void {
  const grid = templateToBeadGrid(template);
  generator.runGeneration(grid);
  showTemplates.value = false;
  uni.navigateTo({ url: '/pages/result/result' });
}

/** 自定义模板导入弹窗 */
const showTemplateInput = ref(false);
const templateInputText = ref('');

function onOpenTemplateInput(): void {
  templateInputText.value = '';
  showTemplateInput.value = true;
}
function onCloseTemplateInput(): void {
  showTemplateInput.value = false;
}
function onSubmitTemplateInput(): void {
  try {
    const tpl = parseUserTemplate(templateInputText.value);
    const grid = templateToBeadGrid(tpl);
    generator.runGeneration(grid);
    uni.showToast({ title: `已导入模板: ${tpl.name} (${tpl.width}×${tpl.height})`, icon: 'success' });
    onCloseTemplateInput();
    setTimeout(() => uni.navigateTo({ url: '/pages/result/result' }), 500);
  } catch (e) {
    uni.showToast({ title: (e as Error).message || '导入失败', icon: 'none' });
    logger.error('import template failed:', e);
  }
}

function onBack(): void {
  uni.navigateBack();
}

/** 自定义色板导入弹窗 */
const showPaletteInput = ref(false);
const paletteInputText = ref('');

function onOpenPaletteInput(): void {
  paletteInputText.value = '';
  showPaletteInput.value = true;
}

function onClosePaletteInput(): void {
  showPaletteInput.value = false;
  paletteInputText.value = '';
}

function onSubmitPaletteInput(): void {
  try {
    const newPalette = parseUserPalette(paletteInputText.value);
    palette.addCustom(newPalette);
    palette.setActive(newPalette.id);
    uni.showToast({ title: `已导入 ${newPalette.entries.length} 色`, icon: 'success' });
    onClosePaletteInput();
  } catch (e) {
    uni.showToast({ title: (e as Error).message || '导入失败', icon: 'none' });
    logger.error('import palette failed:', e);
  }
}

/** 复制图纸数据到剪贴板（JSON 字符串） */
async function onCopyData(item: GalleryItem, event: unknown): Promise<void> {
  // 阻止冒泡
  const e = event as { stopPropagation?: () => void };
  if (e?.stopPropagation) e.stopPropagation();
  try {
    const data = JSON.stringify({
      id: item.id,
      width: item.width,
      height: item.height,
      paletteId: item.paletteId,
      paletteName: item.paletteName,
      cellsBase64: item.cellsBase64,
      createdAt: item.createdAt,
    });
    uni.setClipboardData({
      data,
      success: () => uni.showToast({ title: '图纸数据已复制', icon: 'success' }),
      fail: () => uni.showToast({ title: '复制失败', icon: 'none' }),
    });
  } catch (e) {
    logger.error('copy data failed:', e);
    uni.showToast({ title: '复制失败', icon: 'none' });
  }
}

/** 微信分享（画廊页默认） */
onShareAppMessage(() => {
  return {
    title: '我的拼豆图纸库',
    path: '/pages/gallery/list',
  };
});

/** 多选模式 */
const multiSelectMode = ref(false);
const selectedIds = ref<Set<string>>(new Set());

function onToggleMultiSelect(): void {
  multiSelectMode.value = !multiSelectMode.value;
  if (!multiSelectMode.value) selectedIds.value = new Set();
}

function onToggleSelect(item: GalleryItem): void {
  if (!multiSelectMode.value) return;
  const next = new Set(selectedIds.value);
  if (next.has(item.id)) next.delete(item.id);
  else next.add(item.id);
  selectedIds.value = next;
}

function isSelected(item: GalleryItem): boolean {
  return selectedIds.value.has(item.id);
}

const exporting = ref(false);

async function onExportSelected(): Promise<void> {
  if (exporting.value || selectedIds.value.size === 0) return;
  exporting.value = true;
  uni.showLoading({ title: '导出中...', mask: true });
  try {
    const items = gallery.items.filter((it) => selectedIds.value.has(it.id));
    let success = 0;
    for (const item of items) {
      const pal = palette.getPalette(item.paletteId) ?? palette.active;
      const grid = gallery.toBeadGrid(item, pal);
      const cs = 24;
      const ctx = uni.createCanvasContext('gallery-export-canvas');
      const cmds = buildRenderCommands(grid, {
        cellSize: cs,
        showGrid: true,
        majorGridStep: 5,
        majorGridColor: 'rgba(0,0,0,0.5)',
        majorGridWidth: 2,
        minorGridColor: 'rgba(0,0,0,0.2)',
        minorGridWidth: 1,
        background: '#FFFFFF',
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
          case 'fillText':
            ctx.setFillStyle(cmd.color);
            ctx.setFontSize(cmd.fontSize);
            ctx.setTextAlign('center');
            ctx.setTextBaseline('middle');
            ctx.fillText(cmd.text, cmd.x, cmd.y);
            break;
        }
      }
      await new Promise<void>((resolve) => ctx.draw(false, () => resolve()));
      const path = await canvasToTempFilePath('gallery-export-canvas', { fileType: 'png' });
      await saveImageToAlbum(path);
      success++;
    }
    uni.hideLoading();
    uni.showToast({ title: `已导出 ${success} 张`, icon: 'success' });
    multiSelectMode.value = false;
    selectedIds.value = new Set();
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: '导出失败', icon: 'none' });
    logger.error('batch export failed:', e);
  } finally {
    exporting.value = false;
  }
}

function onDeleteSelected(): void {
  if (selectedIds.value.size === 0) return;
  uni.showModal({
    title: '批量删除',
    content: `确定删除选中的 ${selectedIds.value.size} 张图纸？`,
    success: (res) => {
      if (res.confirm) {
        gallery.removeMany(Array.from(selectedIds.value));
        selectedIds.value = new Set();
        multiSelectMode.value = false;
      }
    },
  });
}
</script>

<template>
  <view class="container">
    <view class="header">
      <view class="row-between">
        <view class="col">
          <text class="title">{{ t('gallery.title') }}</text>
          <text class="subtitle">最近 {{ items.length }} 张图纸</text>
        </view>
        <view v-if="items.length > 0" class="btn-secondary clear-btn" @tap="onToggleMultiSelect">
          <text>{{ multiSelectMode ? '取消' : '多选' }}</text>
        </view>
        <view v-if="items.length > 0 && !multiSelectMode" class="btn-secondary clear-btn" @tap="onClearAll">
          <text>清空</text>
        </view>
        <view class="btn-secondary clear-btn" @tap="onOpenTemplates">
          <text>模板</text>
        </view>
        <view class="btn-secondary clear-btn" @tap="onOpenPaletteInput">
          <text>+ 色板</text>
        </view>
      </view>
    </view>

    <view v-if="items.length === 0" class="empty">
      <text class="empty-icon">📭</text>
      <text class="empty-title">{{ t('gallery.empty') }}</text>
      <text class="empty-meta">{{ t('gallery.emptyMeta') }}</text>
      <view class="btn-primary back-btn" @tap="onBack">
        <text>返回生成</text>
      </view>
    </view>

    <!-- 多选操作栏 -->
    <view v-if="multiSelectMode && items.length > 0" class="multi-bar">
      <text class="multi-info">已选 {{ selectedIds.size }} / {{ items.length }}</text>
      <view class="row multi-actions">
        <view
          class="btn-secondary multi-btn"
          :class="{ disabled: selectedIds.size === 0 }"
          @tap="onDeleteSelected"
        >
          <text>🗑 删除</text>
        </view>
        <view
          class="btn-primary multi-btn"
          :class="{ disabled: selectedIds.size === 0 || exporting }"
          @tap="onExportSelected"
        >
          <text>{{ exporting ? '导出中…' : `📥 导出 (${selectedIds.size})` }}</text>
        </view>
      </view>
    </view>

    <view v-else class="gallery-list">
      <view
        v-for="item in items"
        :key="item.id"
        class="gallery-item"
        :class="{ selected: isSelected(item) }"
        @tap="multiSelectMode ? onToggleSelect(item) : onOpen(item)"
      >
        <view v-if="multiSelectMode" class="item-checkbox">
          <view class="checkbox" :class="{ checked: isSelected(item) }">
            <text v-if="isSelected(item)" class="check-mark">✓</text>
          </view>
        </view>
        <view class="item-thumb" :style="{ background: getThumbBg(item) }" />
        <view class="item-info">
          <text class="item-title">{{ item.paletteName }}</text>
          <text class="item-meta">{{ item.width }} × {{ item.height }} · {{ item.colorCount }} 色 · {{ item.totalBeads }} 颗</text>
          <text class="item-time">{{ formatTime(item.createdAt) }}</text>
        </view>
        <view v-if="!multiSelectMode" class="item-delete" @tap="onCopyData(item, $event)">
          <text>📋</text>
        </view>
        <view v-if="!multiSelectMode" class="item-delete" @tap="onDelete($event, item.id)">
          <text>✕</text>
        </view>
      </view>
    </view>

    <!-- 隐藏的导出 canvas -->
    <canvas canvas-id="gallery-export-canvas" id="gallery-export-canvas" class="hidden-canvas" />

    <!-- 自定义色板导入弹层 -->
    <view v-if="showPaletteInput" class="history-mask" @tap="onClosePaletteInput">
      <view class="palette-input-panel" @tap.stop>
        <view class="history-header">
          <text class="history-title">导入自定义色板</text>
          <text class="history-meta">
            支持 JSON 数组或 CSV（首行表头 code,hex[,name]）
          </text>
        </view>
        <textarea
          v-model="paletteInputText"
          class="palette-textarea"
          placeholder='例如：[{ "code": "R", "hex": "#FF0000" }, ...]'
        />
        <view class="palette-input-footer">
          <view class="btn-secondary" @tap="onClosePaletteInput">
            <text>取消</text>
          </view>
          <view class="btn-primary" @tap="onSubmitPaletteInput">
            <text>导入</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 自定义模板导入弹层 -->
    <view v-if="showTemplateInput" class="history-mask" @tap="onCloseTemplateInput">
      <view class="palette-input-panel" @tap.stop>
        <view class="history-header">
          <text class="history-title">导入自定义模板</text>
          <text class="history-meta">
            JSON 格式：{ "name": "...", "width": 20, "height": 20, "cells": [...], "colors": [...] }
          </text>
        </view>
        <textarea
          v-model="templateInputText"
          class="palette-textarea"
          placeholder='例如：{ "name": "我的图案", "width": 10, "height": 10, "cells": [0,1,1,0,...] }'
          auto-height
        />
        <view class="palette-input-footer">
          <view class="btn-secondary" @tap="onCloseTemplateInput">
            <text>取消</text>
          </view>
          <view class="btn-primary" @tap="onSubmitTemplateInput">
            <text>导入</text>
          </view>
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
.clear-btn {
  padding: $space-1 $space-3;
  font-size: $font-sm;
}

.palette-input-panel {
  width: 100%;
  background: $color-card;
  border-radius: $radius-lg $radius-lg 0 0;
  padding: $space-4;
  display: flex;
  flex-direction: column;
  gap: $space-3;
}
.palette-textarea {
  width: 100%;
  height: 200px;
  padding: $space-3;
  background: $color-bg;
  border-radius: $radius-sm;
  font-size: $font-sm;
  font-family: monospace;
  color: $color-text;
  box-sizing: border-box;
}
.palette-input-footer {
  display: flex;
  gap: $space-3;
  padding-top: $space-3;
  border-top: 1px solid $color-divider;
  .btn-secondary,
  .btn-primary {
    flex: 1;
  }
}

/* 多选模式 */
.multi-bar {
  background: $color-card;
  border-radius: $radius-md;
  padding: $space-3 $space-4;
  box-shadow: $shadow-sm;
  display: flex;
  flex-direction: column;
  gap: $space-2;
}
.multi-info {
  font-size: $font-sm;
  color: $color-text-secondary;
}
.multi-actions {
  gap: $space-3;
}
.multi-btn {
  flex: 1;
  &.disabled {
    opacity: 0.4;
  }
}
.hidden-canvas {
  position: fixed;
  top: -10000px;
  left: -10000px;
  pointer-events: none;
}
.gallery-item {
  &.selected {
    background: rgba(230, 0, 18, 0.08);
    border: 1px solid $color-primary;
  }
}
.item-checkbox {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.checkbox {
  width: 22px;
  height: 22px;
  border-radius: $radius-sm;
  border: 2px solid $color-border;
  background: $color-bg;
  display: flex;
  align-items: center;
  justify-content: center;
  &.checked {
    background: $color-primary;
    border-color: $color-primary;
  }
}
.check-mark {
  color: #FFFFFF;
  font-size: $font-sm;
  font-weight: 700;
  line-height: 1;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-3;
  padding-top: 120px;
}
.empty-icon {
  font-size: 80px;
}
.empty-title {
  font-size: $font-lg;
  font-weight: 600;
  color: $color-text;
}
.empty-meta {
  font-size: $font-sm;
  color: $color-text-tertiary;
}
.back-btn {
  margin-top: $space-4;
  min-width: 200px;
}
.gallery-list {
  display: flex;
  flex-direction: column;
  gap: $space-3;
}
.gallery-item {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: $space-3;
  background: $color-card;
  border-radius: $radius-md;
  box-shadow: $shadow-sm;
}
.item-thumb {
  width: 64px;
  height: 64px;
  border-radius: $radius-sm;
  flex-shrink: 0;
}
.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.item-title {
  font-size: $font-md;
  font-weight: 600;
  color: $color-text;
}
.item-meta {
  font-size: $font-xs;
  color: $color-text-secondary;
  margin-top: $space-1;
}
.item-time {
  font-size: $font-xs;
  color: $color-text-tertiary;
  margin-top: $space-1;
}
.item-delete {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-bg;
  border-radius: $radius-sm;
  color: $color-text-tertiary;
}
.gallery-item {
  display: flex;
  align-items: center;
  gap: $space-2;
}
</style>
