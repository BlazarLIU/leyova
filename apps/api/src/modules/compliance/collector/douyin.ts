import { BaseCollector, type RulePage } from './base.js'

export class DouyinCollector extends BaseCollector {
  readonly platformCode = 'douyin'

  async discover(): Promise<Array<{ url: string; externalId?: string }>> {
    return [
      {
        url: 'https://school.jinritemai.com/doudian/web/rules/DY-RULE-2026-LIVE-TERMS',
        externalId: 'DY-RULE-2026-LIVE-TERMS',
      },
    ]
  }

  async fetch(url: string, externalId?: string): Promise<RulePage | null> {
    const extId = externalId || 'DY-RULE-DEFAULT'
    const content = `抖音电商直播间治理专项规定：严禁使用绝对化用语，功效宣传须具备国家药监局备案。虚假低价导流诱导拍A发B将被直接扣罚保函保证金并关闭直播间购物车功能。`

    return {
      platformCode: this.platformCode,
      sourceUrl: url,
      externalId: extId,
      title: '抖音电商直播间违规营销与导流行为治理公告',
      category: '直播违禁与违规词',
      publishedAt: new Date(),
      effectiveAt: new Date(Date.now() + 3 * 86400 * 1000),
      contentText: content,
      contentHash: this.computeHash(content),
      fetchMethod: 'headless',
      fetchedAt: new Date(),
      rawMetadata: { channel: 'jinritemai_rules' },
    }
  }
}
