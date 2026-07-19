<script setup lang="ts">
/**
 * 结果页
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 显示 2× 倍率高清单图 + 颜色用量统计 + 导出/保存按钮
 */

import { computed, ref, watch } from 'vue';
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { useGeneratorStore } from '@/stores/generator';
import { usePaletteStore } from '@/stores/palette';
import { useGalleryStore } from '@/stores/gallery';
import { useUndoRedoStore } from '@/stores/undo-redo';
import { useSettingsStore } from '@/stores/settings';
import { canvasToTempFilePath, saveImageToAlbum } from '@/platforms';
import { buildRenderCommands } from '@/core/bead-renderer';
import { buildRenderCommands3D } from '@/core/bead-renderer-3d';
import { setCellColor } from '@/core/adjustments';
import { tileGrid, renderTile } from '@/core/page-tile';
import { estimateCost, formatCost, analyzeMainColors } from '@/core/cost-estimator';
import { calcDetailedQuality } from '@/core/quality';
import { logger } from '@/utils/logger';
import type { BeadGrid } from '@/types/bead';
import { buildPurchaseListItems, formatPurchaseList } from './purchase-list';

const generator = useGeneratorStore();
const palette = usePaletteStore();
const gallery = useGalleryStore();
const undoRedo = useUndoRedoStore();
const settings = useSettingsStore();
const { t } = useI18n();

const resultCanvasId = 'result-canvas';
const exporting = ref(false);
const saving = ref(false);
const copyingPurchaseList = ref(false);

// 手动调整状态
const showPicker = ref(false);
const selectedCell = ref<{ x: number; y: number } | null>(null);

/** 当前编辑中的 BeadGrid（未编辑时等于 generator.result） */
const editingGrid = ref<BeadGrid | null>(generator.result);

/** 同步 generator.result → editingGrid（外部重新生成时复位） */
watch(
  () => generator.result,
  (newGrid) => {
    editingGrid.value = newGrid;
    undoRedo.clear(); // 重新生成时清空撤销栈
  },
);

/**
 * 自动保存：grid 每次变化（新生成 / 手动调整）都存到图纸库
 * 去重：避免同一 grid 重复存
 */
const savedIds = ref<Set<string>>(new Set());

function isSameGrid(a: BeadGrid, b: BeadGrid): boolean {
  if (a === b) return true;
  if (a.width !== b.width || a.height !== b.height) return false;
  if (a.cells.length !== b.cells.length) return false;
  for (let i = 0; i < a.cells.length; i++) {
    if (a.cells[i] !== b.cells[i]) return false;
  }
  return true;
}

watch(
  editingGrid,
  (newGrid, oldGrid) => {
    if (!newGrid) return;
    if (oldGrid && isSameGrid(newGrid, oldGrid)) return;
    const id = gallery.save(newGrid, palette.active.name, generator.sourceImagePath ?? undefined);
    savedIds.value.add(id);
    logger.debug(`已自动保存到图纸库: ${id}`);
  },
  { immediate: true },
);

/** canvas 点击 → 计算格子坐标 → 弹出 Picker */
function onCanvasTap(e: unknown): void {
  const detail = (e as { detail?: { x?: number; y?: number } })?.detail;
  if (!detail) return;
  const g = editingGrid.value;
  if (!g) return;
  const cs = 24;
  const gx = Math.floor((detail.x ?? 0) / cs);
  const gy = Math.floor((detail.y ?? 0) / cs);
  if (gx < 0 || gx >= g.width || gy < 0 || gy >= g.height) return;
  selectedCell.value = { x: gx, y: gy };
  showPicker.value = true;
}

/** Picker 选色 → 记录历史 + 更新 editingGrid */
function onPickColor(colorIndex: number): void {
  const g = editingGrid.value;
  const cell = selectedCell.value;
  if (!g || !cell) return;
  // 1) 记录当前状态到撤销栈（带标签）
  const entry = palette.active.entries[colorIndex];
  const code = entry?.code ?? `?`;
  undoRedo.record(g, `改色 (${cell.x},${cell.y}) → ${code}`);
  // 2) 应用新颜色
  const updated = setCellColor(g, cell.x, cell.y, colorIndex);
  editingGrid.value = updated;
  generator.runGeneration(updated);
  showPicker.value = false;
}

/** 撤销 */
function onUndo(): void {
  const g = editingGrid.value;
  if (!g) return;
  const prev = undoRedo.undo(g, '撤销');
  if (!prev) return;
  editingGrid.value = prev.grid;
  generator.runGeneration(prev.grid);
}

/** 重做 */
function onRedo(): void {
  const g = editingGrid.value;
  if (!g) return;
  const next = undoRedo.redo(g, '重做');
  if (!next) return;
  editingGrid.value = next.grid;
  generator.runGeneration(next.grid);
}

/** 历史时间线弹窗 */
const showHistory = ref(false);
function onOpenHistory(): void {
  showHistory.value = true;
}
function onCloseHistory(): void {
  showHistory.value = false;
}

/** 跳转到指定历史位置 */
function onJumpHistory(index: number): void {
  const g = editingGrid.value;
  if (!g) return;
  const target = undoRedo.jumpTo(index, g);
  if (!target) return;
  editingGrid.value = target.grid;
  generator.runGeneration(target.grid);
  showHistory.value = false;
  uni.showToast({ title: `已跳转到第 ${index + 1} 步`, icon: 'none' });
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function onClosePicker(): void {
  showPicker.value = false;
}

function onOpenGallery(): void {
  uni.navigateTo({ url: '/pages/gallery/list' });
}

function onOpen3DPreview(): void {
  uni.navigateTo({ url: '/pages/preview3d/preview3d' });
}

function onToggleTransparent(): void {
  settings.setTransparentBackground(!settings.transparentBackground);
  // 触发重新渲染（onReady 不行，需要手动调）
  renderResultCanvas().catch((e) => logger.error('re-render failed:', e));
}

function onToggleCompare(): void {
  settings.setCompareMode(!settings.compareMode);
}

/** 草稿箱 */
const showDrafts = ref(false);
const draftName = ref('');

function onOpenDrafts(): void {
  draftName.value = '';
  showDrafts.value = true;
}
function onCloseDrafts(): void {
  showDrafts.value = false;
}

function onSaveDraft(): void {
  if (!generator.result) {
    uni.showToast({ title: '当前无图纸', icon: 'none' });
    return;
  }
  const name = draftName.value.trim() || `草稿 ${generator.drafts.length + 1}`;
  draftName.value = '';
  generator.saveCurrentDraft(name);
  uni.showToast({ title: '已保存草稿', icon: 'success' });
}

function onLoadDraftById(id: string): void {
  if (generator.loadDraftById(id)) {
    showDrafts.value = false;
    uni.navigateTo({ url: '/pages/index/index' });
    uni.showToast({ title: '已恢复草稿', icon: 'success' });
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

function onRenameDraftById(id: string): void {
  const draft = generator.drafts.find((d) => d.id === id);
  if (!draft) return;
  uni.showModal({
    title: '重命名草稿',
    editable: true,
    content: draft.name,
    success: (res) => {
      if (res.confirm && res.content) {
        generator.renameDraft(id, res.content);
      }
    },
  });
}

/** 分页信息（用于预览/导出） */
interface PageInfo {
  index: number;
  total: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

/** 分页预览状态 */
const showPages = ref(false);
const pages = computed<PageInfo[]>(() => {
  if (!grid.value) return [];
  const tiles = tileGrid(grid.value);
  return tiles.map((t) => ({
    index: t.pageIndex,
    total: t.totalPages,
    offsetX: t.cellOffsetX,
    offsetY: t.cellOffsetY,
    width: t.cellWidth,
    height: t.cellHeight,
  }));
});

function onOpenPages(): void {
  showPages.value = true;
}
function onClosePages(): void {
  showPages.value = false;
}

const exportingPages = ref(false);
const exportProgress = ref({ current: 0, total: 0 });

async function onExportAllPages(): Promise<void> {
  if (exportingPages.value || !grid.value) return;
  exportingPages.value = true;
  exportProgress.value = { current: 0, total: pages.value.length };
  try {
    for (const p of pages.value) {
      const cs = 24;
      const tileInfo = tileGrid(grid.value)[p.index];
      // 切换 canvas 到对应分页渲染
      const cmds = renderTile(grid.value, tileInfo, {
        cellSize: cs,
        transparent: settings.transparentBackground,
      });
      const ctx = uni.createCanvasContext(resultCanvasId);
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
            ctx.setTextAlign('left');
            ctx.setTextBaseline('top');
            ctx.fillText(cmd.text, cmd.x, cmd.y);
            break;
        }
      }
      await new Promise<void>((resolve) => ctx.draw(false, () => resolve()));
      const path = await canvasToTempFilePath(resultCanvasId, { fileType: 'png' });
      await saveImageToAlbum(path);
      exportProgress.value = { current: p.index + 1, total: pages.value.length };
    }
    uni.showToast({
      title: `已导出 ${pages.value.length} 张分页图到相册`,
      icon: 'success',
    });
  } catch (e) {
    uni.showToast({ title: '分页导出失败', icon: 'none' });
    logger.error('export pages failed:', e);
  } finally {
    exportingPages.value = false;
    showPages.value = false;
  }
}

/** 当前显示的 BeadGrid */
const grid = computed(() => generator.result);

/** 成本估算 */
const cost = computed(() => (grid.value ? estimateCost(grid.value) : null));

/** 主色（前 5） */
const mainColors = computed(() =>
  grid.value ? analyzeMainColors(grid.value, 5) : [],
);

/** 图纸评分（多维度） */
const quality = computed(() => (grid.value ? calcDetailedQuality(grid.value) : null));

/** 颜色用量列表（按数量降序） */
const colorUsage = computed(() => {
  if (!grid.value) return [];
  return buildPurchaseListItems(grid.value.stats.colorCounts, grid.value.palette.entries);
});

const purchaseListText = computed(() => formatPurchaseList(colorUsage.value));

/** 总豆子数 */
const totalBeads = computed(() => {
  if (!grid.value) return 0;
  return grid.value.stats.filledCells;
});

/** 画布尺寸（单格 24px） */
const canvasSize = computed(() => {
  if (!grid.value) return { w: 0, h: 0 };
  return {
    w: grid.value.width * 24,
    h: grid.value.height * 24,
  };
});

onLoad(() => {
  // 跳转到结果页时直接画图（onReady 太晚）
});

/**
 * 微信好友分享
 * 自定义分享图：复用结果 canvas 渲染的小图
 */
onShareAppMessage(async () => {
  try {
    if (!grid.value) {
      return {
        title: '拼豆图纸 - 把图片变成拼豆图纸',
        path: '/pages/index/index',
      };
    }
    await renderResultCanvas();
    const imageUrl = await canvasToTempFilePath(resultCanvasId, { fileType: 'png' });
    return {
      title: `我做了 ${grid.value.width}×${grid.value.height} 拼豆图纸，共 ${colorUsage.value.length} 色 ${totalBeads.value} 颗豆子`,
      path: '/pages/index/index',
      imageUrl,
    };
  } catch (e) {
    logger.error('share failed:', e);
    return {
      title: '拼豆图纸 - 把图片变成拼豆图纸',
      path: '/pages/index/index',
    };
  }
});

function onBack(): void {
  uni.navigateBack();
}

function onCopyCode(code: string): void {
  uni.setClipboardData({
    data: code,
    success: () => uni.showToast({ title: `已复制 ${code}`, icon: 'none' }),
  });
}

function setClipboardText(data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!data || typeof uni === 'undefined' || typeof uni.setClipboardData !== 'function') {
      reject(new Error('clipboard API unavailable'));
      return;
    }
    try {
      uni.setClipboardData({ data, success: resolve, fail: reject });
    } catch (error) {
      reject(error);
    }
  });
}

async function onCopyPurchaseList(): Promise<void> {
  if (copyingPurchaseList.value) return;
  if (!purchaseListText.value) {
    uni.showToast({ title: '暂无可复制的采购清单', icon: 'none' });
    return;
  }

  copyingPurchaseList.value = true;
  try {
    await setClipboardText(purchaseListText.value);
    uni.showToast({ title: '采购清单已复制', icon: 'success' });
  } catch (error) {
    logger.error('copy purchase list failed:', error);
    uni.showToast({ title: '复制失败，请检查剪贴板权限', icon: 'none' });
  } finally {
    copyingPurchaseList.value = false;
  }
}

/** 渲染高清单图到 canvas（使用同色行合并的高性能渲染器） */
async function renderResultCanvas(): Promise<void> {
  if (!grid.value) return;
  const cs = 24;
  const ctx = uni.createCanvasContext(resultCanvasId);

  const cmds = settings.bead3DEnabled
    ? buildRenderCommands3D(grid.value, {
        cellSize: cs,
        showGrid: true,
        majorGridStep: 5,
        majorGridColor: 'rgba(0,0,0,0.5)',
        majorGridWidth: 2,
        minorGridColor: 'rgba(0,0,0,0.2)',
        minorGridWidth: 1,
        background: '#FFFFFF',
        transparent: settings.transparentBackground,
        highlightAlpha: 0.3,
        shadowAlpha: 0.15,
      })
    : buildRenderCommands(grid.value, {
        cellSize: cs,
        showGrid: true,
        majorGridStep: 5,
        majorGridColor: 'rgba(0,0,0,0.5)',
        majorGridWidth: 2,
        minorGridColor: 'rgba(0,0,0,0.2)',
        minorGridWidth: 1,
        labelStep: 10,
        labelColor: 'rgba(0,0,0,0.6)',
        labelFontSize: 10,
        background: '#FFFFFF',
        transparent: settings.transparentBackground,
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
}

async function onExport(): Promise<void> {
  if (exporting.value) return;
  exporting.value = true;
  try {
    await renderResultCanvas();
    const path = await canvasToTempFilePath(resultCanvasId, { fileType: 'png' });
    uni.showToast({ title: '已生成临时文件', icon: 'success' });
    logger.info('exported to:', path);
    // 直接触发保存（更顺滑）
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
      await renderResultCanvas();
      path = await canvasToTempFilePath(resultCanvasId, { fileType: 'png' });
    }
    await saveImageToAlbum(path);
    uni.showToast({ title: '已保存到相册', icon: 'success' });
    logger.info('saved to album:', path);
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
            <text class="title">{{ grid.width }} × {{ grid.height }} {{ t('result.title') }}</text>
            <text class="subtitle">
              {{ colorUsage.length }} 色 / {{ totalBeads }} 颗豆子
              <text v-if="cost"> / 约 {{ formatCost(cost.estimatedCost) }}</text>
            </text>
          </view>
          <view class="row header-actions">
            <view
              class="btn-secondary action-btn"
              :class="{ disabled: !undoRedo.canUndo }"
              @tap="onUndo"
            >
              <text>↶ 撤销</text>
            </view>
            <view
              class="btn-secondary action-btn"
              :class="{ disabled: !undoRedo.canRedo }"
              @tap="onRedo"
            >
              <text>↷ 重做</text>
            </view>
            <view class="btn-secondary gallery-btn" @tap="onOpenHistory">
              <text>🕒</text>
            </view>
            <view class="btn-secondary gallery-btn" @tap="onOpenGallery">
              <text>📚</text>
            </view>
            <view class="btn-secondary gallery-btn" @tap="onOpen3DPreview">
              <text>🧊</text>
            </view>
            <view
              class="btn-secondary gallery-btn"
              :class="{ active: settings.compareMode }"
              @tap="onToggleCompare"
            >
              <text>🔍</text>
            </view>
            <view class="btn-secondary gallery-btn" @tap="onOpenDrafts">
              <text>💾</text>
            </view>
            <view
              class="btn-secondary gallery-btn"
              :class="{ active: settings.transparentBackground }"
              @tap="onToggleTransparent"
            >
              <text>{{ settings.transparentBackground ? '⬜' : '⬛' }}</text>
            </view>
            <view v-if="pages.length > 1" class="btn-secondary gallery-btn" @tap="onOpenPages">
              <text>🖨</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 高清图纸 -->
      <scroll-view scroll-x scroll-y class="canvas-scroll">
        <canvas
          v-if="!settings.compareMode"
          :id="resultCanvasId"
          :canvas-id="resultCanvasId"
          :style="{ width: canvasSize.w + 'px', height: canvasSize.h + 'px' }"
          class="result-canvas"
          @ready="renderResultCanvas"
          @tap="onCanvasTap"
        />
        <view v-else class="compare-wrapper">
          <view class="compare-half">
            <text class="compare-label">原图</text>
            <image
              v-if="generator.sourceImagePath"
              :src="generator.sourceImagePath"
              mode="aspectFit"
              class="compare-image"
            />
            <view v-else class="compare-placeholder">
              <text>暂无原图</text>
            </view>
          </view>
          <view class="compare-half">
            <text class="compare-label">拼豆图纸</text>
            <canvas
              :id="resultCanvasId"
              :canvas-id="resultCanvasId"
              :style="{ width: canvasSize.w + 'px', height: canvasSize.h + 'px' }"
              class="compare-canvas"
              @ready="renderResultCanvas"
              @tap="onCanvasTap"
            />
          </view>
        </view>
      </scroll-view>
      <text class="hint">{{ t('result.pickColor') }}</text>

      <!-- 操作按钮 -->
      <view class="actions">
        <view class="btn-secondary" :class="{ disabled: exporting }" @tap="onExport">
          <text>{{ exporting ? '导出中…' : '导出 PNG' }}</text>
        </view>
        <view class="btn-primary" :class="{ disabled: saving }" @tap="onSave()">
          <text>{{ saving ? '保存中…' : '保存到相册' }}</text>
        </view>
      </view>

      <!-- 颜色用量列表 -->
      <view class="usage-section">
        <view class="row-between usage-header">
          <text class="label">{{ t('result.colors') }}</text>
          <view
            class="btn-secondary copy-list-btn"
            :class="{ disabled: copyingPurchaseList || colorUsage.length === 0 }"
            @tap="onCopyPurchaseList"
          >
            <text>{{ copyingPurchaseList ? '复制中…' : '复制采购清单' }}</text>
          </view>
        </view>

        <!-- 图纸评分（多维度） -->
        <view v-if="quality" class="quality-card" :class="`grade-${quality.rating.toLowerCase()}`">
          <view class="quality-info">
            <text class="quality-grade">{{ quality.rating }}</text>
            <view class="col">
              <text class="quality-label">{{ quality.ratingLabel }}</text>
              <text class="quality-meta">
                {{ quality.diversity }}/{{ quality.balance }}/{{ quality.completeness }}/{{ quality.economy }}
              </text>
            </view>
          </view>
          <text class="quality-score">{{ quality.overall }}</text>
        </view>

        <!-- 主色高亮 -->
        <view v-if="mainColors.length > 0" class="main-colors">
          <text class="main-label">主色 TOP {{ mainColors.length }}</text>
          <view class="main-row">
            <view v-for="m in mainColors" :key="m.code" class="main-item">
              <view class="main-swatch" :style="{ background: m.hex }" />
              <text class="main-code">{{ m.code }}</text>
              <text class="main-pct">{{ Math.round(m.ratio * 100) }}%</text>
            </view>
          </view>
        </view>

        <view class="usage-list">
          <view
            v-for="c in colorUsage.slice(0, 30)"
            :key="c.code"
            class="usage-item"
            @tap="onCopyCode(c.code)"
          >
            <ColorChip :hex="c.hex" :code="c.code" size="sm" />
            <text class="count">× {{ c.count }}</text>
          </view>
        </view>
      </view>
    </template>

    <!-- 调色板选择器 -->
    <PalettePicker
      :visible="showPicker"
      :palette="palette.active"
      :current-color-index="editingGrid && selectedCell ? editingGrid.cells[selectedCell.y * editingGrid.width + selectedCell.x] : 0"
      :cell-position="selectedCell"
      @select="onPickColor"
      @close="onClosePicker"
    />

    <!-- 分页打印弹层 -->
    <view v-if="showPages" class="history-mask" @tap="onClosePages">
      <view class="pages-panel" @tap.stop>
        <view class="history-header">
          <text class="history-title">{{ t('result.pages') }}</text>
          <text class="history-meta">
            {{ t('result.pagesDesc', { n: pages.length }) }}
          </text>
        </view>
        <scroll-view scroll-y class="pages-scroll">
          <view
            v-for="p in pages"
            :key="p.index"
            class="page-item"
          >
            <view class="page-thumb">
              <text class="page-thumb-text">{{ p.index + 1 }}</text>
            </view>
            <view class="page-info">
              <text class="page-title">第 {{ p.index + 1 }} / {{ p.total }} 页</text>
              <text class="page-meta">
                原图位置 ({{ p.offsetX }}, {{ p.offsetY }}) · {{ p.width }} × {{ p.height }} 格
              </text>
            </view>
          </view>
        </scroll-view>
        <view class="pages-footer">
          <view class="btn-secondary" @tap="onClosePages">
            <text>取消</text>
          </view>
          <view
            class="btn-primary"
            :class="{ disabled: exportingPages }"
            @tap="onExportAllPages"
          >
            <text>{{ exportingPages ? `导出 ${exportProgress.current}/${exportProgress.total}` : '导出全部到相册' }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 草稿箱弹层 -->
    <view v-if="showDrafts" class="history-mask" @tap="onCloseDrafts">
      <view class="pages-panel" @tap.stop>
        <view class="history-header">
          <text class="history-title">草稿箱</text>
          <text class="history-meta">本地保存最近 {{ generator.drafts.length }} 张图纸</text>
        </view>

        <view class="draft-save">
          <input
            v-model="draftName"
            class="draft-input"
            placeholder="输入草稿名（留空自动命名）"
            maxlength="20"
          />
          <view class="btn-primary draft-save-btn" @tap="onSaveDraft">
            <text>保存</text>
          </view>
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
              <text class="draft-meta">{{ d.width }} × {{ d.height }} · {{ formatTime(d.createdAt) }}</text>
            </view>
            <view class="draft-actions">
              <view class="draft-action" @tap.stop="onRenameDraftById(d.id)">
                <text>✎</text>
              </view>
              <view class="draft-action delete" @tap.stop="onDeleteDraftById($event, d.id)">
                <text>✕</text>
              </view>
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

    <!-- 历史时间线弹窗 -->
    <view v-if="showHistory" class="history-mask" @tap="onCloseHistory">
      <view class="history-panel" @tap.stop>
        <view class="history-header">
          <text class="history-title">历史时间线</text>
          <text class="history-meta">
            过去 {{ undoRedo.pastLength }} 步 · 未来 {{ undoRedo.futureLength }} 步
          </text>
        </view>
        <scroll-view scroll-y class="history-scroll">
          <view
            v-for="(entry, idx) in [...undoRedo.past].reverse()"
            :key="idx"
            class="history-item"
            :class="{ latest: idx === 0 }"
            @tap="onJumpHistory(undoRedo.pastLength - 1 - idx)"
          >
            <view class="history-dot" />
            <view class="history-info">
              <text class="history-label">{{ entry.label }}</text>
              <text class="history-time">{{ formatTime(entry.ts) }}</text>
            </view>
            <text class="history-action">跳到这一步</text>
          </view>
          <view v-if="undoRedo.pastLength === 0" class="history-empty">
            <text>暂无历史</text>
          </view>
        </scroll-view>
        <view class="history-footer">
          <view class="btn-primary" @tap="onCloseHistory">
            <text>关闭</text>
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
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $space-4;
  padding-top: $space-8 * 4;
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
  height: 500px;
  background: $color-card;
  border-radius: $radius-md;
  box-shadow: $shadow-sm;
}
.compare-wrapper {
  display: flex;
  flex-direction: row;
  gap: $space-3;
  padding: $space-3;
  height: 100%;
}
.compare-half {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  align-items: center;
}
.compare-label {
  font-size: $font-sm;
  color: $color-text-secondary;
  margin-bottom: $space-2;
}
.compare-image {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  background: $color-bg;
  border-radius: $radius-sm;
}
.compare-canvas {
  display: block;
  max-width: 100%;
  max-height: 100%;
}
.compare-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 200px;
  background: $color-bg;
  border-radius: $radius-sm;
  color: $color-text-tertiary;
  font-size: $font-sm;
}
.header-actions {
  gap: $space-2;
}
.action-btn {
  padding: $space-1 $space-2;
  font-size: $font-sm;
  &.disabled {
    opacity: 0.4;
  }
}
.gallery-btn {
  padding: $space-1 $space-3;
  font-size: $font-sm;
  &.active {
    background: $color-primary;
    color: #FFFFFF;
  }
}

/* 分页打印弹层 */
.pages-panel {
  width: 100%;
  max-height: 80vh;
  background: $color-card;
  border-radius: $radius-lg $radius-lg 0 0;
  padding: $space-4;
  display: flex;
  flex-direction: column;
  gap: $space-3;
}
.pages-scroll {
  flex: 1;
  max-height: 50vh;
}
.page-item {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: $space-3;
  background: $color-bg;
  border-radius: $radius-sm;
  margin-bottom: $space-2;
}
.page-thumb {
  width: 48px;
  height: 48px;
  background: $color-card;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.page-thumb-text {
  font-size: $font-lg;
  font-weight: 700;
  color: $color-primary;
}
.page-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.page-title {
  font-size: $font-md;
  color: $color-text;
  font-weight: 600;
}
.page-meta {
  font-size: $font-xs;
  color: $color-text-tertiary;
  margin-top: $space-1;
}
.pages-footer {
  display: flex;
  gap: $space-3;
  padding-top: $space-3;
  border-top: 1px solid $color-divider;
  .btn-secondary,
  .btn-primary {
    flex: 1;
  }
  .disabled {
    opacity: 0.5;
  }
}

/* 历史时间线弹层 */
.history-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 999;
}
.history-panel {
  width: 100%;
  max-height: 80vh;
  background: $color-card;
  border-radius: $radius-lg $radius-lg 0 0;
  padding: $space-4;
  display: flex;
  flex-direction: column;
  gap: $space-3;
}
.history-header {
  display: flex;
  flex-direction: column;
  gap: $space-1;
  padding-bottom: $space-2;
  border-bottom: 1px solid $color-divider;
}
.history-title {
  font-size: $font-lg;
  font-weight: 600;
  color: $color-text;
}
.history-meta {
  font-size: $font-xs;
  color: $color-text-tertiary;
}
.history-scroll {
  flex: 1;
  max-height: 50vh;
}
.history-item {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: $space-3;
  border-radius: $radius-sm;
  &.latest {
    background: rgba(230, 0, 18, 0.06);
  }
}
.history-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: $color-primary;
  flex-shrink: 0;
}
.history-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.history-label {
  font-size: $font-sm;
  color: $color-text;
}
.history-time {
  font-size: $font-xs;
  color: $color-text-tertiary;
  margin-top: $space-1;
}
.history-action {
  font-size: $font-xs;
  color: $color-primary;
  font-weight: 500;
}
.history-empty {
  text-align: center;
  padding: $space-6;
  color: $color-text-tertiary;
  font-size: $font-sm;
}
.history-footer {
  padding-top: $space-3;
  border-top: 1px solid $color-divider;
}
.hint {
  font-size: $font-xs;
  color: $color-text-tertiary;
  margin-top: $space-1;
  text-align: center;
  display: block;
}
.result-canvas {
  display: block;
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
.usage-section {
  background: $color-card;
  border-radius: $radius-md;
  padding: $space-4;
  box-shadow: $shadow-sm;
}
.usage-header {
  margin-bottom: $space-3;
}
.copy-list-btn {
  padding: $space-1 $space-2;
  font-size: $font-xs;
  &.disabled {
    opacity: 0.5;
  }
}
.label {
  font-size: $font-sm;
  color: $color-text-secondary;
  font-weight: 500;
}
.meta {
  font-size: $font-xs;
  color: $color-text-tertiary;
}

/* 主色高亮 */
.main-colors {
  margin-bottom: $space-3;
  padding-bottom: $space-3;
  border-bottom: 1px solid $color-divider;
}
.main-label {
  font-size: $font-xs;
  color: $color-text-tertiary;
  margin-bottom: $space-2;
  display: block;
}
.main-row {
  display: flex;
  flex-direction: row;
  gap: $space-2;
  flex-wrap: wrap;
}
.main-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 56px;
}
.main-swatch {
  width: 40px;
  height: 40px;
  border-radius: $radius-sm;
  border: 1px solid rgba(0, 0, 0, 0.08);
  margin-bottom: $space-1;
}
.main-code {
  font-size: $font-xs;
  color: $color-text;
  font-weight: 500;
}
.main-pct {
  font-size: $font-xs;
  color: $color-primary;
  font-weight: 600;
}

.usage-list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: $space-3;
}
.usage-item {
  display: flex;
  align-items: center;
  gap: $space-2;
  padding: $space-1 $space-2;
  background: $color-bg;
  border-radius: $radius-sm;
  min-width: 0;
}
.count {
  font-size: $font-xs;
  color: $color-text-secondary;
  font-weight: 500;
}
</style>
