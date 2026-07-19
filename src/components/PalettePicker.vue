<script setup lang="ts">
/**
 * 调色板选择器（弹层）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 网格展示所有颜色，可滚动。
 * 当前选中色高亮显示。
 * 含"清除"选项（设为透明）。
 */

import { computed } from 'vue';
import type { Palette } from '@/types/palette';
import { EMPTY_CELL } from '@/core/color-quantize';

interface Props {
  visible: boolean;
  palette: Palette;
  currentColorIndex: number;
  cellPosition?: { x: number; y: number } | null;
}

const props = withDefaults(defineProps<Props>(), {
  cellPosition: null,
});

const emit = defineEmits<{
  select: [colorIndex: number];
  close: [];
}>();

function onPick(index: number): void {
  emit('select', index);
}

function onClear(): void {
  emit('select', EMPTY_CELL);
}

function onMaskTap(): void {
  emit('close');
}

const currentCode = computed(() => {
  if (props.currentColorIndex === EMPTY_CELL) return '透明';
  return props.palette.entries[props.currentColorIndex]?.code ?? '?';
});

const currentHex = computed(() => {
  if (props.currentColorIndex === EMPTY_CELL) return '#FFFFFF';
  return props.palette.entries[props.currentColorIndex]?.hex ?? '#FFFFFF';
});
</script>

<template>
  <view v-if="visible" class="palette-picker-mask" @tap="onMaskTap">
    <view class="palette-picker" @tap.stop>
      <view class="picker-header">
        <view class="col">
          <text class="picker-title">选择色号</text>
          <text v-if="cellPosition" class="picker-meta">
            格子 (列 {{ cellPosition.x }}, 行 {{ cellPosition.y }})
          </text>
        </view>
        <view class="current-preview">
          <view class="current-swatch" :style="{ background: currentHex }" />
          <text class="current-code">{{ currentCode }}</text>
        </view>
      </view>

      <scroll-view scroll-y class="picker-scroll">
        <view class="color-grid">
          <view
            v-for="(entry, idx) in palette.entries"
            :key="entry.code"
            class="color-cell"
            :class="{ selected: idx === currentColorIndex }"
            @tap="onPick(idx)"
          >
            <view class="swatch" :style="{ background: entry.hex }" />
            <text class="code">{{ entry.code }}</text>
          </view>
        </view>
      </scroll-view>

      <view class="picker-footer">
        <view class="btn-secondary" @tap="onClear">
          <text>设为透明</text>
        </view>
        <view class="btn-primary" @tap="onMaskTap">
          <text>关闭</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.palette-picker-mask {
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
.palette-picker {
  width: 100%;
  max-height: 80vh;
  background: $color-card;
  border-radius: $radius-lg $radius-lg 0 0;
  padding: $space-4;
  display: flex;
  flex-direction: column;
  gap: $space-3;
}
.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.picker-title {
  font-size: $font-lg;
  font-weight: 600;
  color: $color-text;
}
.picker-meta {
  font-size: $font-xs;
  color: $color-text-tertiary;
  margin-top: $space-1;
  display: block;
}
.current-preview {
  display: flex;
  align-items: center;
  gap: $space-2;
}
.current-swatch {
  width: 32px;
  height: 32px;
  border-radius: $radius-sm;
  border: 1px solid $color-border;
}
.current-code {
  font-size: $font-md;
  font-weight: 600;
  color: $color-primary;
}
.picker-scroll {
  flex: 1;
  max-height: 50vh;
}
.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
  padding: $space-2 0;
}
.color-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 56px;
  padding: $space-1;
  border-radius: $radius-sm;
  border: 2px solid transparent;
  &.selected {
    border-color: $color-primary;
    background: rgba(230, 0, 18, 0.05);
  }
}
.swatch {
  width: 40px;
  height: 40px;
  border-radius: $radius-sm;
  border: 1px solid rgba(0, 0, 0, 0.08);
  margin-bottom: $space-1;
}
.code {
  font-size: $font-xs;
  color: $color-text-secondary;
}
.picker-footer {
  display: flex;
  gap: $space-3;
  padding-top: $space-3;
  border-top: 1px solid $color-divider;
  .btn-secondary,
  .btn-primary {
    flex: 1;
  }
}
</style>
