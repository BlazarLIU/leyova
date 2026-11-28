import crypto from 'node:crypto'

export function timingSafeTokenEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function signMcpUserId(userId: number | string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`leyova-mcp-uid:${String(userId)}`).digest('hex')
}

export function verifyMcpUserSig(
  userId: number | string,
  providedSig: string | undefined,
  secret: string
): boolean {
  if (!providedSig || !secret) return false
  const expected = signMcpUserId(userId, secret)
  return timingSafeTokenEqual(providedSig.trim().toLowerCase(), expected)
}
