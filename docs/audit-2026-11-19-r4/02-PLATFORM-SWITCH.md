# 02 · 平台切换实测

> 核心问题：切换平台后，分组与模块能否「对应显示」。
> 结论：**不能。** 平台切换只改变经典侧栏的少量菜单项，后端数据、权限、AI-Ops 菜单均不变；且前端从不把平台发给后端。

## 一、四层机制逐一实测

### 层 ① 前端菜单过滤（唯一真正生效的层）

- 依据：`route-manifest.ts` 中 **22/90 条** 声明了 `platforms`。
- 过滤函数：`platform-navigation.ts:99-101`
  ```ts
  NAV_MANIFEST.filter(e => e.group === group && (!e.platforms || !code || e.platforms.includes(code)))
  ```
- 执行点：`Sidebar.tsx:272-275`。
- 陷阱：`code` 来自 `currentPlatform.capabilities.platform_code`；若能力对象为空 → `code=undefined` → **所有平台专属项照样显示**（fail-open）。

### 层 ② 前端模块过滤 `isModuleSupported`

- 依据：`usePlatform.tsx:113-123` + `LIVE_ONLY_MODULES`（18 条，`:31-50`）。
- 逻辑：平台 `capabilities.supportsLive === false` 时隐藏 18 个「仅直播」模块。
- **实测缺陷**：18 个模块码中 **7 个与 manifest 的 `module` 命名不一致**，永远匹配不到：

| `LIVE_ONLY_MODULES` 中的码 | manifest 实际使用的 module | 结果 |
|---|---|---|
| `room_health` | `ops` | 永不命中 |
| `multi_room` | `system_multiroom` | 永不命中 |
| `live_monitor` | `overview` | 永不命中 |
| `review_products` | `review` | 永不命中 |
| `review_short_video` | `review` | 永不命中 |
| `review_short_videos` | `review` | 永不命中 |
| `review_loop` | `review_closed_loop` | 永不命中 |

- 反向陷阱：平台记录若无 `capabilities` 对象，被当作「不支持直播」→ **一次隐藏 24 条菜单**；若 `capabilities=null` → 全部放行（fail-open）。同一份数据两种极端。

### 层 ③ 路由可达性提示

- 依据：`utils/platformRoute.ts:12-34`（`LIVE_ONLY_ROUTES` 22 条）+ `:43-54`（`PLATFORM_EXCLUSIVE_ROUTES` 8 条）+ `Layout.tsx:197-210`。
- 效果：访问不匹配路由时渲染 `PlatformMismatchNotice`（提示页），**路由本身仍存在、接口仍可调**。
- 死代码：`CONTENT_EXCLUSIVE_ROUTES` 2 条（`:55-58`）因 `:92-103` 先返回而永不可达（`:126-131`）。

### 层 ④ 后端数据与权限（决定性：0 生效）

| 检查 | 结果 | 证据 |
|---|---|---|
| 前端是否发送平台标识 | **否**。全仓检索 `x-leyova-platform` / `leyova_current_platform` 无前端调用 | `grep` 结果为空 |
| 后端是否按平台过滤数据 | **否**。`overview.ts` 无 `platform` 条件 | `grep -n platform apps/api/src/routes/overview.ts` 无命中 |
| 同一接口不同平台头是否不同 | **否**。`/overview/sessions` douyin 与 xhs 响应 **md5 完全相同**，均 140 场 | `_evidence/05-platform-probes.md` §2 |
| 中控能否读到其他平台数据 | **能**。`ctrl_xhs` 读 `/sessions/1/pnl` → 200，内容 `platformCode=douyin` | `_evidence/03-api-authz-matrix.md` §5-B2 |
| 平台能力是否真实差异 | **否**。`platform_capability_matrix` 198 行，`is_applicable=false` **0 行**，六平台签名相同 | `_evidence/02-db-rowcounts.md` §6 |
| 平台 `supportedModules` 是否可用 | **否**。API 返回 `cockpit`/`anchors`/`ops_goals`，与 `system_modules.code`（`overview`/`anchor`/`ops`）不一致 | `_evidence/05-platform-probes.md` §3 |
| 用户级平台绑定 | **空**。`user_platform_permissions` 138 行全部属于 23 个 `__t_ad_buyer_*` 测试账号；真实账号 0 行 | `_evidence/02-db-rowcounts.md` §8 |

#### 层 ④ 补充：后端结构决定了「即使前端发平台头也不会生效」

| 检查 | 结果 | 证据 |
|---|---|---|
| 6 个平台适配器的 `getCapabilities()` | **完全同构**：`supportsLive/supportsShelf/supportsContent/supportsAds/supportsAutoSync/supportsManualUpload` 全部 `true` | `platform/adapters/{douyin,taobao,social,...}.ts` |
| `platform_capability_matrix` 的唯一读取点 | `access-resolver.ts:133`，**只用于收窄前端菜单的 `access.modules`**，不影响后端鉴权、不影响 SQL 查询 | `_evidence/11-backend-inventory.md` §6 |
| 矩阵与适配器是否自洽 | **矛盾**：矩阵对 taobao/tmall/wechat 的 `live*` 置 false，适配器 `supportsLive=true` | 同上 |
| `supportedModules` 是否被比对 | **否**：用 `cockpit/live_monitor/shop_overview/data_manage` 旧码，全仓无与 `system_modules.code` 的比对逻辑 | 同上 |
| 流量数据是否按平台可得 | **否**：`fetchTrafficData` 恒返回 `[]`，`fact_traffic_daily` 永远空 | `platform/adapters/base.ts:103-110` |
| 店铺授权是否真实 | 22 个店铺 **0 个真实授权**，同步 `total=22 completed=0` | `_evidence/06-process-and-logs.md` |

## 二、6 平台 × 90 入口可见性

> 基数为 manifest 90 条；「隐藏」= `platforms` 不含该平台；「再隐藏」= 该平台 `supportsLive=false` 时叠加直播模块项（实际因 7 条死编码打折扣）。

| 平台 | 层① 隐藏 | 可见（仅层①） | 层② 再隐藏 | 最终可见（估） |
|---|---:|---:|---:|---:|
| 抖音 douyin | 20 | 70 | 0（supportsLive=true） | 70 |
| 淘宝 taobao | 17 | 73 | 18（其中 6 与层①重叠）→ 实际 +12 | **55** |
| 天猫 tmall | 16 | 74 | 0 | 74 |
| 快手 kuaishou | 16 | 74 | 0 | 74 |
| 小红书 xiaohongshu | 16 | 74 | 0 | 74 |
| 视频号 wechat | 19 | 71 | 0 | 71 |
| **AI-Ops 菜单** | **0** | **28** | **0** | **28（恒定不变）** |

关键：
- AI-Ops 分支（`Sidebar.tsx:263-265`）**完全不走平台过滤**，28 条恒定显示。
- 淘宝因为不支持直播，菜单从 73 掉到 55，但这个「差异」与业务无关：真正该差异化的指标口径、授权链路、场中动作，系统完全没做。
- 六平台的业务差异（基准 §3：抖音三池、淘宝生意参谋、小红书 NPL、视频号公私域、快手私域、拼多多千次进人成交）在界面上**一项都没有体现**。

## 三、平台专属页面是否真的能显示

`route-manifest.ts` 中带 `platforms` 的 22 条，实际是「平台专属知识/数据页」：

| 平台 | 专属入口 | 实测 |
|---|---|---|
| 抖音 | `/insights/douyin/three-pools`、`/insights/douyin/short-video` | 知识页可显示 |
| 淘宝/天猫 | `/shop/taobao/board`、`/ops/product-center/channel`、`/shop/taobao/ad-reconciliation`、`/insights/taobao/three-sources`、`/insights/tmall/brand-sessions`、`/insights/tmall/live-promo-link`、`/insights/tmall/promotion-layers` | **`promotion-layers` 直接渲染「未找到页面配置」** |
| 小红书 | 6 条（笔记板、转化、投流、人群、蒲公英） | 5 条正常，1 条待核 |
| 视频号 | 3 条 | **`affiliate`、`content` 两条渲染「未找到页面配置」** |
| 快手 | 3 条（粉丝团、间接 GMV、流量拆分） | 可显示 |

即：平台专属页里已经 **3/22 直接是开发错误页**（`PlatformInsightConfig.ts:54,95,103` 缺 `path` 字段，`PlatformInsightPage.tsx:15-20` 无兜底）。

## 四、判定与整改方向

**当前平台切换 = 「菜单装饰 + 3 个坏页 + 2 个假层 + 1 个死层」。**

要达到「切平台后对应显示」，需要补的是**后端**，不是继续加前端判断：

1. 前端所有请求统一加 `x-leyova-platform`（或 `platformCode` 查询参数）。
2. 后端 `overview/session/review/finance` 查询统一按平台过滤，并补 `user_platform_permissions` 真实授权。
3. `platform_capability_matrix` 改为真实差异：至少把「直播/货架/内容」三种形态与「指标口径集」拆开，允许 `is_applicable=false`。
4. 统一模块命名：`supportedModules` 必须用 `system_modules.code`。
5. 修复 3 个洞察页配置 + 7 条死编码。

验收口径：同一账号切换 douyin → xiaohongshu，`/overview/sessions` 返回集合应不同（md5 不同），且 `ctrl_xhs` 读抖音场次应 403。
