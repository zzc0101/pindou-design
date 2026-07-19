import type { PaletteEntry } from '@/types/palette';

export interface PurchaseListItem {
  code: string;
  name?: string;
  hex: string;
  count: number;
  /** 用于在同数量时保持与色板一致的稳定顺序。 */
  paletteIndex: number;
}

interface MutablePurchaseListItem extends PurchaseListItem {}

function textOrFallback(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * 将图纸统计转换为可采购的颜色清单。
 *
 * 无效色板下标、非正数量会被忽略；相同色号和色值的重复色卡会合并。
 */
export function buildPurchaseListItems(
  colorCounts: ReadonlyMap<number, number>,
  entries: readonly PaletteEntry[],
): PurchaseListItem[] {
  const grouped = new Map<string, MutablePurchaseListItem>();

  colorCounts.forEach((count, paletteIndex) => {
    if (!Number.isFinite(count) || count <= 0 || !Number.isInteger(paletteIndex)) return;
    const entry = entries[paletteIndex];
    if (!entry) return;

    const code = textOrFallback(entry.code, `颜色 ${paletteIndex + 1}`);
    const hex = textOrFallback(entry.hex, '未知色值').toUpperCase();
    const name = entry.name?.trim() || undefined;
    const key = `${code}\u0000${hex}`;
    const current = grouped.get(key);

    if (current) {
      current.count += count;
      if (paletteIndex < current.paletteIndex) {
        current.paletteIndex = paletteIndex;
        current.name = name;
      } else if (!current.name && name) {
        current.name = name;
      }
      return;
    }

    grouped.set(key, { code, hex, name, count, paletteIndex });
  });

  return [...grouped.values()].sort((left, right) => (
    right.count - left.count
    || left.paletteIndex - right.paletteIndex
    || compareText(left.code, right.code)
    || compareText(left.hex, right.hex)
  ));
}

/** 将采购清单格式化为可直接复制的纯文本。 */
export function formatPurchaseList(items: readonly PurchaseListItem[]): string {
  if (items.length === 0) return '';

  const total = items.reduce((sum, item) => sum + item.count, 0);
  const lines = items.map((item) => {
    const name = item.name ? `（${item.name}）` : '';
    return `- ${item.code}${name} · ${item.hex} · ${item.count} 颗`;
  });

  return [
    '拼豆采购清单',
    ...lines,
    `总计：${total} 颗拼豆，共 ${items.length} 色`,
  ].join('\n');
}
