/**
 * 3D KD-Tree（用于 Lab 空间最近邻搜索）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 适用场景：色卡规模 ≥ 500 时，KD-Tree 优于线性扫描（O(log N) vs O(N)）。
 *
 * 建树：按 axis 维度选中位数，递归切分；平衡性由 O(n log n) 排序保证。
 * 查询：递归 + 剪枝（用轴距离差 × 1.5 作下界）。
 *
 * 参考：[Bentley 1975 — Multidimensional binary search trees]
 */

import type { Lab } from '@/types/palette';
import { deltaE2000 } from './delta-e';

interface KDNode {
  /** 色卡下标 */
  index: number;
  /** Lab 值 */
  point: Lab;
  /** 当前节点的分割轴（0=L, 1=a, 2=b） */
  axis: number;
  left: KDNode | null;
  right: KDNode | null;
}

/**
 * 从 entries 构建 KD-Tree（O(n log² n)，因 median 选取）
 *
 * @param entries 色卡条目（含 Lab）
 * @returns KD-Tree 根节点；空数组返回 null
 */
export function buildKDTree(entries: ReadonlyArray<{ lab: Lab }>): KDNode | null {
  if (entries.length === 0) return null;
  const indices = entries.map((_, i) => i);
  return buildNode(indices, 0, entries);
}

function buildNode(
  indices: number[],
  depth: number,
  entries: ReadonlyArray<{ lab: Lab }>,
): KDNode | null {
  if (indices.length === 0) return null;
  const axis = depth % 3;
  // 按 axis 维度排序，找中位数
  indices.sort((a, b) => entries[a].lab[axis] - entries[b].lab[axis]);
  const mid = Math.floor(indices.length / 2);
  const idx = indices[mid];
  return {
    index: idx,
    point: entries[idx].lab,
    axis,
    left: buildNode(indices.slice(0, mid), depth + 1, entries),
    right: buildNode(indices.slice(mid + 1), depth + 1, entries),
  };
}

/**
 * 在 KD-Tree 中找最近邻（CIEDE2000 色差 + 轴距离剪枝）
 *
 * 优化：
 *   1. 当前节点永远检查（不会被剪枝）
 *   2. 子节点剪枝条件：轴距离差 |diff| > bestDist * 1.5 → 子树内所有点
 *      与 target 的轴距离 ≥ |diff| → 欧氏距离 ≥ |diff| → CIEDE2000 不可能更近
 *   3. 1.5 是经验系数（CIEDE2000 通常 ≤ 欧氏距离 × 1.5-2.0）
 *
 * @param tree KD-Tree 根
 * @param target 目标 Lab 值
 * @returns 最近色卡下标（输入 entries 时的下标）
 */
export function findNearestKD(tree: KDNode | null, target: Lab): number {
  if (!tree) return -1;
  let bestIdx = tree.index;
  let bestDist = deltaE2000(target, tree.point);

  const stack: KDNode[] = [tree];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (!node) continue;

    // 1) 当前节点：永远检查 CIEDE2000，更新 best
    const d = deltaE2000(target, node.point);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = node.index;
    }

    // 2) 决定先探哪边（target 在分割轴哪侧）
    const axis = node.axis;
    const diff = target[axis] - node.point[axis];
    const first = diff < 0 ? node.left : node.right;
    const second = diff < 0 ? node.right : node.left;

    // 3) 先探更近的子树
    if (first) stack.push(first);

    // 4) 另一子树剪枝：轴距离差 > bestDist * 1.5 → 不可能更近
    if (second && Math.abs(diff) <= bestDist * 1.5) {
      stack.push(second);
    }
  }

  return bestIdx;
}
