/**
 * platform-dedicated.ts — 平台专属洞察（已按平台拆分）
 *
 * 2026-11-17 P2-1：原 948 行单文件按平台拆为 4 个子路由：
 *   - insights-douyin.ts        抖音（三池统一调度）
 *   - insights-taobao.ts        淘系（直播三源 / 品牌×场次 / 五层抵扣 / 官方立减联动）
 *   - insights-xiaohongshu.ts   小红书（买手画像 / 蒲公英达人 / 直播流量来源）
 *   - insights-wechat.ts        视频号（全域带货者 / 短视频与公众号图文）
 *
 * 共用类型与工具（Align / Column / Kpi / TableBlock / insightRange / num / ym）
 * 已抽到 lib/insight-utils.ts。
 *
 * 本文件保留仅为兼容既有 import 路径，不再注册任何路由。
 */

export {}
