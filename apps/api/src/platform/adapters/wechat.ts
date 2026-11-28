import { GovernanceBackedPlatformAdapter } from './base.js'
import type { PlatformCapabilities } from '../types.js'

/**
 * 微信小店（视频号小店）
 *
 * 业务特征（相对抖音/快手）：
 *   1. 直播场域 = 视频号直播；交易载体 = 微信小店，二者分离
 *   2. 带货者体系：视频号橱窗达人可升级为「微信小店带货者」，在视频号/公众号/服务号/社群全域带货
 *   3. 流量结构：公域（视频号推荐）+ 私域（社群/朋友圈/公众号/搜一搜）混合，私域占比显著高于抖快
 *   4. 成交口径：微信小店只提供单一成交口径（订单实付），无抖店/快手的多口径分层
 *   5. 履约：发货时效以商家承诺为准，平台不设强制统一 SLA（<48h 需自行承诺）
 *
 * 官方 API：https://developers.weixin.qq.com/doc/store/shop/API/
 *   - 获取调用凭据      POST /cgi-bin/stable_token
 *   - 订单列表          POST /channels/ec/order/list/get   （仅返回 order_id_list）
 *   - 订单详情          POST /channels/ec/order/get
 *   - 商品列表          POST /channels/ec/product/list/get
 *   - 库存              POST /channels/ec/product/stock/get
 */
export class WechatAdapter extends GovernanceBackedPlatformAdapter {
  readonly platformCode = 'wechat'
  readonly platformName = '视频号小店'
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
        'kol', 'members', 'product_center',
      ],
    }
  }
}
