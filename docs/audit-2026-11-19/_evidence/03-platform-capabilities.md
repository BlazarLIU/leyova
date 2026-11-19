# 平台能力与切换机制实测（2026-11-19）

## 1. 后端适配器 capabilities（apps/api/src/platform/adapters/*.ts）
6 个平台适配器的 getCapabilities() 返回值：
| 平台 | supportsLive | supportsShelf | supportsContent | supportsAds | supportsAutoSync | supportsManualUpload |
|---|---|---|---|---|---|---|
| douyin | true | true | true | true | true | true |
| kuaishou | true | true | true | true | true | true |
| taobao | true | true | true | true | true | true |
| tmall | true | true | true | true | true | true |
| wechat | true | true | true | true | true | true |
| xiaohongshu | true | true | true | true | true | true |

→ **完全同构，零差异**。`category` 字段有差异（douyin/kuaishou/wechat=live，taobao/tmall=shelf，xiaohongshu=content），
但 `getCapabilities()` 不返回 category，前端拿不到。

## 2. 实测 GET /api/v1/platforms（admin 登录态）
```
douyin       enabled=True permitted=True live=True shelf=True content=True ads=True shops=5
kuaishou     enabled=True permitted=True live=True shelf=True content=True ads=True shops=3
wechat       enabled=True permitted=True live=True shelf=True content=True ads=True shops=5
taobao       enabled=True permitted=True live=True shelf=True content=True ads=True shops=3
tmall        enabled=True permitted=True live=True shelf=True content=True ads=True shops=3
jd           enabled=False ... shops=0
pdd          enabled=False ... shops=0
xiaohongshu  enabled=True permitted=True live=True shelf=True content=True ads=True shops=3
```

## 3. platform_capability_matrix（DB）
```sql
select count(*) total, count(*) filter (where is_applicable) app from platform_capability_matrix;
-- 198 | 198
```
**198 行全部 is_applicable = true，0 行 false。**

根因：迁移 `133_fix_live_capability_and_dedicated.sql:29-45` 按老大「只做直播电商」的决策，
把直播域 12 个模块（session/session_products/personal_achievement/live_registration/live_data/
review/review_overview/review_anchors/review_funnel/review_closed_loop/system_multiroom/anchor）
对所有启用平台一律 `SET is_applicable = true`。
更早的迁移 128 是按 `p.category = 'live'` 条件插入的（非直播平台为 false），被 133 覆盖。

## 4. 实测 /auth/me 的 modulesByPlatform（hr_li 登录态）
```json
"modulesByPlatform": {
  "douyin": [...18个...], "kuaishou": [...], "wechat": [...],
  "taobao": [...], "tmall": [...], "xiaohongshu": [...]
}
```
**六个平台的模块集合逐字节相同（各 18 个）。**

→ 后端平台维度模块过滤（`access-resolver.ts:127-144`）实际是 no-op。

## 5. 前端平台门禁（apps/web/src/hooks/usePlatform.tsx:31-50, 116-122）
`LIVE_ONLY_MODULES` 18 个模块码，门禁条件：
```ts
if (!currentPlatform.capabilities?.supportsLive && LIVE_ONLY_MODULES.has(moduleCode)) return false
```
由于所有平台 `supportsLive = true`，**该门禁永不触发**。

## 6. resolvePlatformMode（apps/web/src/data/platform-navigation.ts:35-46）
```ts
if (cap.supportsLive) return 'live'   // 所有平台都走这里
if (code === 'xiaohongshu') return 'content'
if (cap.supportsShelf) return 'shelf'
if (cap.supportsContent) return 'content'
```
→ 恒返回 `'live'`，「货架电商」「内容种草」两种业态分支是死代码。

## 7. 净效果
- 90 个经典导航项中，仅 **22 条**带 `platforms` 声明（route-manifest.ts）
- 切平台只改变这 22 条，其余 **68 条六平台一模一样**
- 按平台的可见项数：douyin 2 / taobao 5 / tmall 6 / kuaishou 3 / xiaohongshu 7 / wechat 3

## 8. 平台洞察端点实测（admin 登录态，from=2026-08-01&to=2026-11-18）
| 端点 | HTTP | 有数据 |
|---|---|---|
| /insights/douyin/three-pools | 200 | ✅ 直播池 GMV ¥2,049,070 |
| /insights/taobao/three-sources | 200 | ❌ 三源总 GMV ¥0，渠道数 0 |
| /tmall/brands | 200 | ❌ brands 0 / sessions 0 / totalGmv 0 |
| /tmall/promotion-layers | 200 | ❌ layers 0 |
| /tmall/promo-compare | 200 | ❌ promoGmv 0 / lift 0 |
| /insights/xiaohongshu/buyer-profile | 200 | ✅ 买手数 3 / 粉丝 320,073 |
| /insights/xiaohongshu/dandelion | 200 | ❌ 蒲公英达人 0 / 合作 GMV ¥0 |
| /insights/xiaohongshu/traffic-sources | 200 | ❌ 直播渠道数 0 |
| /wechat/affiliate | 200 | ❌ scenes [] / totalGmv 0 |
| /wechat/content | 200 | ❌ total 0 / publishRate 0 |

10 个中 8 个返回全 0 结构。
