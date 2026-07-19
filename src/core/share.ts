/**
 * 通用分享 / 导入协议
 *
 * @author zhuzc
 * @date 2026-06-22
 *
 * 把数据编码为可复制字符串（带前缀校验），方便跨设备 / 跨用户分享：
 *   pindou:v1:<base64-json>
 *
 * 支持三种类型：
 *   - 'beadgrid'  ：图纸（cells + 尺寸 + 色板 id）
 *   - 'template'   ：模板（id + name + 尺寸 + cells）
 *   - 'palette'    ：色板（id + name + entries）
 *
 * 字符串最大长度约 50KB（base64 + JSON）。超长数据用文件分享（V3）。
 */

export type ShareType = 'beadgrid' | 'template' | 'palette';

export interface SharePayload {
  type: ShareType;
  version: 1;
  /** 类型相关数据（JSON-serializable） */
  data: unknown;
  /** 创建时间戳（ms） */
  createdAt: number;
}

const PREFIX = 'pindou:v1:';

/**
 * 编码为可复制字符串
 */
export function encodeShare(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  // base64（兼容中文）
  const b64 = base64Encode(json);
  return `${PREFIX}${b64}`;
}

/**
 * 解码共享字符串（带类型守卫）
 */
export function decodeShare<T extends ShareType = ShareType>(text: string): SharePayload | null {
  if (!text.startsWith(PREFIX)) return null;
  try {
    const b64 = text.slice(PREFIX.length).trim();
    const json = base64Decode(b64);
    const payload = JSON.parse(json) as SharePayload;
    if (typeof payload !== 'object' || payload === null) return null;
    if (payload.version !== 1) return null;
    if (!['beadgrid', 'template', 'palette'].includes(payload.type)) return null;
    return payload as SharePayload & { type: T };
  } catch {
    return null;
  }
}

/**
 * 从任意文本中尝试提取 pindou 分享码
 *
 * 如果整段文本都是分享码 → 返回
 * 如果文本包含分享码（前后有其他内容）→ 提取第一个
 * 否则返回 null
 */
export function extractShare(text: string): SharePayload | null {
  if (!text) return null;
  const trimmed = text.trim();
  // 1) 整段就是分享码
  const direct = decodeShare(trimmed);
  if (direct) return direct;
  // 2) 文本中包含分享码（找 pindou:v1:... 子串）
  const idx = trimmed.indexOf(PREFIX);
  if (idx < 0) return null;
  const end = trimmed.indexOf(' ', idx);
  const candidate = end > 0 ? trimmed.substring(idx, end) : trimmed.substring(idx);
  return decodeShare(candidate);
}

/* ========== 工具函数 ========== */

/** UTF-8 安全 base64 编码 */
function base64Encode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf8').toString('base64');
  }
  // 浏览器 fallback
  return btoa(unescape(encodeURIComponent(str)));
}

/** UTF-8 安全 base64 解码 */
function base64Decode(b64: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64, 'base64').toString('utf8');
  }
  return decodeURIComponent(escape(atob(b64)));
}