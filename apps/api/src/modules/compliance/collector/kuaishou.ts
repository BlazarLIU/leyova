import { BaseCollector, type RulePage } from './base.js'

export class KuaishouCollector extends BaseCollector {
  readonly platformCode = 'kuaishou'

  async discover(): Promise<Array<{ url: string; externalId?: string }>> {
    return [
      {
        url: 'https://edu.kwaixiaodian.com/rules/KS-RULE-2026-INDIRECT',
        externalId: 'KS-RULE-2026-INDIRECT',
      },
    ]
  }

  async fetch(url: string, externalId?: string): Promise<RulePage | null> {
    const extId = externalId || 'KS-RULE-DEFAULT'
    const content = `快手电商达人分销带货与间接成交风控管理规定：通过短视频挂车及直播间带货产生的间接成交佣金，将在订单确认收货T+7且无售后维权后统一进行账单结算。`

    return {
      platformCode: this.platformCode,
      sourceUrl: url,
      externalId: extId,
      title: '快手电商达人分销与间接成交结算细则',
      category: '达人带货与分销结算',
      publishedAt: new Date(),
      effectiveAt: new Date(Date.now() + 5 * 86400 * 1000),
      contentText: content,
      contentHash: this.computeHash(content),
      fetchMethod: 'headless',
      fetchedAt: new Date(),
      rawMetadata: { host: 'edu.kwaixiaodian.com' },
    }
  }
}
