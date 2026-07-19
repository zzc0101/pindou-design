<script setup lang="ts">
/**
 * 拼豆 Canvas 渲染（高性能版）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 使用 buildRenderCommands 生成渲染指令（已合并同色行），
 * 再用 uni-app 旧版 canvas API 执行。
 */

import { ref, watch, onMounted } from 'vue';
import type { BeadGrid } from '@/types/bead';
import { buildRenderCommands } from '@/core/bead-renderer';

interface Props {
  grid: BeadGrid | null;
  cellSize?: number;
  showLabel?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  cellSize: 12,
  showLabel: false,
});

const canvasId = 'bead-canvas';
const canvasWidth = ref(0);
const canvasHeight = ref(0);

function applyCommand(ctx: UniApp.CanvasContext, cmd: ReturnType<typeof buildRenderCommands>[number]): void {
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

function draw(): void {
  if (!props.grid) return;
  const cs = props.cellSize;
  canvasWidth.value = props.grid.width * cs;
  canvasHeight.value = props.grid.height * cs;

  const ctx = uni.createCanvasContext(canvasId);
  const cmds = buildRenderCommands(props.grid, {
    cellSize: cs,
    showGrid: true,
    majorGridStep: 5,
    labelStep: props.showLabel ? 10 : 0,
    labelFontSize: Math.max(8, Math.floor(cs * 0.6)),
  });
  for (const cmd of cmds) {
    applyCommand(ctx, cmd);
  }
  ctx.draw(false);
}

watch(
  () => [props.grid, props.cellSize, props.showLabel],
  () => draw(),
  { deep: true },
);

onMounted(() => {
  draw();
});
</script>

<template>
  <scroll-view scroll-x scroll-y class="bead-canvas-scroll">
    <canvas
      v-if="grid"
      :id="canvasId"
      :canvas-id="canvasId"
      :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
      class="bead-canvas"
    />
    <view v-else class="empty">
      <text>请先选择图片</text>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.bead-canvas-scroll {
  width: 100%;
  height: 100%;
  background: $color-card;
  border-radius: $radius-md;
}
.bead-canvas {
  display: block;
}
.empty {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-text-tertiary;
}
</style>
