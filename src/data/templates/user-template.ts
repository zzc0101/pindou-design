/**
 * 自定义模板导入
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 用户从剪贴板/分享码导入 JSON 格式的模板：
 *   { "name": "...", "width": 20, "height": 20, "cells": [...], "colors": [...] }
 */

import type { Template } from './index';

/**
 * 解析用户输入的模板 JSON
 *
 * @throws 解析失败或字段缺失抛 Error
 */
export function parseUserTemplate(input: string): Template {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('内容为空');
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    throw new Error('模板必须是 JSON 对象');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch (e) {
    throw new Error(`JSON 解析失败: ${(e as Error).message}`);
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('模板必须是 JSON 对象');
  }
  const obj = raw as Record<string, unknown>;

  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (!name) throw new Error('模板 name 字段必填');

  const width = Number(obj.width);
  const height = Number(obj.height);
  if (!Number.isInteger(width) || width <= 0 || width > 200) {
    throw new Error('模板 width 必须 1-200 整数');
  }
  if (!Number.isInteger(height) || height <= 0 || height > 200) {
    throw new Error('模板 height 必须 1-200 整数');
  }

  if (!Array.isArray(obj.cells)) {
    throw new Error('模板 cells 字段必须是数组');
  }
  if (obj.cells.length !== width * height) {
    throw new Error(`cells 长度 ${obj.cells.length} 与 ${width}×${height} 不符`);
  }
  const cells = new Uint8Array(width * height);
  for (let i = 0; i < obj.cells.length; i++) {
    const v = obj.cells[i];
    if (typeof v !== 'number' || v < 0 || v > 255) {
      throw new Error(`cells[${i}] 不是 0-255 数字`);
    }
    cells[i] = Math.floor(v);
  }

  // colors 可选
  let colors: Template['colors'] = [];
  if (Array.isArray(obj.colors)) {
    colors = obj.colors
      .filter(
        (c): c is { code: string; hex: string } =>
          typeof c === 'object' &&
          c !== null &&
          typeof (c as { code?: unknown }).code === 'string' &&
          typeof (c as { hex?: unknown }).hex === 'string',
      )
      .map((c) => ({ code: c.code, hex: c.hex }));
  }

  const id = `user-${Date.now().toString(36)}`;
  return { id, name, emoji: '🎨', description: '用户导入模板', width, height, cells, colors };
}