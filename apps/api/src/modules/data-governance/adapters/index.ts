/**
 * adapters/index.ts — 5 大平台适配器注册中心（京东/拼多多已于 2026-11-14 移除）
 */

import { PlatformAdapterContract } from './base-adapter.js'
import {
  DouyinGovernanceAdapter,
  KuaishouGovernanceAdapter,
  TaobaoGovernanceAdapter,
  TmallGovernanceAdapter,
  XiaohongshuGovernanceAdapter,
  WechatGovernanceAdapter,
} from './platform-adapters.js'

export * from './base-adapter.js'
export * from './platform-adapters.js'

class PlatformGovernanceRegistry {
  private adapters = new Map<string, PlatformAdapterContract>()

  constructor() {
    this.register(new DouyinGovernanceAdapter())
    this.register(new KuaishouGovernanceAdapter())
    this.register(new WechatGovernanceAdapter())
    this.register(new TaobaoGovernanceAdapter())
    this.register(new TmallGovernanceAdapter())
    this.register(new XiaohongshuGovernanceAdapter())
  }

  register(adapter: PlatformAdapterContract) {
    this.adapters.set(adapter.platformCode, adapter)
  }

  get(platformCode: string): PlatformAdapterContract | undefined {
    return this.adapters.get(platformCode)
  }

  getAll(): PlatformAdapterContract[] {
    return Array.from(this.adapters.values())
  }

  getTechnicalSpec(platformCode: string) {
    const adapter = this.adapters.get(platformCode)
    if (!adapter) return null
    return {
      platformCode: adapter.platformCode,
      platformName: adapter.platformName,
      gatewayUrl: adapter.gatewayUrl,
      docUrl: adapter.docUrl,
    }
  }
}

export const governancePlatformRegistry = new PlatformGovernanceRegistry()

