import crypto from 'node:crypto'

export interface RulePage {
  platformCode: string
  sourceUrl: string
  externalId: string
  title: string
  category?: string
  publishedAt?: Date
  effectiveAt?: Date
  contentText: string
  contentHash: string
  fetchMethod: 'html_direct' | 'rss' | 'json_api' | 'headless' | 'manual'
  fetchedAt: Date
  rawMetadata?: Record<string, any>
}

export interface Collector {
  readonly platformCode: string
  discover(): Promise<Array<{ url: string; externalId?: string }>>
  fetch(url: string, externalId?: string): Promise<RulePage | null>
}

/**
 * 合规采集器抽象基类
 * 强制执行国家网络安全合规与平台服务条款红线：
 * 1. 严格不绕过任何登录墙与反爬挑战
 * 2. 严格不伪造鉴权凭据或商家身份
 * 3. 严格限制请求频率（礼貌抓取）
 * 4. 严格只抓取公开规则与公告页面
 */
export abstract class BaseCollector implements Collector {
  abstract readonly platformCode: string

  protected static readonly FORBIDDEN_RULES = [
    '不得向需要登录授权的接口注入或伪造 Cookie/Token',
    '遭遇 HTTP 302 重定向到 login 页或验证码页必须立即中断并转人工录入',
    '不得使用未经公开授权的私有加签接口',
    '严格单域单请求间隔 >= 1000ms',
  ]

  /**
   * 规范化纯文本并计算不可变 SHA-256 指纹
   */
  public computeHash(text: string): string {
    const normalized = text
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim()
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex')
  }

  /**
   * 检查是否命中登录拦截重定向
   */
  protected isLoginRedirect(responseUrl: string, status: number): boolean {
    if (status === 301 || status === 302 || status === 401 || status === 403) {
      if (/login|passport|auth|captcha|verify/i.test(responseUrl)) {
        return true
      }
    }
    return false
  }

  abstract discover(): Promise<Array<{ url: string; externalId?: string }>>
  abstract fetch(url: string, externalId?: string): Promise<RulePage | null>
}
