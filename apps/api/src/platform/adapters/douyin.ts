import { GovernanceBackedPlatformAdapter } from './base.js'
import type { PlatformCapabilities } from '../types.js'

/**
 * 抖音电商
 *
 * 差异化依据（均为官方在营产品）：
 *   · 三池流量（直播/短视频/商城）→ review_channels 必须有专属口径
 *   · 精选联盟达人分销 → kol 适用
 *   · 巨量千川站内搜索广告 → search_seo 适用
 *   · 商家多直播间矩阵 → system_multiroom 适用
 */
export class DouyinAdapter extends GovernanceBackedPlatformAdapter {
  readonly platformCode = 'douyin'
  readonly platformName = '抖音电商'
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
        'search_seo', 'kol', 'members', 'system_multiroom', 'product_center',
      ],
    }
  }
}