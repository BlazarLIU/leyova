/**
 * security.ts — 数据治理安全核心工具集
 * 
 * 1. API 凭证对称加密/解密 (AES-256-GCM)
 * 2. 凭证日志/页面展示脱敏
 * 3. CSV / 导出文本公式注入防护 (防 =, +, -, @ 注入执行)
 * 4. 文件与报文 SHA-256 哈希计算
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const DEV_FALLBACK_KEY = 'leyova-data-governance-secret-key-32chars!!'

/** 生成固定 32 字节密钥（生产环境强制要求配置独立 API_ENCRYPTION_KEY） */
function getDerivedKey(): Buffer {
  const raw = (process.env.API_ENCRYPTION_KEY || '').trim()
  if (process.env.NODE_ENV === 'production' && (!raw || raw === DEV_FALLBACK_KEY || raw.length < 32)) {
    throw new Error('生产环境必须配置至少 32 字符的独立 API_ENCRYPTION_KEY，严禁使用源码默认密钥')
  }
  return crypto.createHash('sha256').update(raw || DEV_FALLBACK_KEY).digest()
}

/**
 * 加密敏感文本 (如 AppSecret / AccessToken / RefreshToken)
 * 返回格式: "ivHex:authTagHex:encryptedHex"
 */
export function encryptCredential(plainText: string): string {
  if (!plainText) return ''
  const iv = crypto.randomBytes(16)
  const key = getDerivedKey()
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

/**
 * 解密敏感文本
 */
export function decryptCredential(cipherPayload: string): string {
  if (!cipherPayload) return ''
  const parts = cipherPayload.split(':')
  if (parts.length !== 3) {
    // 若不是加密格式，返回原样（向下兼容存量明文）
    return cipherPayload
  }
  
  try {
    const [ivHex, authTagHex, encryptedHex] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const key = getDerivedKey()
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    console.error('Failed to decrypt credential:', err)
    return ''
  }
}

/**
 * 敏感字符串脱敏 (保留前 4 位和后 4 位，其余替换为 *)
 */
export function maskCredential(val?: string | null): string {
  if (!val) return ''
  const s = String(val).trim()
  if (s.length <= 8) return '****'
  return `${s.slice(0, 4)}****${s.slice(-4)}`
}

/**
 * CSV / 导出文本公式注入防护
 * 规范要求：对以 =, +, -, @ 开头的用户文本做安全前缀转义
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value).trim()
  // 排除纯有效数值 (含负数，如 -199.00，避免将合法负数误认为公式注入)
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return str
  }
  if (/^[=+\-@\t\r\n]/.test(str)) {
    return `'${str}`
  }
  return str
}

/**
 * 计算 Buffer 或字符串的 SHA-256 哈希
 */
export function computeSha256(content: Buffer | string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}
