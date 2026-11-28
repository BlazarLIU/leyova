import { BaseCollector, type RulePage } from './base.js'
import { isUsableContent, renderPublicPage } from './browser.js'

/**
 * 抖音电商规则采集器
 *
 * 数据源：抖音电商学习中心 → 规则中心（公网可访问的公开规则页）
 *   https://school.jinritemai.com/doudian/web/rules
 *
 * 抓取方式：无头 Chromium 渲染 SPA 后提取正文。
 * 注意：店铺后台专属规则仍需登录，不在抓取范围，走人工录入。
 */
export class DouyinCollector extends BaseCollector {
  readonly platformCode = 'douyin'

  private static readonly LIST_URLS = [
    'https://school.jinritemai.com/doudian/web/rules',
    'https://school.jinritemai.com/doudian/web/rules?from=shop_rule',
  ]

  private static readonly RULE_URL = /^https:\/\/school\.jinritemai\.com\/doudian\/web\/(article|rules?)\/[A-Za-z0-9_-]+/

  async discover(): Promise<Array<{ url: string; externalId?: string }>> {
    if (process.env.NODE_ENV === 'test') {
      return [
        { url: 'https://school.jinritemai.com/doudian/web/article/fixture-dy-1', externalId: 'fixture-dy-1' },
        { url: 'https://school.jinritemai.com/doudian/web/article/fixture-dy-2', externalId: 'fixture-dy-2' },
      ]
    }
    const seen = new Set<string>()
    const found: Array<{ url: string; externalId?: string }> = []

    for (const listUrl of DouyinCollector.LIST_URLS) {
      const page = await renderPublicPage(listUrl)
      if (!page) continue
      for (const link of page.links) {
        if (!DouyinCollector.RULE_URL.test(link.url)) continue
        const externalId = this.externalIdOf(link.url)
        if (seen.has(externalId)) continue
        seen.add(externalId)
        found.push({ url: link.url, externalId })
        if (found.length >= 40) return found
      }
    }
    return found
  }

  async fetch(url: string, externalId?: string): Promise<RulePage | null> {
    // 测试环境不发起外网请求，用固定夹具验证「新规 → 变更」闭环
    if (process.env.NODE_ENV === 'test') {
      const id = externalId || 'fixture-dy-1'
      const contentText = `抖音电商规则测试夹具 ${id}：关于直播间商品信息发布规范的公告。商品标题、主图与详情页信息须保持一致，禁止虚假宣传与诱导交易，违规将按平台规则处置。`
      return {
        platformCode: this.platformCode,
        sourceUrl: url,
        externalId: id,
        title: '直播间商品信息发布规范（测试夹具）',
        category: this.inferCategory('直播间商品信息发布规范'),
        publishedAt: new Date('2026-11-20T00:00:00Z'),
        contentText,
        contentHash: this.computeHash(contentText),
        fetchMethod: 'manual',
        fetchedAt: new Date(),
        rawMetadata: { test: true },
      }
    }
    const page = await renderPublicPage(url)
    if (!page || !isUsableContent(page.text)) return null

    const title = page.title || '抖音电商规则更新'
    return {
      platformCode: this.platformCode,
      sourceUrl: page.url,
      externalId: externalId || this.externalIdOf(url),
      title,
      category: this.inferCategory(title),
      publishedAt: this.detectDate(page.text),
      contentText: page.text,
      contentHash: this.computeHash(page.text),
      fetchMethod: 'headless',
      fetchedAt: new Date(),
      rawMetadata: { channel: 'jinritemai_rules' },
    }
  }
}
