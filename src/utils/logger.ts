/**
 * 分级日志
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * DEV 环境打印 DEBUG/INFO/WARN，PROD 仅打印 ERROR。
 * Vitest 环境默认静默。
 * error() 自动上报到错误埋点（W25）。
 */

import { reportError } from './error-reporter';

/** 是否启用 debug/info/warn 日志 */
function isEnabled(): boolean {
  // Node 环境（Vitest/构建脚本）默认开启
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV !== 'production';
  }
  // 小程序/H5 环境：未打包为 production 时开启
  return true;
}

const ENABLED = isEnabled();

function format(level: string, args: unknown[]): unknown[] {
  const time = new Date().toISOString().substring(11, 23);
  return [`[${time}][${level}][pindou]`, ...args];
}

export const logger = {
  /** 调试日志，仅 DEV 可见 */
  debug(...args: unknown[]): void {
    if (ENABLED) {
      // eslint-disable-next-line no-console
      console.debug(...format('DEBUG', args));
    }
  },
  /** 信息日志，仅 DEV 可见 */
  info(...args: unknown[]): void {
    if (ENABLED) {
      // eslint-disable-next-line no-console
      console.info(...format('INFO', args));
    }
  },
  /** 警告日志，仅 DEV 可见 */
  warn(...args: unknown[]): void {
    if (ENABLED) {
      // eslint-disable-next-line no-console
      console.warn(...format('WARN', args));
    }
  },
  /** 错误日志，所有环境可见 + 自动上报 */
  error(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.error(...format('ERROR', args));
    // 自动上报（异步，不阻塞）
    try {
      const message = args
        .map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a)))
        .join(' ');
      const err = args.find((a) => a instanceof Error) as Error | undefined;
      reportError({
        ts: Date.now(),
        message,
        stack: err?.stack,
      });
    } catch {
      // ignore
    }
  },
};
