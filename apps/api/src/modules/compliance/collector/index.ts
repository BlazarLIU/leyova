import { TaobaoCollector } from './taobao.js'
import { DouyinCollector } from './douyin.js'
import { KuaishouCollector } from './kuaishou.js'
import { XiaohongshuCollector } from './xiaohongshu.js'
import { WechatCollector } from './wechat.js'
import type { Collector } from './base.js'

export * from './base.js'

// 京东/拼多多采集器已于 2026-11-14 随平台移除
// 视频号采集器不抓取（规则中心在商家登录态内），discover 返回空集，走人工录入
export function getAllCollectors(): Collector[] {
  return [
    new TaobaoCollector(),
    new DouyinCollector(),
    new KuaishouCollector(),
    new XiaohongshuCollector(),
    new WechatCollector(),
  ]
}
