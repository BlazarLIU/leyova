import { BaseCollector, type RulePage } from './base.js'
import { isUsableContent, postJsonViaBrowser, renderPublicPage } from './browser.js'

interface KuaishouRuleItem {
  resourceId?: string
  title?: string
  publishTime?: number
  content?: string
}

interface KuaishouListResponse {
  result?: number
  data?: { list?: KuaishouRuleItem[] }
}

const CACHE_TTL_MS = 10 * 60 * 1000

let cache: { at: number; items: KuaishouRuleItem[] } | null = null

/** 去掉内联样式/脚本后把 HTML 正文转纯文本 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 快手电商规则采集器
 *
 * 数据源：快手电商学习中心 · 规则中心（公网可访问）
 *   列表页 https://edu.kwaixiaodian.com/rule/web/index
 *   详情页 https://edu.kwaixiaodian.com/rule/web/detail?resourceId=xxx
 *
 * 该站列表项不是 <a> 链接，且详情页不按 resourceId 渲染正文，
 * 正文其实随列表接口一起下发。因此：
 *   1. discover 复用浏览器上下文调用 gateway 的 resource/list/query；
 *   2. fetch 优先用该接口返回的 content HTML 转纯文本，缺失时回退渲染详情页。
 * 商家后台专属规则仍需登录，不在抓取范围。
 */
export class KuaishouCollector extends BaseCollector {
  readonly platformCode = 'kuaishou'

  private static readonly LIST_PAGE = 'https://edu.kwaixiaodian.com/rule/web/index'
  private static readonly LIST_API =
    'https://edu.kwaixiaodian.com/gateway/rest/pc/education/front/resource/list/query'
  private static readonly DETAIL_PAGE = 'https://edu.kwaixiaodian.com/rule/web/detail'

  private async queryList(): Promise<KuaishouRuleItem[]> {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.items
    const json = await postJsonViaBrowser<KuaishouListResponse>(
      KuaishouCollector.LIST_PAGE,
      KuaishouCollector.LIST_API,
      { deviceSource: 'pc', scene: 'RULE_LAST_RESOURCE' },
    )
    const items = json?.data?.list || []
    if (items.length > 0) cache = { at: Date.now(), items }
    return items
  }

  async discover(): Promise<Array<{ url: string; externalId?: string }>> {
    if (process.env.NODE_ENV === 'test') {
      return [
        { url: 'https://edu.kwaixiaodian.com/rule/web/detail?resourceId=fixture-ks-1', externalId: 'fixture-ks-1' },
        { url: 'https://edu.kwaixiaodian.com/rule/web/detail?resourceId=fixture-ks-2', externalId: 'fixture-ks-2' },
      ]
    }
    const items = await this.queryList()
    const seen = new Set<string>()
    const found: Array<{ url: string; externalId?: string }> = []
    for (const item of items) {
      const resourceId = String(item.resourceId || '').trim()
      if (!resourceId || seen.has(resourceId)) continue
      seen.add(resourceId)
      found.push({
        url: `${KuaishouCollector.DETAIL_PAGE}?resourceId=${encodeURIComponent(resourceId)}`,
        externalId: resourceId,
      })
      if (found.length >= 40) break
    }
    return found
  }

  async fetch(url: string, externalId?: string): Promise<RulePage | null> {
    // 测试环境不发起外网请求，用固定夹具验证「新规 → 变更」闭环
    if (process.env.NODE_ENV === 'test') {
      const id = externalId || 'fixture-ks-1'
      const contentText = `快手电商规则测试夹具 ${id}：关于达人分销结算与营销发票的公告。分销订单须在确认收货后按账期结算，退款订单不计入佣金，违规将按平台规则处置。`
      return {
        platformCode: this.platformCode,
        sourceUrl: url,
        externalId: id,
        title: '达人分销结算细则（测试夹具）',
        category: this.inferCategory('达人分销结算细则'),
        publishedAt: new Date('2026-11-21T00:00:00Z'),
        contentText,
        contentHash: this.computeHash(contentText),
        fetchMethod: 'manual',
        fetchedAt: new Date(),
        rawMetadata: { test: true },
      }
    }
    let title = ''
    let contentText = ''
    let publishedAt: Date | undefined

    const id = externalId || this.externalIdOf(url)
    const item = (await this.queryList()).find((it) => String(it.resourceId || '') === id)
    if (item) {
      title = (item.title || '').trim()
      contentText = htmlToText(item.content || '').slice(0, 8000)
      if (item.publishTime) publishedAt = new Date(Number(item.publishTime))
    }

    // 接口未下发正文时回退渲染公开详情页
    if (!isUsableContent(contentText)) {
      const page = await renderPublicPage(url)
      if (!page || !isUsableContent(page.text)) return null
      contentText = page.text
      title = title || page.title
    }

    title = title || '快手电商规则更新'
    return {
      platformCode: this.platformCode,
      sourceUrl: url,
      externalId: id,
      title,
      category: this.inferCategory(title),
      publishedAt: publishedAt || this.detectDate(contentText),
      contentText,
      contentHash: this.computeHash(contentText),
      fetchMethod: 'headless',
      fetchedAt: new Date(),
      rawMetadata: { host: 'edu.kwaixiaodian.com' },
    }
  }
}
