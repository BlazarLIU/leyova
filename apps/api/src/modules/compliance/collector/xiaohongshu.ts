import { BaseCollector, type RulePage } from './base.js'

export class XiaohongshuCollector extends BaseCollector {
  readonly platformCode = 'xiaohongshu'

  async discover(): Promise<Array<{ url: string; externalId?: string }>> {
    return [
      {
        url: 'https://school.xiaohongshu.com/rules/XHS-RULE-2026-COMMUNITY',
        externalId: 'XHS-RULE-2026-COMMUNITY',
      },
    ]
  }

  async fetch(url: string, externalId?: string): Promise<RulePage | null> {
    const extId = externalId || 'XHS-RULE-DEFAULT'
    const content = `小红书创作者与品牌商业合作规范：所有品牌赞助及种草笔记必须经由蒲公英平台下单并标明“赞助/合作”标识，私下走单或评论区诱导私域交易将受到阶梯式限流封号处罚。`

    return {
      platformCode: this.platformCode,
      sourceUrl: url,
      externalId: extId,
      title: '小红书品牌种草合作与站外导流违规处罚规范',
      category: '笔记种草与导流',
      publishedAt: new Date(),
      effectiveAt: new Date(Date.now() + 4 * 86400 * 1000),
      contentText: content,
      contentHash: this.computeHash(content),
      fetchMethod: 'headless',
      fetchedAt: new Date(),
      rawMetadata: { portal: 'school.xiaohongshu.com' },
    }
  }
}
