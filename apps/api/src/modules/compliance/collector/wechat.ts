import { BaseCollector, type RulePage } from './base.js'

/**
 * 视频号 / 微信小店 规则采集器
 *
 * 可行性结论（合规优先，不绕登录墙）：
 *   微信小店的规则与公告集中在「微信小店后台 → 规则中心」，视频号侧的带货规范集中在
 *   「视频号助手 → 规则中心」，两者均要求登录商家账号后可见，公网无稳定的服务端渲染入口。
 *   按 BaseCollector 的合规红线（不注入 Cookie/Token、不绕登录页、不伪造商家身份），
 *   本采集器不发起任何自动抓取，规则一律通过 `/api/v1/compliance/rules/manual` 人工录入。
 *
 * 与拼多多采集器保持同一策略：宁可「不抓」，也不用样例文本冒充真实抓取。
 */
export class WechatCollector extends BaseCollector {
  readonly platformCode = 'wechat'

  async discover(): Promise<Array<{ url: string; externalId?: string }>> {
    // 规则中心位于商家登录态内，不提供公开可抓取入口 → 返回空集，由人工录入兜底
    return []
  }

  async fetch(_url: string, _externalId?: string): Promise<RulePage | null> {
    // 不对登录墙后的页面发起任何请求
    return null
  }

  /** 供运维/运营参考的人工录入入口（不参与自动抓取） */
  static readonly MANUAL_ENTRY_NOTE =
    '微信小店规则：微信小店后台 → 规则中心；视频号带货规范：视频号助手 → 规则中心。请人工录入。'
}
