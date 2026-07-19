<script setup lang="ts">
/**
 * 预览工具栏（缩放/重置）
 *
 * @author zhuzc
 * @date 2026-06-22
 */

interface Props {
  scale: number;
  min?: number;
  max?: number;
}

const props = withDefaults(defineProps<Props>(), {
  min: 0.5,
  max: 4,
});

const emit = defineEmits<{
  'zoom-in': [];
  'zoom-out': [];
  'reset': [];
}>();

function canZoomIn(): boolean {
  return props.scale < props.max - 0.01;
}
function canZoomOut(): boolean {
  return props.scale > props.min + 0.01;
}
</script>

<template>
  <view class="preview-toolbar">
    <view
      class="btn"
      :class="{ disabled: !canZoomOut() }"
      @tap="canZoomOut() && emit('zoom-out')"
    >
      <text class="icon">−</text>
    </view>
    <text class="scale-text">{{ Math.round(scale * 100) }}%</text>
    <view
      class="btn"
      :class="{ disabled: !canZoomIn() }"
      @tap="canZoomIn() && emit('zoom-in')"
    >
      <text class="icon">+</text>
    </view>
    <view class="divider" />
    <view class="btn" @tap="emit('reset')">
      <text class="text">重置</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.preview-toolbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: $space-3;
  padding: $space-3;
  background: $color-card;
  border-radius: $radius-md;
  box-shadow: $shadow-sm;
}
.btn {
  min-width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-bg;
  border-radius: $radius-sm;
  padding: 0 $space-3;
  &.disabled {
    opacity: 0.4;
  }
}
.icon {
  font-size: $font-xl;
  font-weight: 500;
  color: $color-text;
}
.text {
  font-size: $font-sm;
  color: $color-text;
}
.scale-text {
  font-size: $font-md;
  color: $color-text-secondary;
  min-width: 48px;
  text-align: center;
}
.divider {
  width: 1px;
  height: 20px;
  background: $color-divider;
  margin: 0 $space-2;
}
</style>
