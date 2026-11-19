# Leyova 架构 / 导航 / 业务贴合 综合审计

> 审计对象：`/home/leyova`（乐播云 v1 经典运营系统）
> 审计基准：git HEAD `1cccb41` + 工作区快照，时间点 **2026-11-16 14:23 UTC**（Asia/Taipei 22:23）
> 运行态：pm2 `leyova-api`(8788) / `leyova-web`(5513) / `leyova-postgres`(55432) / `leyova-worker` / `leyova-mcp` 均 online
> 方法：代码静态核读 + 结构量化 + 运行态实证（pm2 / psql / 构建时间）+ 外部运营调研对标
> 范围声明：**AI 相关功能不审计**（施工中）；不改代码、不改配置、不重启服务
> 关键前提：**工作区正在被实时修改**（`App.tsx`/`Layout`/`Sidebar`/`Topbar`/`platform-navigation`/`useAuth` 有未提交改动，新增 `ai-ops/`）。本报告结论对应该快照，后续变动需复核。

---

## 0. 结论先行

1. **不能交付给真实客户使用，只能做 POC / 演示。** 三个硬阻断：① 全部经营数据是 `is_demo=true` 的合成种子；② 平台授权 21 店仅 1 个 `authorized`；③ 前端构建曾出现「源码 14:08 / dist 07:12」的漂移（14:22 已重建，但说明构建无门禁，会反复发生）。
2. **业务骨架贴合，但分组不贴合。** 系统把「直播电商的场」这条主线拆散到了 4 个分组，并用一个 `运营提效 > 运营工具` 的 19 项抽屉混装 9+ 个业务域，违反真实运营的工作方式。
3. **导航规模失控。** 抖音视角 **17 个顶层行 / 70 个叶子链接**塞进 200px 侧栏；`platform-navigation.ts` **131 处 href 声明 → 88 个唯一页面 → 43 处重复挂载**。
4. **架构无单一事实源。** 路由 / 菜单 / 面包屑 / 前端守卫 / 后端守卫 / 平台兼容 / 文档 **至少 7 处注册表**各自维护、互相漂移。
5. **分类问题最集中的四组**：`运营工具`（19 项混 9 域）、`主播管理`（主数据+排班+绩效+培训+话术+角色台 6 类）、`运营支撑`（组名模糊、3/4 项与别处重复）、`系统运维`（混入业务/监控项）。

---

## 1. 审计范围、快照与方法

### 1.1 快照事实

| 项 | 值 |
|---|---|
| git HEAD | `1cccb41`（2026-11-16，`docs: 重写 README…`） |
| 未提交改动 | `App.tsx`、`Layout.tsx`、`Sidebar.tsx`、`Topbar.tsx`、`platform-navigation.ts`、`useAuth.ts` |
| 未跟踪新增 | `ai-ops/`、`apps/web/src/components/auth/RequireAiOpsAccess.tsx`、`SystemBranchSwitcher.tsx`、`ai-ops-navigation.ts`、`pages/ai-ops/`、`services/ai-ops-data.ts`、`docs/` |
| App.tsx 路由数 | 130 条（其中 `/ai-ops` 23 条） |
| 导航 href | 131 处声明 / 88 个唯一 / 43 处重复 |
| 前端页面 | 121 个 `.tsx` / 40,506 行 |
| 后端路由文件 | 52 个 / 22,753 行 |
| dist | 14:22 重建（比 `App.tsx` 14:21 新 76 秒） |
| API 重启 | `leyova-api` 累计 **80 次**（uptime 8h） |
| 同机其他系统 | `orbit-*`（遗留，online）、`leyova2-*`（新版，已 stopped） |

### 1.2 架构规模量化

| 对象 | 规模 |
|---|---|
| `routes/*.ts` | 52 文件 / 22,753 行；最大 `system.ts` **1,370 行/32 路由**、`data.ts` 1,174、`review.ts` 1,074、`inventory.ts` 991、`platform-dedicated.ts` 948 |
| 平台聚合 | 5 套分析文件 **1,709 行**（wechat 386 / xhs 382 / taobao 340 / kuaishou 336 / tmall 265），加 `caliber.ts` 229 行，`platform/` 合计 **2,338 行** |
| 前端页面 | 121 文件 / 40,506 行；`ops/` 为「8 扁平文件 + 10 子目录」混合体 |
| 模块 | `system_modules` 30 个；`users.role` 10 种（**无 `finance`**） |

### 1.3 证据来源

- 本次自查：`App.tsx`、`platform-navigation.ts`、`ai-ops-navigation.ts`、`Sidebar.tsx`、`Topbar.tsx`、`Layout.tsx`、`platformRoute.ts`、`app.ts`、`module-guard.ts`、`platform/adapters/*.ts`、`ecosystem.config.cjs`。
- 运行态：`pm2 list`、`psql -p 55432`、`stat` 时间戳。
- 既有证据（07:39–08:08 快照，HEAD 同版本）：`_evidence/`（OpenAPI 345 path/419 op、242 GET 探测、96 页四档分类、240 表行数）与 `20-RUNTIME-FUNCTIONAL-AUDIT.md`。
- 外部调研：见第 2 节。

---

## 2. 调研基准：真实运营是怎么分工、怎么开屏的

> 分类是否合理，取决于真实运营怎么干活。以下为外部调研结论，作为本审计的判据。

### 2.1 真实岗位与高频任务

| 角色 | 核心职责 | 每天高频看什么 |
|---|---|---|
| 运营/操盘手 | 场次目标、商品排序、方案调整、复盘结论 | 场次数据、排品、复盘 |
| 主播 | 讲解/逼单/话术执行 | 提词卡、实时数据、商品反馈 |
| 场控/中控 | 上下架、氛围、报库存、控评 | 库存、商品链接、评论 |
| 投手 | 计划消耗、成本阈值、停投记录 | 千川消耗/ROI、计划 |
| 选品 | 货盘（引流/爆款/利润/福利四层） | 商品、毛利、库存 |
| 客服 | 咨询、催付、中差评、售后原因 | 订单、售后、工单 |
| 财务 | 成本口径、退款、利润确认 | 结算、对账、利润 |
| HRBP | 主播/排班/绩效 | 人效、排班 |

来源：[蝉妈妈·直播间各岗位工作流程](https://chanmama.com/yunyingquan/article/755)、[视频号直播各岗位 SOP](https://woshipm.com/operate/5365580.html)、[直播团队老板关心什么（角色职责与成本归因）](https://eshutong.com/archives/111511.html)。

### 2.2 真实日循环（直播电商的主轴）

**开播前**（排品/话术/设备/商品上架）→ **直播中**（盯盘/上下架/投流/客服催付）→ **下播后**（复盘五指标/行动项）→ **次日**（排品/预告）。
复盘五指标：GMV、GPM、UV 价值、千川 ROI、自然流量占比（[主播教练实战指南](https://blog.csdn.net/gitblog_01199/article/details/160265471)）。

### 2.3 同类产品顶层导航（横向对标）

| 产品 | 顶层模块 |
|---|---|
| 抖店（官方） | 商品 / 订单 / 售后 / 营销 / 资金 / 电商罗盘 / 客服 / 子账号权限（[抖店功能](https://soft.china.com/article/1335798.html)） |
| 电商罗盘（官方） | 首页 / 直播 / 商品 / 店铺 / 达人 / 营销 / 售后 / 物流；核心分组=流量转化·互动·人群·商品·售后（[罗盘手册](https://zhuanlan.zhihu.com/p/472719866)） |
| 旺店通/聚水潭（ERP） | 订单 / 售后 / 采购 / 库存 / 商品 / 财务对账（[旺店通](https://yun88.com/product/10485.html)） |
| 直播团队 SOP | 场次 / 排品 / 投流 / 客服 / 复盘 / 人效 |

### 2.4 B 端导航法则

左侧一级+二级、层级 ≤ 3、**按业务域而非技术模块**、菜单数据驱动、按角色权限过滤、侧栏 200–240px（[B端后台规范](https://csdn.net/detail/webblog_79200113/42080)）。

### 2.5 由调研推导的 5 条分组判据（本审计的尺子）

1. **场是主轴**：一场的生命周期（排品→开播→盯盘→复盘→行动）必须在一个工作面，不能被拆散。
2. **按角色高频任务分组**：角色进来自动看到「今天要干的」，而不是在 70 个叶子里找。
3. **每个业务对象唯一归属**：同一页面只在一个组，杜绝重复挂载。
4. **指标带动作**：看数页必须能联动动作（继续/降预算/换品/暂停/复盘），否则只是信息陈列。
5. **SME 一人多岗**：菜单按「任务/场景」聚合，不按部门切太细，支持角色视图。

---

## 3. 交付就绪度审计

### 3.1 结论：只能 POC / 演示，不能真实交付

| # | 阻断 | 实证 | 判定 |
|---|---|---|---|
| 1 | 数据 100% 合成 demo | `fact_trade_daily` 18,630/18,630 `is_demo=true`；`canonical_orders` 6 平台**各恰好 5,400 单**（每日恰好 180 单）；数据停在 2026-11-12 | 🔴 阻断 |
| 2 | 平台授权≈0 | `dim_shop` 21 店：**20 `manual_only`、1 `authorized`** → 无法自动取数 | 🔴 阻断 |
| 3 | 构建门禁缺失 | 审计中观测到 `App.tsx` 14:08 / `dist` 07:12 漂移，`vite preview` 跑旧构建；14:22 才被重建 | 🟠 流程风险 |
| 4 | 稳定性 | `leyova-api` 9h 重启 **80 次** | 🟠 需查根因 |
| 5 | 前端兜底 | 无 `path="*"` catch-all，未匹配 URL 白屏 | 🟠 体验风险 |
| 6 | 交付边界 | 同机并行 `orbit-*`（遗留）+ `leyova`（当前），交付对象不清 | 🟡 需澄清 |

### 3.2 角色与账号

- `users.role` 仅 10 种：`super_admin / admin / operator / ad_buyer / finance? / hrbp / employee / ops_director / ops_staff / controller / brand_viewer`——实测**没有 `finance`**，`finance_chen` 实为 `admin`。
- 既有审计（同版本）实测 README 8 个演示账号 **3 个不存在**（`director_zhang`/`buyer_sun`/`gap_viewer`），客户按 README 演示会当场登录失败。

---

## 4. 业务贴合度审计

### 4.1 平台差异化是「话术」，不是「模型」

- 6 个平台适配器全部声明 `supportsLive/Shelf/Content/Ads = true`（`platform/adapters/*.ts`）。
- 因此 `resolvePlatformMode`、`LIVE_ONLY_ROUTES` 拦截、`PlatformMismatchNotice` **全部空转**；所谓「按平台业态分流」实际靠 `platformCode === 'taobao'` 一类硬编码 `if`。
- 后果：淘系/小红书用户同时拿到「直播骨架 + 专属组」，同一业务模块出现 2–3 次。

### 4.2 「平台专属页」名不副实

- 24 条平台专属路由中，**10 条共用 1 个 34 行的配置驱动通用壳**（`PlatformInsightPage`），只有 14 个是独立页；`pages/shop/tmall/` 是空目录。

### 4.3 场的主线被拆散（判据 1 违反）

一场直播的完整生命被拆到 4 个分组：
- 场次管理 → `运营提效 > 运营工具`
- 场次排品 → `运营提效 > 运营工具`
- 多直播间总览 → `总览`
- 复盘 → `直播复盘`
- 排班 → `主播赋能 > 主播管理`

### 4.4 指标与动作脱节（判据 4 违反）

- 看数页（驾驶舱/分析/大盘/BI）只展示数字，没有联动「继续/降预算/换品/暂停/复盘」的动作入口；外部调研明确指出「没有动作规则的指标只是信息陈列」。

---

## 5. 架构审计

### 5.1 后端：扁平注册 + 上帝文件 + 近重复

- `app.ts` 约 50 行 `app.register(...)` 平铺 52 个 route 文件，**无领域边界**。
- 上帝文件：`system.ts` 1,370 行/32 路由、`data.ts` 1,174、`review.ts` 1,074、`inventory.ts` 991、`platform-dedicated.ts` 948。
- 5 套平台聚合 **1,709 行** SQL 结构高度雷同，改口径要改 5–6 处。
- 模块权限靠 `lib/module-guard.ts` 的有序 URL 前缀映射（顺序敏感），新增路由极易漏配/错配成越权或误 403。
- 无模块 manifest / entitlement（依赖闭包、能力冲突校验、许可开关均缺）。

### 5.2 前端：无单一事实源

路由/模块/导航散落在至少 7 处，互不同步：

| # | 注册表 | 位置 |
|---|---|---|
| 1 | 路由注册 | `apps/web/src/App.tsx` |
| 2 | 经典菜单 | `data/platform-navigation.ts` |
| 3 | AI 菜单（施工中） | `data/ai-ops-navigation.ts` |
| 4 | 面包屑 + routeModules | `components/layout/Topbar.tsx` |
| 5 | 平台兼容 + 默认落地页 | `utils/platformRoute.ts` |
| 6 | 前端模块守卫 | `components/auth/RequireAccess.tsx` |
| 7 | 后端模块守卫 | `apps/api/src/lib/module-guard.ts` |
| 8 | 文档 | `apps/api/src/openapi.ts` |

### 5.3 遗留/死代码

- `platformRoute.ts` / `Topbar.tsx` 仍留 `/shop/jd/*`、`/shop/pdd/*`（京东/拼多多 2026-11-14 已移除），点进去 404/白屏。
- `pages/shop/tmall/`、`pages/dashboard/` 空目录；`pages/overview/HomePage.tsx` 未挂载；`pages/anchors/UnifiedScheduleHub.tsx` 仅 3 行别名。
- 7 组 `/xxx` 与 `/xxx/standalone` 指向同一页面。
- `/bi/dashboard` 在移除 AI 段后**失去菜单入口（孤儿路由）**。

---

## 6. 导航 / IA 审计

### 6.1 规模

- 抖音视角：**17 个顶层行 / 70 个叶子链接**，200px 侧栏。
- 顶层行：总览 6（扁平）+ 人工登记 3（扁平）+ 主播管理 1 + 复盘分析 1 + 运营工具 1 + 内容创作 1 + 数据管理 1 + 系统运维 1 + 运营支撑 1 + 合规风控 1。

### 6.2 重复挂载（判据 3 违反）

- **131 处 href 声明 → 88 个唯一页面 → 43 处重复**。
- 出现 **4 次**：`/system/tasks`（改进任务）、`/system/promotions`（活动管理）、`/system/competitors`（竞品观察）、`/ops/search-keywords`（搜索词卡位）、`/ops/net-roi`（净ROI）。
- 出现 **3 次**：`/review/channels`、`/overview/analytics`、`/ops/kol`、`/ops/inventory`、`/ops/goal-tracking`、`/ops/fulfillment`、`/ops/cs`、`/ops/after-sales`、`/data/upload`、`/content/schedule`、`/content/center-config`。
- 同页不同标签：`/ops/net-roi` 一处「全域投放与T+7净ROI」、一处「全域投放与净ROI」。

### 6.3 孤儿与死链

- `/bi/dashboard` 无菜单入口。
- `/bi/refund-analysis`、`/bi/anomaly-detection` 仅出现在淘系「售后与退款」，抖音/快手/视频号/小红书用户无入口。
- `/shop/jd/*`、`/shop/pdd/*` 死引用。

---

## 7. 分组内模块分类合理性审计（逐项）

判定口径：✅合理 / ⚠️可接受 / ❌错位 / 🔁重复 / 🧩应拆 / 🔗应并。

### A. 总览（6 项）

| 模块 | 实际业务域 | 判定 | 依据 |
|---|---|---|---|
| 首页 | 入口 | ✅ | — |
| 经营驾驶舱 | 经营看数 | ✅ | — |
| 多直播间总览 | **直播运营** | ❌ | 判据2：属场次/直播，却放总览；module 是系统模块 |
| 实时监控 | 直播看数 | ✅ | — |
| 数据分析 | 经营看数 | 🔗 | 与驾驶舱/大盘重叠 |
| 全渠道大盘 | 经营看数 | 🔗 | 同上；4 个看数页应收敛 |

> 结论：总览应只留「1 主大盘 + 实时监控」。

### B. 人工登记（3 项）

个人达成 / 直播登记 / 登记数据管理 → **✅ 同属人工录入自洽**；瑕疵：与「数据管理」上传边界模糊。

### C. 主播赋能 > 主播管理（10 项）

| 模块 | 实际业务域 | 判定 |
|---|---|---|
| 主播列表 / 主播档案 | 主播主数据 | ✅ |
| 我的排班 / 直播排班 / 排班设置 | **排班调度（人效）** | ❌ 判据5：应独立成「排班」；「我的X」是员工自助视角，混在管理视角里 |
| 我的业绩 | **个人绩效** | ❌ 属人效 |
| 训练管理 | 主播培养 | ✅ |
| 话术模板 | **内容资产** | 🔁 与「运营工具」重复 |
| 能力看板 | 主播评估 | ✅ |
| HRBP 工作台 | **岗位工作台** | ⚠️ 角色入口，非主播子项 |

> 🧩 一组混装 6 类（主数据+排班+绩效+培训+话术+角色台），违反判据 2/5。

### D. 快手私域经营（3 项）

公私域流量 / 间接成交 / 粉丝团 → **✅ 平台专属自洽**（module 混用 bi/ops 需统一）。

### E. 直播复盘 > 复盘分析（7 项）

复盘总览 / 商品分析 / 短视频引流 / 渠道流量 / 主播效能 / 转化漏斗 / 改进闭环 → **✅ 全系统分类最干净的一组**，7 个都是单场复盘维度，符合判据 1。

### F. 运营提效 > 运营工具（19 项）——核心灾区，🧩 混装 9+ 业务域

| 模块 | 实际业务域 | 判定 |
|---|---|---|
| 场次管理 | 场次运营 | ❌ 判据1：应在「场次台」 |
| 场次排品 | 场次运营 | ❌ 判据1 |
| 话术模板 | 内容资产 | 🔁 重复 |
| 短视频引流→直播承接 / 三池统一调度 | 平台专属流量 | ❌ 抖音专属，塞通用组（判据2） |
| 直播间健康度 | 直播运营 | ❌ 判据1 |
| 全域投放与T+7净ROI | **投放+财务** | ❌ 独立域（判据2/4） |
| 搜索词卡位 | 投放/SEO | ❌ 独立域 |
| 会员与私域 | CRM | ❌ 独立域 |
| 商品主数据与库存 | 商品/供应链 | ❌ 独立域（货架版另有商品中心） |
| 履约SLA与赔付风控 | 履约 | ❌ 独立域 |
| 售后工单与原因归因 | 售后 | ❌ 独立域 |
| 达人合作与佣金 | 达人/MCN | ❌ 独立域 |
| 客服响应与绩效 | 客服 | ❌ 独立域 |
| 改进任务 | 管理杂项 | ❌ 4 处重复（判据3） |
| 活动管理 | 营销 | ❌ 4 处重复 |
| 竞品观察 | 市场/竞品 | ❌ 4 处重复 |
| 问题库 | 管理杂项 | 🔁 2 处 |
| 目标达成 | 目标管理 | 🔁 3 处 |

> **这是「分组不贴合」最严重的单点**，判据 1/2/3/5 全违反。

### G. 运营提效 > 内容创作（4 项）

| 模块 | 判定 |
|---|---|
| 内容排产与归因 / 视频创作 / 视频数据 | ✅ 内容域 |
| 生成服务配置 | ❌ 系统配置，应归「系统」 |

### H. 数据管理 > 数据管理（5 项）

数据管理 / 上传 / 多平台接入 / 上传数据管理 / 数据质量 → **✅ 数据域自洽**；瑕疵：「数据管理」与「上传数据管理」名称撞车。

### I. 系统与设置

| 子组 | 判定 |
|---|---|
| 系统运维（10） | ✅ 主体系统；⚠️ 运营人员管理 / 直播间管理 / 异常中心 / 模型与知识库 偏业务或监控 |
| 运营支撑（4） | ❌ **组名模糊应解散**：字典归系统，活动/竞品/改进任务归业务域 |
| 合规风控（2） | ✅ 合规自洽 |

### J. 货架版（淘系）

| 组 | 判定 |
|---|---|
| 店铺经营 | ⚠️ 「售后与退款」混入「异常检测」（监控非售后）；「店铺×场次/品牌×场次」实为场次 |
| 商品中心 | ✅ 商品域；🔁 「库存」与运营工具重复 |
| 店铺运营 | 🔁🧩 履约/客服/达人/会员/目标/活动/改进/问题库 与「运营工具」大面积重复 |

### K. 内容版（小红书）

| 组 | 判定 |
|---|---|
| 内容经营 | ✅ 内容域 |
| 达人合作 | ⚠️ 混入「竞品笔记监测」（非达人） |
| 店铺转化 | 🔁 7 项与「运营工具」重复 |

---

## 8. 分类问题根因（4 条）

1. **按技术模块分组**：`system_modules` 的 30 个权限模块被直接当菜单分组 → 出现「运营工具」这种抽屉。
2. **场的主线被拆散**：场次管理/排品/复盘/多直播间分散在 4 个组，违反判据 1——最该改。
3. **平台叠加重复**：全平台 `supportsLive=true` → 淘系/小红书同时拿到「直播骨架 + 专属组」，重复 2–3 次。
4. **视角混用 + 无单一事实源**：管理/个人视角混排；7 处注册表导致重复挂载、标签不一致、孤儿路由。

---

## 9. 值得肯定之处（重构时别改坏）

1. **RBAC + 模块守卫真实可用**：403 带 `module` 字段与中文文案，4 角色实测 82–212 个不同可见端点，收敛干净。
2. **`shop-guard.ts` 跨平台校验正确**：拿 douyin 的 shop_id 查 kuaishou 会明确报错，而不是返回脏数据。
3. **`amount_type` 六口径模型设计严谨**（6 种口径 + `platform_caliber_config` + 查询侧 fail-closed 关联）。
4. **转化链路（`/review/*`）是全系统唯一端到端闭环**：场次→渠道→漏斗→商品→短视频，21 张表、25,740 行，带参全部 200。
5. **OpenAPI 419 条文档 + 406 条注册路由高度一致**（仅 6 条漂移）。
6. **240 张表分区设计专业**：按月分区、`manage-partitions` cron、未来分区预建到 2027-06。

---

## 10. 审计边界（如实声明）

1. 本报告为**只读审计**，未验证任何写操作（POST/PUT/DELETE）的业务正确性。
2. 未做浏览器像素级 E2E；「可用」判定沿用既有 `_evidence/page_classification.json`。
3. 未查 `pm2` 80 次重启根因，建议另派任务。
4. 工作区实时变动，报告锁 2026-11-16 14:23 UTC 快照；后续改动需复核。
5. `leyova2`（新版）不在审计范围，仅作去向参考。

---

## 附录 A：证据索引

| 文件 | 内容 |
|---|---|
| `_evidence/openapi.json` | 运行态 OpenAPI（345 path / 419 op） |
| `_evidence/probe_admin.json` 等 | 4 角色 242 GET 逐条实测 |
| `_evidence/page_classification.json` | 96 页四档分类 + 每接口状态码 |
| `_evidence/table_rowcounts.txt` | 240 表精确行数 |
| `_evidence/route_crosscheck.json` | 406 注册路由 + 死链判定 |

## 附录 B：复现命令

```bash
# 快照
cd /home/leyova && git rev-parse --short HEAD && git status --short
# 路由 / 导航规模
grep -c '<Route path=' apps/web/src/App.tsx
grep -o "href: '[^']*'" apps/web/src/data/platform-navigation.ts | wc -l
grep -o "href: '[^']*'" apps/web/src/data/platform-navigation.ts | sort -u | wc -l
# 重复挂载
grep -o "href: '[^']*'" apps/web/src/data/platform-navigation.ts | sort | uniq -c | sort -rn | head
# 数据真伪
psql -h 127.0.0.1 -p 55432 -U leyova -d leyova -At -c "select count(*) filter (where is_demo), count(*) from fact_trade_daily;"
psql -h 127.0.0.1 -p 55432 -U leyova -d leyova -At -c "select auth_status,count(*) from dim_shop group by 1;"
# 进程 / 重启
pm2 list | grep leyova
```
