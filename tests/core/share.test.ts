/**
 * share.ts 测试
 */

import { describe, expect, it } from 'vitest';
import { encodeShare, decodeShare, extractShare } from '@/core/share';

describe('encodeShare / decodeShare', () => {
  it('beadgrid → 完整 roundtrip', () => {
    const code = encodeShare({
      type: 'beadgrid',
      version: 1,
      data: { width: 10, height: 10, cells: [1, 2, 3] },
      createdAt: 100,
    });
    const decoded = decodeShare(code);
    expect(decoded).toBeTruthy();
    expect(decoded?.type).toBe('beadgrid');
    expect((decoded?.data as { width: number }).width).toBe(10);
  });

  it('palette → 完整 roundtrip', () => {
    const code = encodeShare({
      type: 'palette',
      version: 1,
      data: { id: 'p1', name: 'P', entries: [{ code: 'R', hex: '#FF0000' }] },
      createdAt: 100,
    });
    const decoded = decodeShare(code);
    expect(decoded?.type).toBe('palette');
  });

  it('template → 完整 roundtrip', () => {
    const code = encodeShare({
      type: 'template',
      version: 1,
      data: { name: 'tpl', width: 5, height: 5, cells: [0, 1, 1, 0, 1] },
      createdAt: 100,
    });
    const decoded = decodeShare(code);
    expect(decoded?.type).toBe('template');
  });

  it('中文 / emoji 数据保留', () => {
    const code = encodeShare({
      type: 'palette',
      version: 1,
      data: { name: '中文 ❤️ 测试', count: 3 },
      createdAt: 1,
    });
    const decoded = decodeShare(code);
    expect((decoded?.data as { name: string }).name).toBe('中文 ❤️ 测试');
  });
});

describe('decodeShare 校验', () => {
  it('不是 pindou 前缀 → null', () => {
    expect(decodeShare('xxx:abc')).toBeNull();
  });

  it('空字符串 → null', () => {
    expect(decodeShare('')).toBeNull();
  });

  it('坏 base64 → null', () => {
    expect(decodeShare('pindou:v1:!@#$%^&*')).toBeNull();
  });

  it('version 错误 → null', () => {
    const code = encodeShare({
      type: 'beadgrid',
      version: 2, // 错误
      data: {},
      createdAt: 0,
    });
    expect(decodeShare(code)).toBeNull();
  });

  it('type 错误 → null', () => {
    const json = JSON.stringify({ type: 'invalid', version: 1, data: {}, createdAt: 0 });
    // 手工构造错误 type 的 code
    const b64 = typeof Buffer !== 'undefined'
      ? Buffer.from(json, 'utf8').toString('base64')
      : btoa(unescape(encodeURIComponent(json)));
    expect(decodeShare(`pindou:v1:${b64}`)).toBeNull();
  });
});

describe('extractShare', () => {
  it('整段就是分享码', () => {
    const code = encodeShare({
      type: 'beadgrid',
      version: 1,
      data: { x: 1 },
      createdAt: 0,
    });
    expect(extractShare(code)).toBeTruthy();
  });

  it('混合文本中提取', () => {
    const code = encodeShare({
      type: 'palette',
      version: 1,
      data: { name: 'P' },
      createdAt: 0,
    });
    const text = `这是一些说明文字 ${code} 后面还有内容`;
    const extracted = extractShare(text);
    expect(extracted?.type).toBe('palette');
  });

  it('无分享码 → null', () => {
    expect(extractShare('纯文本无分享码')).toBeNull();
  });

  it('空字符串 → null', () => {
    expect(extractShare('')).toBeNull();
  });
});
