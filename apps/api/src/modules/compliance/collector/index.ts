import { DouyinCollector } from './douyin.js'
import { KuaishouCollector } from './kuaishou.js'
import { WechatCollector } from './wechat.js'
import type { Collector } from './base.js'

export * from './base.js'

// 仅保留核心三平台：抖音、快手、视频号
export function getAllCollectors(): Collector[] {
  return [
    new DouyinCollector(),
    new KuaishouCollector(),
    new WechatCollector(),
  ]
}
