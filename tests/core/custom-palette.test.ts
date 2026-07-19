/**
 * custom-palette.ts 测试
 */

import { describe, expect, it } from 'vitest';
import { parseUserPalette } from '@/core/custom-palette';

describe('parseUserPalette', () => {
  describe('JSON 格式', () => {
    it('JSON 数组', () => {
      const json = JSON.stringify([
        { code: 'R', name: '红', hex: '#FF0000' },
        { code: 'G', name: '绿', hex: '#00FF00' },
        { code: 'B', name: '蓝', hex: '#0000FF' },
      ]);
      const palette = parseUserPalette(json, '我的色板');
      expect(palette.name).toBe('我的色板');
      expect(palette.source).toBe('custom');
      expect(palette.entries.length).toBe(3);
      expect(palette.entries[0].code).toBe('R');
      expect(palette.entries[0].hex).toBe('#FF0000');
    });

    it('单对象 JSON', () => {
      const json = JSON.stringify({ code: 'X', hex: '#123456' });
      const palette = parseUserPalette(json);
      expect(palette.entries.length).toBe(1);
      expect(palette.entries[0].code).toBe('X');
    });

    it('JSON 数组为空 → 报错', () => {
      expect(() => parseUserPalette('[]')).toThrow(/数组为空/);
    });

    it('JSON 语法错 → 报错', () => {
      expect(() => parseUserPalette('[invalid json')).toThrow(/JSON 解析失败/);
    });

    it('JSON 缺 hex 字段 → 报错', () => {
      const json = JSON.stringify([{ code: 'X', name: 'no hex' }]);
      expect(() => parseUserPalette(json)).toThrow(/hex/);
    });
  });

  describe('CSV 格式', () => {
    it('标准 CSV', () => {
      const csv = `code,name,hex
R,红,#FF0000
G,绿,#00FF00
B,蓝,#0000FF`;
      const palette = parseUserPalette(csv, 'CSV 色板');
      expect(palette.name).toBe('CSV 色板');
      expect(palette.entries.length).toBe(3);
      expect(palette.entries[1].name).toBe('绿');
    });

    it('无 name 列也可以', () => {
      const csv = `code,hex
R,#FF0000
G,#00FF00`;
      const palette = parseUserPalette(csv);
      expect(palette.entries.length).toBe(2);
      expect(palette.entries[0].code).toBe('R');
    });

    it('表头大小写不敏感', () => {
      const csv = `Code,Hex
R,#FF0000`;
      const palette = parseUserPalette(csv);
      expect(palette.entries.length).toBe(1);
    });

    it('CSV 缺 code 列 → 报错', () => {
      const csv = `name,hex
红,#FF0000`;
      expect(() => parseUserPalette(csv)).toThrow(/code/);
    });

    it('引号包裹字段', () => {
      const csv = `code,name,hex
"R","红,色","#FF0000"`;
      const palette = parseUserPalette(csv);
      expect(palette.entries[0].name).toBe('红,色');
      expect(palette.entries[0].code).toBe('R');
    });

    it('空 CSV → 报错', () => {
      expect(() => parseUserPalette('')).toThrow(/为空/);
    });

    it('只表头 → 报错', () => {
      expect(() => parseUserPalette('code,hex')).toThrow(/至少需要/);
    });
  });

  describe('自动识别格式', () => {
    it('以 [ 开头 → JSON', () => {
      const json = '[' + JSON.stringify({ code: 'X', hex: '#000000' }) + ']';
      const palette = parseUserPalette(json);
      expect(palette.entries.length).toBe(1);
    });

    it('以 { 开头 → JSON 单对象', () => {
      const json = '{"code":"X","hex":"#000000"}';
      const palette = parseUserPalette(json);
      expect(palette.entries.length).toBe(1);
    });

    it('以 R 开头（CSV）', () => {
      const csv = `code,hex
R,#FF0000`;
      const palette = parseUserPalette(csv);
      expect(palette.source).toBe('custom');
    });
  });
});

describe('parseUserPalette 集成（自动计算 Lab）', () => {
  it('解析后色板 entries 含 lab 字段', () => {
    const json = JSON.stringify([{ code: 'X', hex: '#FF0000' }]);
    const palette = parseUserPalette(json);
    expect(palette.entries[0].lab).toBeDefined();
    expect(palette.entries[0].lab.length).toBe(3);
  });
});
