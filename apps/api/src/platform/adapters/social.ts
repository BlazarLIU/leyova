import { GovernanceBackedPlatformAdapter } from './base.js'
import type { PlatformCapabilities } from '../types.js'

/**
 * 快手电商
 *
 * 差异化依据：私域关注页为核心，磁力聚星达人分销；
 * 站内搜索无量化卡位数据源 → search_seo 不适用
 */
export class KuaishouAdapter extends GovernanceBackedPlatformAdapter {
  readonly platformCode = 'kuaishou'
  readonly platformName = '快手电商'
  readonly category = 'live' as const

  getCapabilities(): PlatformCapabilities {
    return {
      supportsLive: true,
      supportsShelf: true,
      supportsContent: true,
      supportsAds: true,
      supportsAutoSync: true,
      supportsManualUpload: true,
      availableMetrics: [
        'gmv', 'pay_amount', 'paid_order_count', 'paid_buyer_count',
        'refund_amount', 'refund_rate', 'net_sales', 'ad_spend', 'roi',
        'traffic_views', 'click_count', 'ctr', 'gpm',
      ],
      supportedModules: [
        'overview', 'session', 'session_products', 'live_registration', 'live_data',
        'review', 'review_overview', 'review_channels', 'anchor',
        'bi', 'ops', 'content', 'content_schedule', 'net_roi',
        'kol', 'members', 'system_multiroom', 'product_center',
      ],
    }
  }
}
