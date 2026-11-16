import type { PlatformAdapter, PlatformCapabilities } from './types.js'
import { DouyinAdapter } from './adapters/douyin.js'
import { TaobaoAdapter, TmallAdapter } from './adapters/taobao.js'
import { KuaishouAdapter, XiaohongshuAdapter } from './adapters/social.js'
import { WechatAdapter } from './adapters/wechat.js'

class PlatformRegistry {
  private adapters = new Map<string, PlatformAdapter>()

  constructor() {
    this.register(new DouyinAdapter())
    this.register(new KuaishouAdapter())
    this.register(new WechatAdapter())
    this.register(new TaobaoAdapter())
    this.register(new TmallAdapter())
    this.register(new XiaohongshuAdapter())
  }

  register(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platformCode, adapter)
  }

  get(platformCode: string): PlatformAdapter | undefined {
    return this.adapters.get(platformCode)
  }

  getAll(): PlatformAdapter[] {
    return Array.from(this.adapters.values())
  }

  getCapabilities(platformCode: string): PlatformCapabilities | null {
    const adapter = this.get(platformCode)
    return adapter ? adapter.getCapabilities() : null
  }
}

export const platformRegistry = new PlatformRegistry()
export * from './types.js'

