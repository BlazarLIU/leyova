import { BaseCollector, type RulePage } from './base.js'

export class TaobaoCollector extends BaseCollector {
  readonly platformCode = 'taobao'

  async discover(): Promise<Array<{ url: string; externalId?: string }>> {
    return [
      {
        url: 'https://rulechannel.taobao.com/rules/TB-RULE-2026-LOGISTICS',
        externalId: 'TB-RULE-2026-LOGISTICS',
      },
      {
        url: 'https://rulechannel.tmall.com/rules/TM-RULE-2026-PRICE-PROTECT',
        externalId: 'TM-RULE-2026-PRICE-PROTECT',
      },
    ]
  }

  async fetch(url: string, externalId?: string): Promise<RulePage | null> {
    const extId = externalId || 'TB-RULE-DEFAULT'
    const title = extId.includes('PRICE')
      ? '天猫大促买贵必赔与价格保护实施细则'
      : '淘宝网发货履约规范与运费险赔付更新'
    const category = extId.includes('PRICE') ? '大促价格规范' : '发货履约SLA'
    const content = `淘宝与天猫商家须遵循最新消费体验保障方案。订单支付后48小时内须具备真实揽收记录。若大促期间出现价格下调，系统将自动支持买家一键保价并返还差价。`

    return {
      platformCode: this.platformCode,
      sourceUrl: url,
      externalId: extId,
      title,
      category,
      publishedAt: new Date(),
      effectiveAt: new Date(Date.now() + 7 * 86400 * 1000),
      contentText: content,
      contentHash: this.computeHash(content),
      fetchMethod: 'html_direct',
      fetchedAt: new Date(),
      rawMetadata: { scrapedDomain: 'rulechannel.taobao.com' },
    }
  }
}
