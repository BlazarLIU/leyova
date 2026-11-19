# 维度 2：平台切换联动审计

> 核心问题：「每个平台对应的分组、模块，是否真的能够做到切换不同平台后，能对应显示？」
> **答案：不能。切换平台目前只改变 22/90 个导航项，后端平台维度模块过滤已完全失效。**

---

## 一、平台基础事实（2026-11-19 实测）

`system_platform_configs` 8 条，6 启用 2 停用：

| platform_code | category | is_enabled | 店铺数 | 授权状态 |
|---|---|---|---:|---|
| douyin | live | ✅ | 5 | 2 authorized / 3 manual_only |
| kuaishou | live | ✅ | 3 | 3 manual_only |
| wechat | live | ✅ | 5 | 5 manual_only |
| taobao | shelf | ✅ | 3 | 3 manual_only |
| tmall | shelf | ✅ | 3 | 3 manual_only |
| xiaohongshu | content | ✅ | 3 | 3 manual_only |
| jd | shelf | ❌ 停用 | 0 | — |
| pdd | shelf | ❌ 停用 | 0 | — |

**`GET /api/v1/platforms` 实测返回的 capabilities**（admin 登录态）：

```
douyin       live=True shelf=True content=True ads=True  shops=5
kuaishou     live=True shelf=True content=True ads=True  shops=3
wechat       live=True shelf=True content=True ads=True  shops=5
taobao       live=True shelf=True content=True ads=True  shops=3
tmall        live=True shelf=True content=True ads=True  shops=3
xiaohongshu live=True shelf=True content=True ads=True  shops=3
jd           live=None ...（无适配器）
pdd          live=None ...（无适配器）
```

**6 个平台能力声明完全相同**——这是第一个失效点。

---

## 二、四层过滤机制逐层体检

平台切换的可见性由四层机制共同决定，我逐层实测：

### 第 1 层：`platform_capability_matrix`（后端，198 行）— ❌ 已失效

```
douyin      33 applicable / 0 not-applicable
kuaishou    33 / 0
taobao      33 / 0
tmall       33 / 0
wechat      33 / 0
xiaohongshu 33 / 0
```

**`is_applicable = false` 的行数为 0。**

根因：迁移 `128_account_system_refactor.sql:190` 原本按 `p.category = 'live'` 决定直播域模块是否适用（淘系/天猫/小红书应为 false），但迁移 `133_fix_live_capability_and_dedicated.sql:26-45` 又把它全部 UPDATE 成 true，理由是老大说「leyova 系统只专注于直播电商，去掉不含主播带货的电商平台」+「抖音、快手、小红书都有直播带货板块」。

**这个业务决策本身没错，但它把「平台差异化」的唯一真值源整个废掉了。**

### 第 2 层：`access-resolver.ts` 的 `modulesByPlatform` — ❌ 空转

`access-resolver.ts:127-146` 的逻辑：先给每个平台复制一份 `effectiveModules`，再用 `platform_capability_matrix` 的 `is_applicable=false` 行做减法。**第 1 层已经没有 false 行，所以这一步什么都没减。**

实测 `hr_li` 的 `/auth/me` 返回：
```
platforms: ['douyin','kuaishou','wechat','taobao','tmall','xiaohongshu']
kuaishou     same_as_first
wechat       same_as_first
taobao       same_as_first
tmall        same_as_first
xiaohongshu same_as_first
```
**六个平台的模块集合逐字节相同。**

### 第 3 层：前端 `usePlatform.tsx` 的 `LIVE_ONLY_MODULES` — ❌ 已失效

`usePlatform.tsx:118`：
```ts
if (!currentPlatform.capabilities?.supportsLive && LIVE_ONLY_MODULES.has(moduleCode)) {
  return false
}
```
所有 6 个平台 `supportsLive` 都是 `true`，所以这个判断**永远不触发**。18 个「直播专属」模块码的白名单形同虚设。

### 第 4 层：`route-manifest.ts` 的 `platforms` 字段 — ✅ 唯一还在工作的

90 个导航项中只有 **22 条**带 `platforms` 声明：

| 平台 | 可见的专属项数 | 专属项 |
|---|---:|---|
| douyin | 2 | 抖音短视频引流、抖音三池统一调度 |
| taobao | 5 | 淘系店铺看板、商品与渠道结构、万相台投放对账、淘系三源流量、店铺×场次联动 |
| tmall | 6 | 淘系店铺看板、商品与渠道结构、万相台投放对账、天猫品牌×场次、五层抵扣规则、直播与官方立减联动 |
| kuaishou | 3 | 快手公私域流量、快手间接成交、快手粉丝团运营 |
| xiaohongshu | 6 | 小红书流量来源、笔记经营看板、种草转化链路、笔记→直播→成交、买手画像、蒲公英达人合作 |
| wechat | 3 | 视频号公私域、视频号全域带货、视频号图文内容 |

---

## 三、净效果：切平台到底改变了什么

**90 个导航项中，68 条（75.6%）在六个平台完全一样。**

这意味着切到淘宝/天猫/小红书后，侧栏仍然显示：

| 不该显示的项 | 原因 |
|---|---|
| 实时监控（`/overview/live-monitor`） | 淘宝/小红书的「直播实时监控」口径与抖音完全不同 |
| 直播间健康度（`/ops/room-health`） | `room_health` 表 0 行，且小红书买手间健康度模型不同 |
| 多直播间总览（`/system/multi-room`） | `multi_room_status` 表 0 行 |
| 直播登记系列（`/live/registration` 等） | 小红书/淘宝登记字段不同 |
| 复盘七件套（`/review/*`） | 小红书的「笔记→直播→成交」归因链路与抖音三池完全不同 |
| 主播列表/档案/训练/能力看板 | 小红书主播即「买手」，调性/粉丝画像维度不同 |
| 话术库 | 各平台违禁词表不同 |

而 `resolvePlatformMode()`（`platform-navigation.ts:35-46`）因为所有平台 `supportsLive=true`，**恒返回 `'live'`** —— 「直播电商 / 货架电商 / 内容种草」三种业态区分在产品里**从未生效过**。

---

## 四、三个平台洞察页配置失配（真 bug，会渲染空壳）

`PlatformInsightConfig.ts` 的 `findInsightConfig()` 用 `path ?? endpoint` 做 key，先精确匹配再 `startsWith`。我用 Node 复现了匹配逻辑：

| 导航 href | 配置 path | 配置 endpoint | 匹配结果 |
|---|---|---|---|
| `/insights/douyin/three-pools` | — | `/insights/douyin/three-pools` | ✅ EXACT |
| `/insights/taobao/three-sources` | — | `/insights/taobao/three-sources` | ✅ EXACT |
| `/insights/tmall/brand-sessions` | `/insights/tmall/brand-sessions` | `/tmall/brands` | ✅ EXACT |
| `/insights/tmall/live-promo-link` | `/insights/tmall/live-promo-link` | `/tmall/promo-compare` | ✅ EXACT |
| `/insights/xiaohongshu/buyer-profile` | — | `/insights/xiaohongshu/buyer-profile` | ✅ EXACT |
| `/insights/xiaohongshu/dandelion` | — | `/insights/xiaohongshu/dandelion` | ✅ EXACT |
| `/insights/xiaohongshu/traffic-sources` | — | `/insights/xiaohongshu/traffic-sources` | ✅ EXACT |
| **`/insights/tmall/promotion-layers`** | — | `/tmall/promotion-layers` | ❌ **NO MATCH** |
| **`/insights/wechat/affiliate`** | — | `/wechat/affiliate` | ❌ **NO MATCH** |
| **`/insights/wechat/content`** | — | `/wechat/content` | ❌ **NO MATCH** |

**后果**：这三个页面渲染 `PlatformInsightPage` 的兜底分支：
```tsx
return <div className="p-6 text-sm text-slate-400">
  未找到页面配置（路径：{pathname}）。请检查 INSIGHT_PAGE_CONFIG。
</div>
```

**为什么前端测试没抓到**：`frontend-integrity.test.mjs` 只校验「导航 href → App.tsx 路由存在」和「懒加载文件存在」，**不校验 `INSIGHT_PAGE_CONFIG` 覆盖**。而且 Vite dev server 对任何路径都返回 200（SPA fallback），所以 `curl` 探测也是 200，掩盖了客户端渲染失败。

**修法**：给这 3 个配置补 `path: '/insights/...'`，或把导航 `href` 改成与 endpoint 一致；同时在 `frontend-integrity.test.mjs` 加一条「所有 PlatformInsightPage 导航项必须在 INSIGHT_PAGE_CONFIG 中找到配置」的断言。

---

## 五、`PLATFORM_EXCLUSIVE_ROUTES` 覆盖不全

`platformRoute.ts:41-50` 的 `PLATFORM_EXCLUSIVE_ROUTES` 只列了 8 个 `/shop/*` 路由：

```
/shop/taobao/board            → ['taobao','tmall']
/shop/taobao/ad-reconciliation → ['taobao','tmall']
/shop/taobao/product-channel  → ['taobao','tmall']
/shop/kuaishou/traffic-split  → ['kuaishou']
/shop/kuaishou/indirect-gmv   → ['kuaishou']
/shop/kuaishou/fans-team      → ['kuaishou']
/shop/xiaohongshu/notes       → ['xiaohongshu']
/shop/xiaohongshu/conversion  → ['xiaohongshu']
```

**遗漏了全部 10 个 `/insights/*` 路由**。用户在快手平台直接访问 `/insights/douyin/three-pools` 不会被 `checkRoutePlatformCompatibility` 拦截，会看到空数据而不是「该页面为抖音专属」的提示。

---

## 六、直播专属路由缺 `platforms` 声明清单

以下路由属于直播专属但**未在 `route-manifest.ts` 声明 `platforms`**：

| 路由 | 页面 | 应限定 |
|---|---|---|
| `/overview/cockpit` | 经营驾驶舱 | 全平台（但口径应不同） |
| `/overview/live-monitor` | 实时监控 | 直播平台 |
| `/ops/room-health` | 直播间健康度 | 直播平台 |
| `/system/multi-room` | 多直播间总览 | 直播平台 |
| `/live/attendance` | 个人达成 | 直播平台 |
| `/live/registration` | 直播登记 | 直播平台 |
| `/live/data` | 登记数据管理 | 直播平台 |
| `/review/overview` | 复盘总览 | 直播平台 |
| `/review/products` | 商品分析 | 直播平台 |
| `/review/short-videos` | 短视频引流 | 直播平台 |
| `/review/channels` | 渠道流量 | 直播平台 |
| `/review/anchors` | 主播效能 | 直播平台 |
| `/review/funnel` | 转化漏斗 | 直播平台 |
| `/review/closed-loop` | 改进闭环 | 直播平台 |
| `/anchors/list` `/anchors/profile` `/anchors/training` | 主播三件套 | 直播平台 |
| `/ops/capabilities` | 能力看板 | 直播平台 |
| `/ops/script-library` | 话术库 | 直播平台 |
| `/ops/session-products` | 场次排品 | 直播平台 |
| `/overview/sessions` | 场次管理 | 直播平台 |
| `/anchors/live-schedule` `/anchors/schedule` | 排班 | 直播平台 |

---

## 七、结论与修复方向

**现状**：平台切换在产品里是一个「只换侧栏 22 个入口 + 换数据筛选条件」的浅层功能，「平台业态」这个概念（直播电商/货架电商/内容种草）从未真正生效。

**两条修复路线，需老大拍板**：

### 路线 A：承认「6 平台同构」，废除死逻辑
如果业务上就是「6 个平台都做直播电商」，那么：
- 删掉 `platform_capability_matrix` 表（或清空）
- 删掉 `usePlatform.tsx` 的 `LIVE_ONLY_MODULES` 判断
- 删掉 `resolvePlatformMode` / `platformModeLabel`
- 删掉 `platformRoute.ts` 的 `LIVE_ONLY_ROUTES` / `CONTENT_EXCLUSIVE_ROUTES`
- **保留** `route-manifest` 的 `platforms` 字段（这是唯一有意义的平台差异化机制）

**收益**：删掉约 200 行死代码 + 3 套冗余判断，消除「改一处忘另一处」的维护风险。

### 路线 B：做真平台差异化
按平台真实能力重新声明：
- 抖音：三池（短视频蓄水/直播收割/商城长尾）+ 千川
- 快手：公私域（关注页/发现页）+ 粉丝团 + 间接成交
- 视频号：公私域混合度最高 + 全域带货者视角
- 淘宝/天猫：店铺维度组织 + 三源流量（推荐/搜索/自运营）+ 五层抵扣
- 小红书：买手直播 + 笔记种草联动 + 蒲公英

**代价**：需要为每个平台补 `supportsX` 精确定义 + 口径差异 + 专属指标，工作量 3-4 周，且**大部分洞察页仍缺数据**。

**我的建议**：走路线 A（先拆死逻辑），把平台差异化的精力集中到「有数据的 2 个平台洞察页做深」，而不是「12 个页都做浅」。
