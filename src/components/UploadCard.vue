<script setup lang="ts">
/**
 * 上传卡片（相册/相机 双模）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 空态：两个按钮"从相册" / "拍照"，点击触发 chooseImage
 * 已选态：缩略图 + 图片元信息 + 重新选图按钮
 */

import type { ImageMeta } from '@/types/image';

interface Props {
  imagePath?: string | null;
  meta?: ImageMeta | null;
}

defineProps<Props>();

const emit = defineEmits<{
  select: [source: 'album' | 'camera'];
  clear: [];
}>();

function onTapAlbum(): void {
  emit('select', 'album');
}

function onTapCamera(): void {
  emit('select', 'camera');
}

function onTapClear(): void {
  emit('clear');
}
</script>

<template>
  <view v-if="!imagePath" class="upload-card empty">
    <view class="icon">📷</view>
    <text class="title">选择图片生成拼豆图</text>
    <text class="subtitle">支持 JPG / PNG / WEBP</text>
    <view class="action-row">
      <view class="btn-primary action-btn" @tap="onTapAlbum">
        <text>🖼 从相册</text>
      </view>
      <view class="btn-primary action-btn" @tap="onTapCamera">
        <text>📸 拍照</text>
      </view>
    </view>
  </view>

  <view v-else class="upload-card filled">
    <image class="thumb" :src="imagePath" mode="aspectFill" />
    <view v-if="meta" class="info">
      <text class="title">{{ meta.width }} × {{ meta.height }}</text>
      <text class="subtitle">{{ meta.tempFilePath?.split('/').pop() }}</text>
    </view>
    <view class="clear" @tap="onTapClear">
      <text>重选</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.upload-card {
  background: $color-card;
  border-radius: $radius-md;
  box-shadow: $shadow-sm;
}
.empty {
  height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed $color-border;
  .icon {
    font-size: 56px;
    margin-bottom: $space-3;
  }
  .title {
    font-size: $font-lg;
    color: $color-text;
    font-weight: 500;
    margin-bottom: $space-1;
  }
  .subtitle {
    font-size: $font-sm;
    color: $color-text-tertiary;
    margin-bottom: $space-3;
  }
}
.action-row {
  display: flex;
  flex-direction: row;
  gap: $space-3;
  width: 100%;
  padding: 0 $space-4;
  box-sizing: border-box;
}
.action-btn {
  flex: 1;
  padding: $space-3 $space-4;
  font-size: $font-md;
}
.filled {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: $space-3;
  gap: $space-3;
  .thumb {
    width: 80px;
    height: 80px;
    border-radius: $radius-sm;
    background: $color-divider;
    flex-shrink: 0;
  }
  .info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .title {
    font-size: $font-md;
    color: $color-text;
    font-weight: 500;
  }
  .subtitle {
    font-size: $font-sm;
    color: $color-text-tertiary;
    margin-top: $space-1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .clear {
    background: $color-primary;
    color: #FFFFFF;
    padding: $space-2 $space-3;
    border-radius: $radius-sm;
    font-size: $font-sm;
  }
}
</style>

<style lang="scss" scoped>
.upload-card {
  background: $color-card;
  border-radius: $radius-md;
  box-shadow: $shadow-sm;
  overflow: hidden;
}
.empty {
  height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed $color-border;
  .icon {
    font-size: 56px;
    margin-bottom: $space-3;
  }
  .title {
    font-size: $font-lg;
    color: $color-text;
    font-weight: 500;
    margin-bottom: $space-1;
  }
  .subtitle {
    font-size: $font-sm;
    color: $color-text-tertiary;
  }
}
.filled {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: $space-3;
  gap: $space-3;
  .thumb {
    width: 80px;
    height: 80px;
    border-radius: $radius-sm;
    background: $color-divider;
    flex-shrink: 0;
  }
  .info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .title {
    font-size: $font-md;
    color: $color-text;
    font-weight: 500;
  }
  .subtitle {
    font-size: $font-sm;
    color: $color-text-tertiary;
    margin-top: $space-1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .clear {
    background: $color-primary;
    color: #FFFFFF;
    padding: $space-2 $space-3;
    border-radius: $radius-sm;
    font-size: $font-sm;
  }
}
</style>
