export type PlatformCategory = 'live' | 'shelf' | 'content'

export interface PlatformConfig {
  platformCode: string
  platformName: string
  category: PlatformCategory
  isEnabled: boolean
  sortOrder: number
  icon?: string
  apiConfig?: Record<string, any>
}

export interface PlatformCapabilities {
  supportsLive: boolean
  supportsShelf: boolean
  supportsContent: boolean
  supportsAds: boolean
  supportsAutoSync: boolean
  supportsManualUpload: boolean
  availableMetrics: string[]
  supportedModules: string[]
}

export interface StandardTradeRecord {
  bizDate: string
  platformCode: string
  shopId: number
  channelName?: string
  gmv: number
  payAmount: number
  paidOrderCount: number
  paidBuyerCount: number
  refundAmount: number
  refundCount?: number
  source: 'api' | 'manual'
  extra?: Record<string, any>
}

export interface StandardTrafficRecord {
  bizDate: string
  platformCode: string
  shopId: number
  channelName?: string
  impressions: number
  clicks: number
  visitors: number
  avgStaySeconds?: number
  source: 'api' | 'manual'
  extra?: Record<string, any>
}

export interface PlatformAdapter {
  readonly platformCode: string
  readonly platformName: string
  readonly category: PlatformCategory

  getCapabilities(): PlatformCapabilities

  getAuthUrl?(redirectUri: string, state: string): Promise<string>
  exchangeToken?(code: string): Promise<Record<string, any>>
  refreshToken?(refreshToken: string): Promise<Record<string, any>>

  fetchTradeData?(shopId: number, sinceWatermark: string): Promise<StandardTradeRecord[]>
  fetchTrafficData?(shopId: number, sinceWatermark: string): Promise<StandardTrafficRecord[]>
}

