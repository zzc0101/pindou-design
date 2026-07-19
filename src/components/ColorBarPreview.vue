<script setup lang="ts">
/**
 * 色板前 N 色横排预览 + 切换/分享入口
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 点击标题行 → 弹出 action sheet 选择其他色板
 * 长按色号 → 复制到剪贴板（已通过 ColorChip）
 */

import type { Palette } from '@/types/palette';
import { usePaletteStore } from '@/stores/palette';
import { encodeShare } from '@/core/share';
import { logger } from '@/utils/logger';

interface Props {
  palette: Palette;
  count?: number;
}

const props = withDefaults(defineProps<Props>(), {
  count: 12,
});

const paletteStore = usePaletteStore();

function getEntries() {
  return props.palette.entries.slice(0, props.count);
}

/** 点击标题行 → 弹出 action sheet 切换色板 */
function onTapPicker(): void {
  const available: Palette[] = paletteStore.getAvailable();
  const itemList = available.map((p: Palette) => `${p.name} (${p.entries.length} 色)`);
  uni.showActionSheet({
    itemList,
    success: (res) => {
      const target = available[res.tapIndex];
      if (target) paletteStore.setActive(target.id);
    },
    fail: () => {
      // 用户取消，无需处理
    },
  });
}

/** 分享当前色板（复制编码字符串到剪贴板） */
function onSharePalette(): void {
  try {
    const code = encodeShare({
      type: 'palette',
      version: 1,
      data: {
        id: props.palette.id,
        name: props.palette.name,
        source: props.palette.source,
        entries: props.palette.entries.map((e) => ({
          code: e.code,
          hex: e.hex,
          name: e.name,
        })),
      },
      createdAt: Date.now(),
    });
    uni.setClipboardData({
      data: code,
      success: () => uni.showToast({ title: '色板已复制（粘贴给好友即可导入）', icon: 'success' }),
      fail: () => uni.showToast({ title: '复制失败', icon: 'none' }),
    });
  } catch (e) {
    logger.error('share palette failed:', e);
    uni.showToast({ title: '分享失败', icon: 'none' });
  }
}
</script>

<template>
  <view class="color-bar-preview">
    <view class="header" @tap="onTapPicker">
      <view class="row title-row">
        <text class="title">色板</text>
        <text class="meta">{{ palette.name }} · {{ palette.entries.length }} 色</text>
        <text class="caret">▼</text>
      </view>
      <text class="share-btn" @tap.stop="onSharePalette">📤 分享色板</text>
    </view>
    <scroll-view scroll-x class="scroll">
      <view class="row">
        <view v-for="e in getEntries()" :key="e.code" class="color-item">
          <view class="swatch" :style="{ background: e.hex }" />
          <text class="code">{{ e.code }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.color-bar-preview {
  background: $color-card;
  border-radius: $radius-md;
  padding: $space-4;
  box-shadow: $shadow-sm;
}
.header {
  margin-bottom: $space-3;
}
.title-row {
  display: flex;
  align-items: center;
  gap: $space-2;
}
.title {
  font-size: $font-sm;
  color: $color-text-secondary;
  font-weight: 500;
}
.meta {
  flex: 1;
  font-size: $font-xs;
  color: $color-text-tertiary;
}
.caret {
  font-size: $font-xs;
  color: $color-primary;
}
.share-btn {
  margin-left: $space-2;
  font-size: $font-xs;
  color: $color-text-tertiary;
  padding: $space-1 $space-2;
  border-radius: $radius-sm;
  background: $color-bg;
}
.scroll {
  white-space: nowrap;
}
.row {
  display: flex;
  flex-direction: row;
  gap: $space-2;
}
.color-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 40px;
}
.swatch {
  width: 32px;
  height: 32px;
  border-radius: $radius-sm;
  border: 1px solid rgba(0, 0, 0, 0.08);
  margin-bottom: $space-1;
}
.code {
  font-size: $font-xs;
  color: $color-text-secondary;
}
</style>
