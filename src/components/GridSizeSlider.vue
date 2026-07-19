<script setup lang="ts">
/**
 * 网格尺寸滑块（20-100）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 双向绑定 modelValue（数字）。
 */

interface Props {
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
}

const props = withDefaults(defineProps<Props>(), {
  min: 20,
  max: 100,
  step: 5,
});

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

function onChange(e: { detail: { value: number } }): void {
  // 钳制到合法范围，避免父组件传入非法值时滑块回弹
  const v = Math.max(props.min, Math.min(props.max, e.detail.value));
  emit('update:modelValue', v);
}
</script>

<template>
  <view class="grid-size-slider">
    <view class="row-between">
      <text class="label">网格尺寸</text>
      <text class="value">{{ modelValue }} × {{ modelValue }}</text>
    </view>
    <slider
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :show-value="false"
      activeColor="#E60012"
      backgroundColor="#EEEEEE"
      block-size="20"
      class="slider"
      @change="onChange"
    />
    <view class="scale">
      <text v-for="n in [20, 30, 40, 50, 60, 80, 100]" :key="n" class="tick">
        {{ n }}
      </text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.grid-size-slider {
  background: $color-card;
  border-radius: $radius-md;
  padding: $space-4;
  box-shadow: $shadow-sm;
}
.label {
  font-size: $font-sm;
  color: $color-text-secondary;
}
.value {
  font-size: $font-lg;
  font-weight: 600;
  color: $color-primary;
}
.slider {
  margin: $space-3 0 $space-2;
}
.scale {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
.tick {
  font-size: $font-xs;
  color: $color-text-tertiary;
}
</style>
