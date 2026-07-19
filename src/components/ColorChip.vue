<script setup lang="ts">
/**
 * 色块组件：色块 + 色号 + 名称（可选）
 *
 * @author zhuzc
 * @date 2026-06-22
 */

import { computed } from 'vue';

interface Props {
  hex: string;
  code: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  showCode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  showCode: true,
});

const chipSize = computed(() => {
  switch (props.size) {
    case 'sm':
      return '20px';
    case 'lg':
      return '40px';
    default:
      return '28px';
  }
});
</script>

<template>
  <view class="color-chip" :class="`size-${size}`">
    <view class="swatch" :style="{ background: hex, width: chipSize, height: chipSize }" />
    <view v-if="showCode" class="info">
      <text class="code">{{ code }}</text>
      <text v-if="name" class="name">{{ name }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.color-chip {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
}
.swatch {
  border-radius: $radius-sm;
  border: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}
.info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.code {
  font-size: $font-sm;
  color: $color-text;
  font-weight: 500;
}
.name {
  font-size: $font-xs;
  color: $color-text-tertiary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}
</style>
