/**
 * 性能监控埋点
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 用法：
 *   const t = perf.start('generate');
 *   ... do work ...
 *   perf.end(t);  // 自动输出 ms 到 logger
 *
 * 慢于阈值（默认 1000ms）的操作会上报到 error-reporter。
 */

import { logger } from './logger';
import { reportError } from './error-reporter';

/** 慢操作阈值（ms） */
const SLOW_THRESHOLD_MS = 1000;

interface Mark {
  name: string;
  start: number;
  context?: Record<string, unknown>;
}

/**
 * 开始打点（返回 handle）
 */
export function start(name: string, context?: Record<string, unknown>): Mark {
  return { name, start: Date.now(), context };
}

/**
 * 结束打点（自动 log + 慢操作上报）
 */
export function end(mark: Mark): number {
  const duration = Date.now() - mark.start;
  logger.info(`[perf] ${mark.name} took ${duration}ms`, mark.context);
  if (duration >= SLOW_THRESHOLD_MS) {
    reportError({
      ts: Date.now(),
      message: `Slow operation: ${mark.name} (${duration}ms)`,
      extra: { duration, threshold: SLOW_THRESHOLD_MS, ...mark.context },
    });
  }
  return duration;
}

/**
 * 测量异步函数耗时
 */
export async function measure<T>(
  name: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>,
): Promise<T> {
  const m = start(name, context);
  try {
    return await fn();
  } finally {
    end(m);
  }
}

/**
 * 测量同步函数耗时
 */
export function measureSync<T>(name: string, fn: () => T, context?: Record<string, unknown>): T {
  const m = start(name, context);
  try {
    return fn();
  } finally {
    end(m);
  }
}

export const perf = { start, end, measure, measureSync };
