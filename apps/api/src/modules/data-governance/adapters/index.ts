/**
 * adapters/index.ts — 核心 3 平台适配器注册中心（抖音 / 快手 / 视频号）
 */

import { PlatformAdapterContract } from './base-adapter.js'
import {
  DouyinGovernanceAdapter,
  KuaishouGovernanceAdapter,
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

