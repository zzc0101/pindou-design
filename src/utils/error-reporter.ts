/**
 * 错误埋点（全局错误捕获 + 集中上报）
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 集成点：
 *   1. App.vue onLaunch 调用 initErrorReporter()
 *   2. utils/logger.ts error() 自动调用 reportError()
 *   3. 错误存入本地缓存（最多 50 条），方便用户反馈时附带
 *
 * 上报通道（占位）：可后续接入云函数 / 微信小程序 wx.reportMonitor
 */

const ERROR_LOG_KEY = 'pindou:error-log';
const MAX_ERRORS = 50;

export interface ErrorRecord {
  ts: number;
  message: string;
  stack?: string;
  page?: string;
  extra?: Record<string, unknown>;
}

/**
 * 初始化全局错误监听（uni.onError + Promise unhandledrejection）
 */
export function initErrorReporter(): void {
  if (typeof uni === 'undefined') return;
  // #ifdef MP-WEIXIN
  uni.onError((err: string) => {
    reportError({ ts: Date.now(), message: err });
  });
  // #endif
  // #ifdef MP-TOUTIAO
  uni.onError?.((err: string) => {
    reportError({ ts: Date.now(), message: err });
  });
  // #endif
  // 全局 Promise 错误（Node 环境 / 部分小程序支持）
  if (typeof globalThis !== 'undefined' && (globalThis as { addEventListener?: unknown }).addEventListener) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).addEventListener?.('unhandledrejection', (event: { reason: unknown }) => {
      const reason = event.reason as Error;
      reportError({
        ts: Date.now(),
        message: reason?.message ?? String(event.reason),
        stack: reason?.stack,
      });
    });
  }
}

/**
 * 上报错误（保存到本地，可选上报到云）
 */
export function reportError(record: ErrorRecord): void {
  if (typeof uni === 'undefined') return;
  try {
    const existing = readErrorLog();
    existing.unshift(record);
    if (existing.length > MAX_ERRORS) existing.length = MAX_ERRORS;
    uni.setStorageSync(ERROR_LOG_KEY, JSON.stringify(existing));
  } catch {
    // 静默
  }
  // 开发环境：console.error
  // eslint-disable-next-line no-console
  console.error('[pindou error]', record.message, record.stack);
}

/**
 * 通用 try/catch 包装（错误自动上报）
 *
 * @returns [err, result] 元组，调用方按需解构
 */
export async function safeAsync<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<[Error | null, T | null]> {
  try {
    const result = await fn();
    return [null, result];
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    reportError({
      ts: Date.now(),
      message: `safeAsync: ${name}: ${err.message}`,
      stack: err.stack,
    });
    return [err, null];
  }
}

/**
 * 同步 try/catch 包装
 */
export function safeSync<T>(name: string, fn: () => T): [Error | null, T | null] {
  try {
    return [null, fn()];
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    reportError({
      ts: Date.now(),
      message: `safeSync: ${name}: ${err.message}`,
      stack: err.stack,
    });
    return [err, null];
  }
}

export function readErrorLog(): ErrorRecord[] {
  if (typeof uni === 'undefined') return [];
  try {
    const raw = uni.getStorageSync(ERROR_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw as string) as ErrorRecord[];
  } catch {
    return [];
  }
}

/**
 * 错误日志 → 复制友好的纯文本（用于用户反馈）
 */
export function formatErrorLog(records: ErrorRecord[]): string {
  return records
    .slice(0, 20)
    .map(
      (r) =>
        `${new Date(r.ts).toISOString().substring(0, 19)}  ${r.message}${
          r.stack ? '\n  ' + r.stack.split('\n')[1]?.trim() : ''
        }`,
    )
    .join('\n\n');
}

export function clearErrorLog(): void {
  if (typeof uni === 'undefined') return;
  try {
    uni.removeStorageSync(ERROR_LOG_KEY);
  } catch {
    // ignore
  }
}
