/**
 * ai/payload-digest.ts — 审批 payload 稳定摘要
 *
 * 同一 payload 无论对象键顺序如何，都必须得到同一 SHA-256 摘要，
 * 用于审批前的防篡改校验与执行前 revalidation。
 * 单独成文件避免 tool-registry ↔ approvals 的循环依赖。
 */

import { createHash } from 'node:crypto'

/** 稳定序列化：对象键排序，数组保持顺序 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

/** 审批 payload 摘要：用于批准前重校验，防止审批后被篡改 */
export function computePayloadDigest(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex')
}
