import type { PlatformCapability } from '@/data/platform-navigation'

export interface RouteCompatibility {
  supported: boolean
  featureName?: string
  reason?: string
  redirectUrl: string
  suggestedPlatform?: { code: string; name: string }
}

/** 直播专属路由（需要 supportsLive = true） */
export const LIVE_ONLY_ROUTES: Record<string, string> = {
  '/ops/capabilities': '能力看板（主播能力评估）',
  '/anchors/list': '主播列表',
  '/anchors/profile': '主播档案',
  '/anchors/schedule': '排班管理',
  '/anchors/schedule-recommend': 'AI智能排班',
  '/ops/script-library': '话术模板',
  '/ops/room-health': '直播间健康度',
  '/ops/session-products': '场次排品',
  '/system/multi-room': '多直播间总览',
  '/live/attendance': '个人达成',
  '/live/registration': '直播登记',
  '/live/data': '登记数据管理',
  '/overview/live-monitor': '实时监控',
  '/overview/cockpit': '运营驾驶舱',
  '/review/overview': '复盘总览',
  '/review/products': '商品分析',
  '/review/short-videos': '短视频引流',
  '/review/channels': '渠道流量分析',
  '/review/anchors': '主播效能分析',
  '/review/funnel': '转化漏斗',
  '/review/closed-loop': '改进闭环',
}

/**
 * 各平台专属路由定义
 */
export const PLATFORM_EXCLUSIVE_ROUTES: Record<string, { platformName: string; validCodes: string[] }> = {
  '/shop/kuaishou/traffic-split': { platformName: '快手', validCodes: ['kuaishou'] },
  '/shop/kuaishou/indirect-gmv': { platformName: '快手', validCodes: ['kuaishou'] },
}

/** 内容电商专属路由 */
export const CONTENT_EXCLUSIVE_ROUTES: Record<string, string> = {}

/** 获取各平台的默认落地页 */
export function getDefaultRouteForPlatform(_platformCode?: string | null): string {
  return '/overview/home'
}

/** 检查路由与平台是否兼容 */
export function checkRoutePlatformCompatibility(
  pathname: string,
  platformCode?: string | null,
  capabilities?: PlatformCapability | null,
  platformName?: string
): RouteCompatibility {
  const defaultRedirect = getDefaultRouteForPlatform(platformCode)
  const currentName = platformName || (
    platformCode === 'douyin' ? '抖音电商' :
      platformCode === 'kuaishou' ? '快手电商' :
        platformCode === 'wechat' ? '微信视频号' : '当前平台'
  )

  // 1. 检查平台专属页面约束
  const exclusive = PLATFORM_EXCLUSIVE_ROUTES[pathname]
  if (exclusive && platformCode && !exclusive.validCodes.includes(platformCode)) {
    return {
      supported: false,
      featureName: pathname,
      reason: `该页面为「${exclusive.platformName}」专属功能，当前选择的平台为「${currentName}」。`,
      redirectUrl: defaultRedirect,
      suggestedPlatform: {
        code: exclusive.validCodes[0],
        name: exclusive.platformName,
      },
    }
  }

  // 2. 检查直播专属业务（需 supportsLive = true）
  const liveFeature = LIVE_ONLY_ROUTES[pathname]
  if (liveFeature) {
    // 若当前平台明确声明不支持直播
    if (capabilities && capabilities.supportsLive === false) {
      return {
        supported: false,
        featureName: liveFeature,
        reason: `「${liveFeature}」属于直播电商业态（核心管理直播间、场次与主播）。当前平台「${currentName}」不涉及主播运营业务。`,
        redirectUrl: defaultRedirect,
        suggestedPlatform: {
          code: 'douyin',
          name: '抖音电商',
        },
      }
    }
  }

  // 3. 检查内容专属业务
  const contentFeature = CONTENT_EXCLUSIVE_ROUTES[pathname]
  if (contentFeature && capabilities && capabilities.supportsContent === false) {
    return {
      supported: false,
      featureName: contentFeature,
      reason: `「${contentFeature}」属于内容种草业态，当前平台「${currentName}」不支持该内容分析。`,
      redirectUrl: defaultRedirect,
      suggestedPlatform: {
        code: 'douyin',
        name: '抖音电商',
      },
    }
  }

  return {
    supported: true,
    redirectUrl: defaultRedirect,
  }
}
