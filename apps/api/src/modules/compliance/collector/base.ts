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

  /**
   * 从标题推断规则分类（平台页面字段结构不稳定，按关键词归一）
   */
  protected inferCategory(title: string): string {
    if (/违规|处罚|扣分|封禁|治理|红线/.test(title)) return '违规处置'
    if (/结算|佣金|账期|资金|发票/.test(title)) return '结算合规'
    if (/资质|准入|许可|备案|类目/.test(title)) return '资质准入'
    if (/履约|发货|物流|售后|退款|退货|SLA/.test(title)) return '履约与售后'
    if (/营销|促销|价格|直播|话术/.test(title)) return '营销合规'
    return '通用规则'
  }

  /**
   * 从正文中提取首个「2026年11月24日 / 2026-11-24」形态的日期
   */
  protected detectDate(text: string): Date | undefined {
    const m = text.match(/(20\d{2})\s*[年\-/.]\s*(\d{1,2})\s*[月\-/.]\s*(\d{1,2})/)
    if (!m) return undefined
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return isNaN(d.getTime()) ? undefined : d
  }

  /**
   * 从规则详情 URL 中提取稳定的外部 ID，取不到则用链接哈希兜底
   */
  protected externalIdOf(url: string): string {
    const m = url.match(/(?:article|detail|rules?)[/?#](?:id=)?([A-Za-z0-9_-]{4,})/)
    if (m) return m[1]
    return crypto.createHash('sha1').update(url).digest('hex').slice(0, 16)
  }

  abstract discover(): Promise<Array<{ url: string; externalId?: string }>>
  abstract fetch(url: string, externalId?: string): Promise<RulePage | null>
}
