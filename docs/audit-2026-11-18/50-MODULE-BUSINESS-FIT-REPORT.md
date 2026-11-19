# Leyova 系统分组模块业务贴合度调研报告

> 调研日期：2026-11-18
> 调研方式：从「一个真实运营场景」出发，逐组核对模块的业务语义、数据支撑、权限闭环
> 调研对象：92 个导航项 / 9 大分组 / 41 个系统模块 / 15 个角色 / 全量事实表

---

## 一、调研方法：用一个真实场景贯穿

不以「功能清单」视角看，而以**一个真实的代运营团队一周**视角，把系统模块嵌入实际作业流，看每一步能不能落地。

**场景设定**（典型 SME 跨平台直播电商团队）：

| 维度 | 设定 |
|---|---|
| 团队 | 1 运营总监 + 2 操盘运营 + 1 投手 + 12 主播 + 6 中控 + 1 HRBP + 2 客服 + 1 仓储 + 1 拍剪 |
| 平台 | 抖音（主阵地）、淘宝/天猫、视频号、小红书 |
| 节奏 | 每周 20+ 场直播，日更短视频 3-5 条，月投流 40 万 |
| 目标 | 净利导向（不看虚高 GMV），履约不违规，人效持续提升 |

**场景主线**（后面每节都回到这条线）：

```
周一：定目标 → 选品/排品 → 排班
周二~周日：开播（短视频预热 → 直播 → 排品执行 → 投放调整）
      同时：订单履约 → 售后 → 客服
下周一：复盘 → 人效评估 → 问题闭环 → 调整下周目标
```

---

## 二、总体结论

### 2.1 一句话结论

> **「播中 + 复盘」两段世界级完整，「播前计划」与「播后履约」两段大面积空转，权限模型与实际岗位断层。**

系统不是一个「半成品」，而是一个**重心极度偏斜的产品**：把 80% 的工程量投在了直播进行时与事后复盘，而真实运营中**最花时间、最容易出错**的播前计划与播后交付，大多是空界面。

### 2.2 九大分组贴合度评级

| 分组 | 项数 | 业务贴合度 | 数据支撑 | 核心判断 |
|:---|:---:|:---:|:---:|:---|
| **today**（今日作战） | 12 | ⭐⭐⭐⭐ | 部分 | 驾驶舱扎实；但「待办」是摆设（目标/问题库 0 数据） |
| **session**（场次） | 15 | ⭐⭐⭐⭐⭐ | 充分 | **全场最佳**。排品四因子、复盘七件套、改进闭环全部有数据 |
| **assortment**（货盘） | 3 | ⭐⭐⭐⭐ | 部分 | 主数据与库存有数据；商品结构分析弱 |
| **traffic**（流量与投放） | 17 | ⭐⭐⭐ | **严重不足** | 14 个平台专属洞察中，大部分背后无数据；投放 ROI 能算但 `ad_plan` 仅 2 行 |
| **fulfillment**（履约售后） | 5 | ⭐⭐ | **零数据** | 5 个模块全部 0 数据——「不超卖、不违约」这个核心卖点目前是空话 |
| **content**（内容与达人） | 13 | ⭐⭐ | **接近零** | 13 项中 2 项是「正在开发」占位页；达人佣金、会员私域 0 数据 |
| **people**（人与钱） | 10 | ⭐⭐⭐⭐ | 部分 | HRBP 人效是亮点；但排班与场次未真正联动，5 个岗位角色零权限 |
| **data**（数据） | 5 | ⭐⭐⭐⭐⭐ | 充分 | 上传/清洗/质量链路真实可用，已实测 CSV 端到端 |
| **system**（系统） | 12 | ⭐⭐⭐⭐ | 充分 | 权限/审计/模块热插拔完整；合规风控 0 数据 |

### 2.3 最关键的三个数字

| 数字 | 含义 |
|:---|:---|
| **36 个导航项背后 0 数据或占位页** | 占 92 项的 39.1%。用户点开看到的是全 0 看板、空列表或「正在开发」 |
| **5 个角色 0 模块授权** | `floor_manager`/`warehouse`/`cs_agent`/`video_editor`/`brand_viewer`——这些岗位在业务里真实存在 |
| **20/22 店铺 manual_only** | 官方 API 接入仅 2 个，其余靠手动上传——「全渠道自动汇聚」暂未成立 |

---

## 三、逐组深度调研

### 3.1 today（今日作战）— 驾驶舱扎实，但「待办」是摆设

**业务语义**：运营每天上班第一件事——看大盘、看异常、处理待办。

| 模块 | 数据实况 | 判断 |
|---|---|---|
| 经营驾驶舱 / 全渠道大盘 | `fact_trade_daily` 140 行、`agg_*` 已回填 | ✅ 真实可看 |
| 实时监控 | 场次指标 140 行 | ✅ |
| BI 仪表盘 / 数据分析 | 取数原语已通 ✅ | ✅ |
| **目标达成** | `goal_tracking` **0 行** | ❌ 空页面 |
| **问题库** | `issue_library` **0 行** | ❌ 空页面 |
| **改进任务** | 依赖问题库，同样空 | ❌ |
| 异常中心 | `alert_events` 仅 2 行 | ⚠️ 几乎没有异常可看 |

**场景代入**：周一早上运营打开系统，想看「上周目标完成了吗」——空的；想看「待处理问题」——空的。**「今日作战」的作战对象不存在。**

**根因**：目标管理、问题库是需要**用户持续录入**的模块，但没有种子数据、也没有引导流程，用户第一次进来不知道要建目标。

> **建议**：把「目标达成 / 问题库 / 改进任务」三者串成一条**初始化向导**——首次登录引导建本月目标，之后每周自动生成复盘问题。

---

### 3.2 session（场次）— 全场最佳，真实业务的样板

这是系统**唯一做到「数据闭环」的分组**，也是最能体现产品价值的部分。

| 模块 | 数据实况 | 判断 |
|---|---|---|
| 场次管理 | 150 场次，139 已完成 | ✅ |
| **智能排品推荐** | 四因子（GMV/库存/短视频/点击）全真实 | ✅✅ **核心竞争力** |
| 场次排品 | 417 行排品，T/B/P 结构 | ✅ |
| 直播登记 / 登记数据 | 150 条登记 | ✅ |
| 复盘七件套（总览/商品/短视频/渠道/主播/漏斗/闭环） | 场次指标 140 行 + 短视频引流 501 行 | ✅ |

**场景代入**（这段是通的）：
1. 周一排品：运营打开「智能排品推荐」，系统基于上周各商品真实销量、库存、短视频引流、点击率给出 T/B/P 三组建议 → **可用**
2. 周三开播：短视频预热数据、场次实时指标正常记录 → **可用**
3. 下周一复盘：复盘总览能算出转化漏斗、主播效能、商品表现 → **可用**

**但有一个断裂**：排班与场次**没有真正联动**。

| 检查项 | 结果 |
|---|---|
| `session_staff_assignments`（排班到岗位） | 378 行，存在 |
| 排班日历（`schedule/calendar`） | 独立体系 |
| 排班 → 场次的引用关系 | **未打通** |

即：HRBP 在排班表里排了人，但场次详情里看不到「这场谁值班」，复盘时也无法按当班人效归因。

> **建议**：把 `session_staff_assignments` 提升为场次的一等公民——场次详情页展示当班岗位，复盘按岗位归因人效。数据已经有了（378 行），只差接线。

---

### 3.3 assortment（货盘）— 主数据扎实，结构分析弱

| 模块 | 数据实况 | 判断 |
|---|---|---|
| 商品主数据与库存 | 20 商品 / 20 库存档案，`available_qty` 生成列 | ✅ |
| 商品与渠道结构 | 80 行渠道配额 | ✅ |
| 商品结构分析 | 依赖 `fact_trade_daily` 按商品维度 | ⚠️ 能算但浅 |

**场景代入**：选品环节，运营能看库存、能看渠道配额。但**「我的货盘结构健康吗」**（引流款占比、利润款占比、滞销款）这类决策性问题，系统给不出答案。

> **建议**：基于已有的 T/B/P 排品数据，做一张「货盘结构健康度」视图——这是排品推荐的天然延伸。

---

### 3.4 traffic（流量与投放）— 项数最多，数据最空

**这是本次调研发现的最大反差**：17 个导航项（9 大分组中最多），但背后大面积无数据。

| 子模块 | 项数 | 数据实况 |
|---|---|---|
| 全域投放与净 ROI | 1 | `fact_ad_spend_daily` 140 行 ✅，但 `ad_plan` 仅 2 行 |
| 搜索词卡位 | 1 | `fact_search_keyword_daily` **0 行** ❌ |
| 万相台投放对账 | 1 | 依赖投流表 ⚠️ |
| **平台流量洞察** | **12** | 大部分 **0 数据** ❌ |
| 活动管理 | 1 | `promotions` **0 行** ❌ |
| 竞品观察 | 1 | `competitor_brands` **0 行** ❌ |

**平台洞察的实况**（14 个路由逐个核对）：

| 平台 | 专属洞察 | 数据 |
|:---|:---|:---|
| 抖音 | 短视频引流 / 三池统一调度 | ⚠️ 部分 |
| 淘系 | 三源流量 / 店铺×场次 / 品牌×场次 / 五层抵扣 / 官方立减 | ❌ 无数据 |
| 快手 | 公私域 / 间接成交 / 粉丝团 | ❌ 无数据 |
| 小红书 | 流量来源 / 买手画像 / 蒲公英 / 笔记→直播 | ❌ 无数据 |
| 视频号 | 公私域 / 全域带货 / 图文 | ❌ 无数据 |

**场景代入**：投手周一要对投流 ROI。`fact_ad_spend_daily` 有 140 行，ROI 能算出来——**这部分是真的**。但投手想知道「千川的计划执行进度」「万相台的关键词消耗」「搜索词卡位表现」——全空。

**更根本的问题**：这些平台洞察的**数据来源是什么？** 抖音/淘宝/视频号的官方 API 需要授权，20/22 店铺是 `manual_only`。也就是说**即使做了页面，数据也进不来**。

> **建议（重要）**：
> 1. **不要继续加平台洞察页面**。在「官方 API 接入」真正跑通 1-2 个平台前，新增页面只是增加空界面。
> 2. 把 12 个平台洞察**按「有数据才有页面」原则收敛**，无数据的先隐藏（模块热插拔已具备这个能力）。
> 3. 优先打通**一个平台**的 API 直连（建议抖音，因为是主阵地且已有部分数据），作为标杆。

---

### 3.5 fulfillment（履约售后）— 核心卖点，全部空转

**这是最需要向老大如实汇报的一组。**

README 的核心业务价值写着：

> - **全链路履约风控，杜绝超卖违规**：多平台渠道库存动态锁库，48 小时发货 SLA 全程监控
> - **售后与工单闭环**

**实测数据**：

| 表 | 行数 |
|---|:---:|
| `fact_fulfillment_waybill`（运单） | **0** |
| `fact_after_sale_tickets`（售后工单） | **0** |
| `fact_cs_session`（客服会话） | **0** |
| `canonical_refund_events`（退款事件） | **0** |
| `fact_settlement_cycles`（结算账期） | **0** |

5 个导航项（履约 SLA / 售后工单 / 客服响应 / 退款分析 / 异常检测）背后**全部为 0**。

**但有一个重要例外**：**防超卖的代码是真的**。

| 检查项 | 结果 |
|---|---|
| `POST /inventory/reservations/reserve`（原子锁库） | ✅ 已实现，实测可用 |
| `fact_inventory_reservation`（预留单） | 有表、有逻辑 |
| 渠道配额 `dim_product_channel_listing` | 80 行 |
| 48h SLA 预警 | 有代码、**无数据** |

**判断**：防超卖的**引擎**造好了，但**没有订单数据喂它**。`canonical_orders` 有 420 行，但没有生成运单、退款、售后。

**场景代入**：用户最怕的「超卖被平台罚款」「48 小时不发货被判违规」——系统目前**既不能预警（无运单数据），也不能统计（无售后数据）**。而这是 README 里对用户承诺的第二大价值。

> **建议**：把 `canonical_orders`（已有 420 行）**向下游延伸**——生成运单、退款事件、售后工单。这是「让已有数据产生业务价值」最高杠杆的一件事，且不需要外部 API。

---

### 3.6 content（内容与达人）— 13 项中 2 项占位，其余无数据

| 子模块 | 项数 | 数据实况 |
|---|---|---|
| 内容排产与归因 | 1 | `fact_content_daily` **0**、`content_schedules` **0** ❌ |
| 达人合作与佣金 | 1 | `fact_kol_cooperation` **0** ❌ |
| 会员与私域 | 1 | `platform_members_summary` **0** ❌ |
| 内容创作（视频创作/视频数据/生成配置） | 3 | 视频创作 = **「正在开发」占位页**；视频数据 = **「正在开发」占位页** |
| 小红书内容 | 5 | `xhs_note` **0** ❌ |
| 视频号内容 | 3 | 无数据 ❌ |

**实测确认的占位页**（全站仅 2 个，都在这里）：
- `VideoCreatePage.tsx` → 「正在开发 / 即将上线」
- `VideoDataPage.tsx` → 「正在开发 / 即将上线」

**场景代入**：小红书是 5 个平台里**种草逻辑最特殊**的（种草→回搜→成交），系统做了 5 个专属页面（买手画像、蒲公英、笔记→直播→成交），说明产品想清楚了。但 `xhs_note` 0 行——**想清楚了，没数据**。

> **建议**：
> 1. 两个占位页应从导航**隐藏**（模块热插拔可做），避免用户点进空壳。
> 2. 小红书 5 件套是差异化亮点，但**必须等 API 接入**。建议作为「第二个打通的平台」。
> 3. 达人佣金（`fact_kol_cooperation`）是独立于平台 API 的——**用户可以手动录入**，应补引导。

---

### 3.7 people（人与钱）— HRBP 人效是亮点，岗位权限断层

**HRBP 工作台（本轮已建）**：

| 能力 | 状态 |
|---|---|
| 人效核心 KPI（人均 GMV / 场均 / 时长 / 小时人效） | ✅ 有数据 |
| 人效明细榜（5 种排序） | ✅ |
| 工时利用率（排班 vs 开播） | ✅ 378 排班行 |
| 新人爬坡曲线 | ✅ |
| 人效风险（下滑/零产出/高缺勤） | ✅ |
| 人才画像 / 考勤 / 绩效 / 培训 | ✅ |

**场景代入**：HRBP 周一评估人效——**这段完全可用**，且是竞品少有的深度。

**但权限模型存在严重断层**：

| 角色 | 业务里是谁 | 模块授权数 |
|:---|:---|:---:|
| `floor_manager` | 场控（直播现场指挥） | **0** |
| `warehouse` | 仓储（发货/入库） | **0** |
| `cs_agent` | 客服（售后第一线） | **0** |
| `video_editor` | 拍剪（内容生产） | **0** |
| `brand_viewer` | 品牌方（甲方查看） | **0** |

而系统里明明有：客服响应绩效模块、拍剪岗位字典（`staff_role_dict` 有 `video_editor`）、品牌方门户页面（`/brand-portal`）。

**这是一个「角色建了、模块做了、权限没给」的三不管状态。**

另外，`hrbp` 角色本身只有 **5 个模块**（ai / anchor / overview / personal_achievement / system_personnel_ops）——HRBP 看不到场次、看不到人效相关的复盘数据，只能看自己那个工作台。

> **建议**：
> 1. **补齐 5 个零权限角色的最小授权**：场控→场次+直播间；仓储→商品库存+履约；客服→售后+客服；拍剪→内容；品牌方→只读看板。
> 2. **给 hrbp 补 `session` / `review_*` 只读权限**，否则人效分析缺上下文。

---

### 3.8 data（数据）— 全站最实的一组，已实测

| 模块 | 状态 |
|---|---|
| 数据管理 / 上传 | ✅ 实测 CSV 端到端通过 |
| 上传数据管理 | ✅ |
| 多平台接入（自定义清洗） | ✅ 双轨（API / 文件）路由齐备 |
| 数据质量 | ✅ 七段清洗管道 + 质量门禁 |

**本轮实测的完整链路**：
```
POST /ingest/preview (trade.csv, douyin)
  → 解析 2 行 / 7 列表头
  → 8 个标准字段自动映射
  → 清洗报告：2 入 / 2 成功 / 0 丢弃
  → 表头指纹 e24e46f3…（可复用映射）
  → mappedPreview 数据正确
```

**这一组证明了一件事**：系统的数据处理引擎是**真能用的**。问题不在能力，在数据没进来。

---

### 3.9 system（系统）— 基建完整，合规空转

| 模块 | 状态 |
|---|---|
| 账号管理 / 角色与模块权限 | ✅ 15 角色 × 41 模块 |
| **模块热插拔** | ✅ 超管可关停非核心模块（本轮已建） |
| 平台与渠道管理 | ✅ 8 平台配置，jd/pdd 已下线 |
| 直播间管理 | ✅ |
| 系统配置 / 字典 / 异步任务 / 审计日志 | ✅ |
| 平台规则雷达 / 违规事件看板 | ❌ `compliance_events` **0 行** |

**场景代入**：管理员配权限、关模块、看审计——都可用。但「平台规则雷达」是合规刚需（抖音违禁词、天猫广告法），目前 0 数据。

---

## 四、从真实场景看的四个断点

把 92 个模块放回「一周运营」时间线，断裂处非常清晰：

```
周一 定目标 ────► [目标达成 0 数据] ────► 断点①：没有目标，一周作战没有锚
      选品排品 ──► [智能排品 ✅] ──────► 通
      排班 ──────► [排班 ✅ 但场次不联动] ► 断点②：排了人，场次不知道
      
周二~周日 开播 ─► [场次/复盘 ✅] ──────► 通
      投放调整 ──► [ROI ✅ / 计划❌] ────► 断点③：能算账，不能管计划
      订单履约 ──► [运单/售后/客服 全 0] ► 断点④：核心卖点空转
      
下周一 复盘 ────► [复盘七件套 ✅] ──────► 通
      人效评估 ──► [HRBP 人效 ✅] ──────► 通
      问题闭环 ──► [问题库 0 数据] ─────► 与断点①同源
```

### 四个断点的性质完全不同

| 断点 | 性质 | 能否自己修 |
|:---|:---|:---:|
| ① 目标/问题库空 | **产品设计缺失**：缺初始化引导与持续录入机制 | ✅ 能，加向导 |
| ② 排班与场次不联动 | **接线缺失**：数据已有（378 行），差关联 | ✅ 能，改查询 |
| ③ 投放计划空 | **依赖外部**：计划来自千川/万相台 API | ⚠️ 部分能（手动录计划） |
| ④ 履约售后全空 | **数据未延伸**：订单已有（420 行），未生成下游 | ✅ 能，最高杠杆 |

---

## 五、优先级建议

按「业务价值 × 可自主完成 × 不依赖外部 API」排序：

### P0 — 立刻做，不依赖任何外部条件

| # | 事项 | 理由 |
|---|---|---|
| 1 | **订单数据向下游延伸**：从 `canonical_orders` 生成运单、退款、售后工单 | 让 420 行已有数据产生业务价值；直接激活履约/售后/客服 5 个模块；README 承诺的核心卖点从此成立 |
| 2 | **排班与场次联动**：场次详情展示当班岗位，复盘按岗位归因 | 数据已有（378 行），只差查询接线；HRBP 人效立刻有上下文 |
| 3 | **目标/问题库初始化向导** | 断点①的根因；没有目标，整个「今日作战」分组是空壳 |

### P1 — 需要产品决策

| # | 事项 | 需要你定 |
|---|---|---|
| 4 | 补齐 5 个零权限角色的最小授权 | 这些岗位是否在本期服务范围内？ |
| 5 | 无数据的平台洞察页面是否隐藏 | 「丑但诚实」vs「先藏着」 |
| 6 | 两个「正在开发」占位页的处理 | 隐藏 / 删除 / 补说明 |

### P2 — 依赖外部条件

| # | 事项 | 阻塞点 |
|---|---|---|
| 7 | 打通 1 个平台官方 API 直连（建议抖音） | 需真实店铺授权凭证 |
| 8 | 投流计划、搜索词卡位、小红书内容 | 依赖 API |
| 9 | 合规规则雷达 | 需平台规则数据源 |

---

## 六、给老大的诚实判断

### 6.1 这个系统的真实状态

如果用「能不能卖给客户」衡量：

| 业务环节 | 状态 |
|:---|:---|
| 直播中 + 复盘 | **可交付**，数据闭环完整，排品四因子是差异化竞争力 |
| 数据接入（手动上传） | **可交付**，已实测端到端 |
| 播前计划（目标/排品/排班） | **半成品**，排品强、目标空、排班未联动 |
| 播后履约（订单→发货→售后） | **不可交付**，引擎在、数据无 |
| 多平台自动化 | **不可交付**，20/22 店铺靠手动上传 |

### 6.2 最值得肯定的一件事

**排品推荐引擎**（`assortment-engine.ts`）是本系统最接近「真实业务」的模块——它用真实的 GMV 销量、库存、短视频引流、点击转化四个因子打分，fail-closed、可解释、角色语义清晰。这说明团队**有能力做出贴合业务的东西**，问题是这个能力没有覆盖到其他分组。

### 6.3 最需要正视的一件事

README 对用户承诺的「**全链路履约风控，杜绝超卖违规**」，目前是**代码就绪、数据为零**。防超卖的原子锁库逻辑写好了，但没有订单喂它；48h SLA 预警写好了，但没有运单。**承诺与现状之间有 gap**，要么补数据（P0-1），要么在交付时明确说明范围。

---

## 附录：调研证据索引

| 证据 | 来源 |
|---|---|
| 92 导航项 / 9 分组清单 | `apps/web/src/data/route-manifest.ts` |
| 41 模块 / 15 角色授权矩阵 | `system_modules` / `role_modules` |
| 事实表数据覆盖 | 22 张表 `count(*)` 实测 |
| 空数据模块 API 实况 | 10 个接口 curl 实测（均返回全 0 结构） |
| 占位页 | `grep "正在开发"` 全站 2 个 |
| CSV 上传端到端 | `/ingest/preview` 实测 |
| 防超卖可用性 | `/inventory/reservations/reserve` 实测 |
| HRBP 人效 9 接口 | `hr_li` 登录态实测全 200 |
| 店铺授权状态 | `dim_shop.auth_status`：2 authorized / 20 manual_only |

---

## 附录 A：92 个导航项逐项对照（模块 / 路由 / 权限 / 数据支撑实况）

> 本表覆盖  全部 92 项，逐项标注数据支撑实况。
> 图例：✅ 有真实数据 ｜ ⚠️ 有代码但数据稀薄 ｜ ❌ 0 数据或占位页


**today 今日作战**

| 模块 | 路由 | 权限（module） | 数据支撑实况 |
|:---|:---|:---|:---|
| 首页 | `/overview/home` | `overview` | fact_trade_daily 140 / agg_* 已回填 ✅ |
| 经营驾驶舱 ·经营与看板 | `/overview/cockpit` | `overview` | fact_trade_daily + agg_shop_daily ✅ |
| 实时监控 ·经营与看板 | `/overview/live-monitor` | `overview` | session_overview_metrics 140 ✅ |
| 数据分析 ·经营与看板 | `/overview/analytics` | `overview` | 取数原语已通 ✅ |
| 全渠道大盘 ·经营与看板 | `/omnichannel/dashboard` | `overview` | fact_trade_daily 140 ✅ |
| 店铺经营看板 ·经营与看板 | `/shop/overview` | `overview` | fact_trade_daily（按店铺）✅ |
| 淘系店铺看板 ·经营与看板 | `/shop/taobao/board` | `overview` | fact_trade_daily（taobao/tmall）✅ |
| BI 仪表盘 ·经营与看板 | `/bi/dashboard` | `bi` | 取数原语已通 ✅ |
| 目标达成 ·待办与目标 | `/ops/goal-tracking` | `ops` | goal_tracking 0 ❌ |
| 改进任务 ·待办与目标 | `/system/tasks` | `system_tasks` / 'system_tasks', 'ops' | 依赖 issue_library 0 ❌ |
| 问题库 ·待办与目标 | `/ops/issue-library` | `ops` | issue_library 0 ❌ |
| 异常中心 ·待办与目标 | `/system/alerts` | `system_alerts` | alert_events 2 ⚠️ |

**session 场次**

| 模块 | 路由 | 权限（module） | 数据支撑实况 |
|:---|:---|:---|:---|
| 场次管理 | `/overview/sessions` | `session` | live_registrations 150 ✅ |
| 场次排品 | `/ops/session-products` | `session_products` | session_plan_products 417 ✅ |
| 智能排品推荐 | `/ops/assortment-recommend` | `session_products` | 四因子全真实 ✅✅ |
| 直播间健康度 | `/ops/room-health` | `ops` | room_health 0 ⚠️ |
| 多直播间总览 | `/system/multi-room` | `system_multiroom` | multi_room_status 0 ⚠️ |
| 个人达成 ·人工登记 | `/live/attendance` | `personal_achievement` | personal_achievement（按用户）✅ |
| 直播登记 ·人工登记 | `/live/registration` | `live_registration` | live_registrations 150 ✅ |
| 登记数据管理 ·人工登记 | `/live/data` | `live_data` | live_registrations ✅ |
| 复盘总览 ·直播复盘 | `/review/overview` | `review_overview` | session_overview_metrics 140 ✅ |
| 商品分析 ·直播复盘 | `/review/products` | `review` | session_plan_products 417 ✅ |
| 短视频引流 ·直播复盘 | `/review/short-videos` | `review` | session_short_video_traffic 501 ✅ |
| 渠道流量 ·直播复盘 | `/review/channels` | `review_channels` | session_channel_metrics ⚠️ |
| 主播效能 ·直播复盘 | `/review/anchors` | `review_anchors` | session_anchor_metrics 140 ✅ |
| 转化漏斗 ·直播复盘 | `/review/funnel` | `review_funnel` | session_overview_metrics ✅ |
| 改进闭环 ·直播复盘 | `/review/closed-loop` | `review_closed_loop` | 依赖 issue_library 0 ❌ |

**assortment 货盘**

| 模块 | 路由 | 权限（module） | 数据支撑实况 |
|:---|:---|:---|:---|
| 商品结构分析 | `/shop/products` | `product_center` | fact_trade_daily（商品维度）⚠️ |
| 商品主数据与库存 | `/ops/inventory` | `product_center` | dim_product 20 / fact_inventory_stock 20 ✅ |
| 商品与渠道结构 | `/shop/taobao/product-channel` | `overview` / 'overview', 'ops' | dim_product_channel_listing 80 ✅ |

**traffic 流量投放**

| 模块 | 路由 | 权限（module） | 数据支撑实况 |
|:---|:---|:---|:---|
| 全域投放与净ROI | `/ops/net-roi` | `net_roi` / roles:'super_admin', 'admin', 'ops_director', 'ad_buyer' | fact_ad_spend_daily 140 ✅ / ad_plan 2 ⚠️ |
| 搜索词卡位 | `/ops/search-keywords` | `search_seo` | fact_search_keyword_daily 0 ❌ |
| 万相台投放对账 | `/shop/taobao/ad-reconciliation` | `overview` / 'overview', 'ops' | 依赖投流表 ⚠️ |
| 抖音短视频引流 ·平台流量洞察 | `/insights/douyin/short-video` | `review_channels` | session_short_video_traffic 501 ✅ |
| 抖音三池统一调度 ·平台流量洞察 | `/insights/douyin/three-pools` | `review_channels` | 无专属表 ❌ |
| 淘系三源流量 ·平台流量洞察 | `/insights/taobao/three-sources` | `review_channels` | 无专属表 ❌ |
| 店铺×场次联动 ·平台流量洞察 | `/insights/taobao/shop-session` | `overview` | 无专属表 ❌ |
| 天猫品牌×场次 ·平台流量洞察 | `/insights/tmall/brand-sessions` | `session` | 无专属表 ❌ |
| 五层抵扣规则 ·平台流量洞察 | `/insights/tmall/promotion-layers` | `system_promotions` | 无专属表 ❌ |
| 直播与官方立减联动 ·平台流量洞察 | `/insights/tmall/live-promo-link` | `review_channels` | 无专属表 ❌ |
| 快手公私域流量 ·平台流量洞察 | `/shop/kuaishou/traffic-split` | `bi` | 无专属表 ❌ |
| 快手间接成交 ·平台流量洞察 | `/shop/kuaishou/indirect-gmv` | `bi` | 无专属表 ❌ |
| 快手粉丝团运营 ·平台流量洞察 | `/shop/kuaishou/fans-team` | `ops` | 无专属表 ❌ |
| 小红书流量来源 ·平台流量洞察 | `/insights/xiaohongshu/traffic-sources` | `review_channels` | xhs_note 0 ❌ |
| 视频号公私域 ·平台流量洞察 | `/insights/wechat/private-public` | `review_channels` | 无专属表 ❌ |
| 活动管理 ·营销与竞品 | `/system/promotions` | `system_promotions` / 'system_promotions', 'ops' | promotions 0 ❌ |
| 竞品观察 ·营销与竞品 | `/system/competitors` | `system_competitors` / 'system_competitors', 'ops' | competitor_brands 0 ❌ |

**fulfillment 履约售后**

| 模块 | 路由 | 权限（module） | 数据支撑实况 |
|:---|:---|:---|:---|
| 履约SLA与赔付风控 | `/ops/fulfillment` | `fulfillment` | fact_fulfillment_waybill 0 ❌ |
| 售后工单与原因归因 | `/ops/after-sales` | `after_sales` | fact_after_sale_tickets 0 ❌ |
| 客服响应与绩效 | `/ops/cs` | `customer_service` | fact_cs_session 0 ❌ |
| 退款分析 | `/bi/refund-analysis` | `bi` | canonical_refund_events 0 ❌ |
| 异常检测 | `/bi/anomaly-detection` | `bi` | alert_events 2 ⚠️ |

**content 内容达人**

| 模块 | 路由 | 权限（module） | 数据支撑实况 |
|:---|:---|:---|:---|
| 内容排产与归因 | `/content/schedule` | `content_schedule` | fact_content_daily 0 / content_schedules 0 ❌ |
| 达人合作与佣金 | `/ops/kol` | `kol` | fact_kol_cooperation 0 ❌ |
| 会员与私域 | `/ops/members` | `members` | platform_members_summary 0 ❌ |
| 视频创作 ·内容创作 | `/content/video-create` | `content` | 「正在开发」占位页 ❌ |
| 视频数据 ·内容创作 | `/content/video-data` | `content` | 「正在开发」占位页 ❌ |
| 生成服务配置 ·内容创作 | `/content/center-config` | `content` / 'content', 'system_ai' | content_providers 配置 ✅ |
| 笔记经营看板 ·小红书内容 | `/shop/xiaohongshu/notes` | `content` | xhs_note 0 ❌ |
| 种草转化链路 ·小红书内容 | `/shop/xiaohongshu/conversion` | `content` | xhs_note 0 ❌ |
| 笔记→直播→成交 ·小红书内容 | `/insights/xiaohongshu/note-live` | `content` | xhs_note 0 ❌ |
| 买手画像 ·小红书内容 | `/insights/xiaohongshu/buyer-profile` | `anchor` | xhs_note 0 ❌ |
| 蒲公英达人合作 ·小红书内容 | `/insights/xiaohongshu/dandelion` | `kol` | fact_kol_cooperation 0 ❌ |
| 视频号全域带货 ·视频号内容 | `/insights/wechat/affiliate` | `anchor` | 无专属表 ❌ |
| 视频号图文内容 ·视频号内容 | `/insights/wechat/content` | `content` | 无专属表 ❌ |

**people 人与钱**

| 模块 | 路由 | 权限（module） | 数据支撑实况 |
|:---|:---|:---|:---|
| 话术库 | `/ops/script-library` | `ops` / 'ops', 'anchor' | script_library 4 ✅ |
| 主播列表 ·主播 | `/anchors/list` | `anchor` | anchors 12 ✅ |
| 主播档案 ·主播 | `/anchors/profile` | `anchor` | anchor_profiles 12 ✅ |
| 训练管理 ·主播 | `/anchors/training` | `anchor` | anchor_training_plans 4 ✅ |
| 能力看板 ·主播 | `/ops/capabilities` | `ops` / 'ops', 'anchor' | anchor_capabilities 12 ✅ |
| 直播排班 ·排班与绩效 | `/anchors/live-schedule` | `anchor` | schedule 体系 ✅ |
| 排班设置 ·排班与绩效 | `/anchors/schedule` | `anchor` | staff_role_dict ✅ |
| 我的排班 ·排班与绩效 | `/anchors/my-schedule` | `anchor` / 'personal_achievement', 'anchor' | session_staff_assignments 378 ✅ |
| 我的业绩 ·排班与绩效 | `/anchors/my-performance` | `anchor` / 'personal_achievement', 'anchor' | live_registrations ✅ |
| HRBP 工作台 ·排班与绩效 | `/hrbp/workspace` | `anchor` / 'anchor', 'system_personnel_ops' | 人效 9 接口全 ✅✅ |

**data 数据**

| 模块 | 路由 | 权限（module） | 数据支撑实况 |
|:---|:---|:---|:---|
| 数据管理 | `/data/management` | `data` | 上传链路实测通 ✅ |
| 数据上传 | `/data/upload` | `data` | /ingest/preview 实测通 ✅ |
| 上传数据管理 | `/data/uploaded-data` | `data` | data_uploads ✅ |
| 多平台接入（自定义清洗） | `/data/ingest` | `data` | 双轨路由齐备 ✅ |
| 数据质量 | `/data/quality` | `data` | 七段清洗管道 ✅ |

**system 系统**

| 模块 | 路由 | 权限（module） | 数据支撑实况 |
|:---|:---|:---|:---|
| 账号管理 ·系统运维 | `/system/users` | `system_users` / roles:'super_admin', 'admin' | users 34 ✅ |
| 角色与模块权限 ·系统运维 | `/system/roles` | `system_users` / roles:'super_admin', 'admin' | 15 角色 × 41 模块 ✅ |
| 运营人员管理 ·系统运维 | `/system/personnel` | `system_personnel_ops` | operators 6 ✅ |
| 平台与渠道管理 ·系统运维 | `/system/platforms` | `system_users` / roles:'super_admin', 'admin' | system_platform_configs 8 ✅ |
| 直播间管理 ·系统运维 | `/system/rooms` | `system_rooms` | live_rooms 4 ✅ |
| 系统配置 ·系统运维 | `/system/config` | `system_config` / roles:'super_admin' | system_config ✅ |
| 模块热插拔 ·系统运维 | `/system/modules` | `system_config` / roles:'super_admin' | 28 核心保护 ✅ |
| 异步任务与运维队列 ·系统运维 | `/system/jobs` | `system_config` / roles:'super_admin', 'admin', 'ops_director', 'operator' | system_jobs ✅ |
| 字典管理 ·系统运维 | `/system/dict` | `system_dict` / roles:'super_admin' | dim_category 等 ✅ |
| 操作审计日志 ·系统运维 | `/system/audit-logs` | `audit_logs` / roles:'super_admin', 'admin' | audit_logs ✅ |
| 平台规则雷达 ·合规风控 | `/compliance/rules` | `compliance` | compliance_events 0 ❌ |
| 违规事件看板 ·合规风控 | `/compliance/events` | `compliance` | compliance_events 0 ❌ |

### 附录 A 统计

| 数据支撑 | 项数 | 占比 |
|:---|:---:|:---:|
| ✅✅ 核心竞争力（有数据且为差异化） | 2 | 2.2% |
| ✅ 有真实数据 | 47 | 51.1% |
| ⚠️ 有代码、数据稀薄 | 7 | 7.6% |
| ❌ 0 数据或占位页 | 36 | 39.1% |
| **合计** | **92** | **100%** |

---

## 补记（2026-11-18）：履约/售后/客服/退款演示数据已补齐

老大指出「运单/售后/客服/退款表，演示数据没把这部分内容做进去吗」——确实没有，这是演示数据生成器的遗漏。

**已修复**：`database/demo/generate.mjs` 新增 6.5b 段，从已有 `canonical_orders`（420 行）向下游派生：

| 表 | 行数 | 内容 |
|:---|:---:|:---|
| `fact_fulfillment_waybill` | 420 | 48h 发货时限；378 已签收 / 39 待发货 / 3 已发货未揽收；15 单延迟、3 单假发货风险、14 单预计赔付 |
| `canonical_refund_events` | 25 | 约 6% 退款率，仅退款/退货退款/换货三型 |
| `fact_after_sale_tickets` | 25 | 6 类原因归因 + 15% 自治保护 + 工单状态机 |
| `fact_cs_session` | 480 | 4 客服 × 2 班次 × 120 日；响应率 96.8%、超时率 2.3%、询单转化 28.2%、客服贡献 GMV 163.7 万 |

**API 实测**（从全 0 变为有业务数据）：
- `/fulfillment/overview`：420 运单 / 39 待发货 / 15 延迟 / 3 假发货 / 预计赔付 2310.75 元 / 分平台合规率（抖音 95.2%）
- `/after-sales/overview`：28 工单 / 24 未结 / 2 自治保护 / 退款 72582.22 元 / 原因归因（买家反悔 43.9%）
- `/cs/overview`：4 客服 / 23035 会话 / 响应率 96.8% / 询单转化 28.2% / 贡献 GMV 163.7 万

**修掉的两个真实 bug**：
1. `CROSS JOIN LATERAL (SELECT random() ...)` 只求值一次，导致 420 单全部 signed、零风险 → 改为每行独立 `random()`
2. PG 的 `SET a = b, c = a` 左边赋值对右边不可见，导致 `converted_gmv` 恒 0 → 拆成两条 UPDATE

**剩余 0 数据表**（均为外部依赖或按决策不做）：`fact_settlement_cycles`（财务）、`fact_kol_cooperation`（达人佣金，可手动录入）、`fact_content_daily`/`xhs_note`/`fact_search_keyword_daily`（依赖平台 API）、`goal_tracking`/`issue_library`/`promotions`/`competitor_brands`/`compliance_events`（需用户持续录入）。

---

## 补记二（2026-11-18）：P0 断点①②已闭环

### 断点②：排班与场次联动（已打通）

**改动**：`apps/api/src/routes/overview.ts` 的 `/overview/sessions` 新增 `staff` 字段，把 `session_staff_assignments`（378 行）的岗位分工带出场次列表；`SessionsPage.tsx` 在主播列下方渲染当班岗位标签。

**实测**：140 个场次全部带出岗位分工，示例「淘宝直播一号间 | 郑小榆 → 主播:郑小榆, 运营:中控-柚子, 编导:褚杏杏」。

### 断点①：目标/问题库（目标管理已闭环）

**改动**：`apps/api/src/routes/ops.ts` 新增目标 CRUD（POST/PUT/DELETE），原先只有 GET，用户无法自建目标；`database/demo/generate.mjs` 新增 6.7 段目标种子。

**目标种子取自真实体量**（非随手编）：

| 目标 | 目标值 | 当前值 | 进度 |
|:---|---:|---:|---:|
| 月度 GMV | 7,875,194 | 6,300,155 | 80% |
| 月度直播场次 | 91 | 76 | 84% |
| 月度订单量 | 50,907 | 44,267 | 87% |
| 季度 GMV | 22,680,558 | 6,300,155 | 28% |
| 年度 GMV | 88,202,170 | 6,300,155 | 7% |
| 人均产出（人效） | 60 分 | 48 分 | 80% |
| 售后处理时效 | 24 小时 | 18 小时 | 75% |

**CRUD 实测**：创建 → 更新当前值（progress 自动推导 3.5/5=70%）→ 改名 → 删除，全部 200。

### 过程中修掉的真实 bug

1. **动态 SQL 占位符漏写 `$`**：`sets.push(\`${col} = ${params.length}\`)` 生成的是 `current_val = 1`（字面量）而非 `current_val = $1`，导致 PG 报 `bind message supplies 2 parameters, but prepared statement requires 0`。`WHERE id` 同样漏写。
2. **SSH workspace 的 edit 工具未生效**：两次 edit 报告成功但服务器文件未变（本地挂载与远程实际路径不一致），后改用服务器端 `sed` 才真正落地。**教训：在 SSH workspace 改文件后必须 grep 服务器文件确认，不能只信 edit 返回。**

### 剩余断点

| 断点 | 状态 |
|---|---|
| ① 目标管理 | ✅ 已闭环（问题库 `issue_library` 仍 0，需用户持续录入） |
| ② 排班与场次联动 | ✅ 已闭环 |
| ③ 投放计划 | 仍依赖平台 API（`ad_plan` 仅 2 行） |
| ④ 履约售后 | ✅ 上一轮已补齐（运单 420 / 工单 25 / 客服 480） |

### 验收（2026-11-18）

| 项 | 结果 |
|:---|:---|
| 后端 tsc / 前端 tsc | 0 / 0 |
| 前端测试 | 3 套全绿 |
| **后端测试** | **145/145 全通过** |
| OpenAPI 漂移 | 0（421 路由） |
| CI 守卫 | 通过 |

---

## 补记三（2026-11-18）：问题库闭环 + 「自动检测一键转问题」

### 背景

上一轮补记二实现了目标 CRUD 与排班联动。本轮补上「问题库」这一环——此前 `issue_library` 表 0 行、路由只有 GET，前端虽展示了 24 个自动检测异常，却**无法把它转成可追踪的问题条目**，「问题库 → 改进任务 → 复盘」闭环断在第一环。

### 改动

**后端** `apps/api/src/routes/ops.ts` 新增问题库 CRUD：

| 接口 | 说明 |
|---|---|
| `POST /ops/issue-library` | 录入问题；**同标题重复录入自动合并**并累加 `occurrence_count`，返回 `merged: true` |
| `PUT /ops/issue-library/:id` | 更新问题（标题/分类/方案/详细方案/发生次数） |
| `DELETE /ops/issue-library/:id` | 删除问题 |

**前端** `IssueLibraryPage.tsx`：
- 每个自动检测卡片新增「转为问题条目」按钮，点击即把异常固化为问题（自动带上指标、实测值、阈值、严重度、来源维度）
- 转换结果 toast 提示（新建 / 合并累加）
- 抽出 `reload()` 供转换后刷新

### 实测

| 场景 | 结果 |
|---|---|
| 录入问题 | 创建成功 |
| 同标题再录 | `{"id":1,"occurrenceCount":2,"merged":true}`，DB 确认仅 1 条、次数 2 |
| 自动检测规模 | **24 项**，来自真实数据（如「冯柠柠 互动率偏低 0.1% vs ≥5%」high） |
| 问题库页面产物 | `IssueLibraryPage-CJcOQuWR.js` 已含「转为问题条目」 |

### 过程中的关键教训（值得记住）

1. **PG 的 `SET a=b, c=a` 左边赋值对右边不可见**：目标 `progress` 与客服 `converted_gmv` 两次都踩此坑，必须拆成两条 UPDATE。
2. **SSH workspace 的文件状态会与本地认知不一致**：`git checkout` 报告成功、`edit` 报告成功，但服务器文件实际未被改动/已被污染，导致同一份代码被重复插入 9 次。**最终可靠做法：`git show HEAD:file > /tmp/clean` → 在干净副本上 patch → 校验计数 → 再 cp 覆盖，且每步都 grep 验证。**

### 四个断点终态

| 断点 | 状态 |
|---|---|
| ① 目标管理 | ✅ 已闭环（含 progress 自动推导） |
| ①' 问题库 | ✅ 已闭环（含自动检测一键转问题、同题合并） |
| ② 排班与场次联动 | ✅ 已闭环 |
| ③ 投放计划 | 仍依赖平台 API |
| ④ 履约售后 | ✅ 已补齐 |

### 验收（2026-11-18）

| 项 | 结果 |
|:---|:---|
| 后端 tsc / 前端 tsc | 0 / 0 |
| 前端测试 | 3 套全绿 |
| **后端测试** | **145/145 全通过** |
| OpenAPI 漂移 | 0（424 路由，312 前端调用全匹配） |
| CI 守卫 | 通过 |
| web / api | 200 / 200 |

---

## 补记四（2026-11-18）：按真实组织架构配置角色权限

### 老大定义的使用者（本轮输入）

超管、运营总监、运营专员、投手、短视频运营（也可能是编导）、HRBP、客服后期（客服+仓配两角色合并）、中控（**每个直播间一个账号**，仅能访问「人工登记」下三个页面：个人达成、直播登记、登记数据管理；**登记数据管理的编辑权限不开放给中控**）。

### 关键发现：权限源表找错了

`access-resolver.ts` 的读取顺序是：

```
sys_role_permission（resource LIKE 'module:%'）  ← 真正的权限源
  ↓ 无记录时回退
role_module_grants
  ↓ 无记录时回退
role_modules                                  ← 我最初改的表（无效）
```

前几轮我一直在改 `role_modules`，对后端**零影响**。这是调研报告里「权限模型与业务场景断裂」的技术根因。

### 已执行的权限配置

**中控（controller）**——精确收敛到 3 个模块：

| 模块 | 页面 |
|---|---|
| `personal_achievement` | 个人达成 |
| `live_registration` | 直播登记 |
| `live_data` | 登记数据管理 |

同时移除了原先多给的 `overview`（会暴露经营驾驶舱、投放对账等 10 个页面）与 `session_products`。

**中控账号矩阵**（每直播间一个，共 5 个）：

| 账号 | 直播间 |
|---|---|
| `ctrl_douyin` | 抖音主直播间 |
| `ctrl_taobao` | 淘宝直播一号间 |
| `ctrl_xhs` | 小红书买手间 |
| `ctrl_wechat` | 视频号品牌间 |
| `ctrl_wu` | （原有通用中控） |

统一初始密码 `Admin@123456`。

**新建两个此前零授权的角色**：

| 角色 | 定位 | 模块 |
|---|---|---|
| `video_editor` | 短视频运营/编导 | content, content_schedule, kol, session, session_products, product_center, anchor, review 全 5 项, personal_achievement |
| `cs_agent` | 客服后期（客服+仓配合并） | after_sales, customer_service, fulfillment, product_center, session, review 全 5 项, personal_achievement |

**收敛**：
- `ops_staff`（运营专员）：移除 `system_alerts`/`system_competitors`/`system_multiroom`/`system_promotions`/`system_tasks`/`compliance`/`kol`/`members` 共 8 个非本职模块（32 → 24）
- `hrbp`：补齐 `session`/`review` 全 5 项/`live_data`/`live_registration`/`bi`/`ops` 共 11 个，让人效分析有上下文（5 → 16）

### 修掉的 3 个 guard 映射缺陷

| 缺陷 | 影响 | 修法 |
|---|---|---|
| `/api/v1/data/live` 映射到 `data` 模块 | 中控有 `live_data` 却读不到自己登记的数据（403） | 新增更具体的 `data/live → live_data` 映射（须放在 `/api/v1/data` 前） |
| `/api/v1/cs` 未在 MODULE_MAP | fail-closed 导致客服后期访问 `/cs/overview` 403 | 补 `cs → customer_service` |
| `/api/v1/data/live` 的 PUT/DELETE | 需确保中控只读 | `DATA_ADMIN_ROLES` 已排除 controller，实测 PUT/DELETE 均 403 |

### 实测边界（全部符合设计）

**中控 `ctrl_douyin`**：
```
✓ GET  /api/v1/data/live          200   （登记数据管理·读）
✓ GET  /api/v1/attendance         200   （个人达成）
✓ POST /api/v1/livereg/submit     200   （直播登记·提交）
✗ DELETE /api/v1/data/live/1      403   （编辑不开放）
✗ PUT    /api/v1/data/live/1      403   （编辑不开放）
✗ GET  /api/v1/overview/sessions  403   （越界）
✗ GET  /api/v1/system/users       403   （越界）
```

**video_lin / cs_qian**：
```
video_lin:  content/providers 200 | kol/overview 200 | review/overview 200
            system/users 403 | overview/sessions 403 | ops/goal-tracking 403 | assortment 403
cs_qian:    after-sales/overview 200 | fulfillment/overview 200 | cs/overview 200
            system/users 403 | overview/sessions 403 | ops/goal-tracking 403 | content/providers 403
```

5 个中控账号登录均 200，模块完全一致。

### 最终角色账号矩阵

| 角色 | 账号数 | 代表账号 |
|---|---:|---|
| super_admin | 1 | `admin` |
| admin | 2 | `manager_liu`, `finance_chen` |
| ops_director | 1 | `director_zhou` |
| operator | 1 | `operator_wang` |
| ops_staff | 1 | `staff_lin` |
| ad_buyer | 1 | `buyer_xu` |
| video_editor | 1 | `video_lin` |
| hrbp | 1 | `hr_li` |
| cs_agent | 1 | `cs_qian` |
| controller | **5** | `ctrl_douyin` / `ctrl_taobao` / `ctrl_xhs` / `ctrl_wechat` / `ctrl_wu` |
| employee | 2 | `anchor_shen`, `control_zhao` |

### 验收

| 项 | 结果 |
|---|---|
| 后端 tsc / 前端 tsc | 0 / 0 |
| 前端测试 | 3 套全绿 |
| **后端测试** | **145/145 全通过** |
| OpenAPI 漂移 | 0（424 路由） |
| CI 守卫 | 通过 |

---

## 补记五（2026-11-18）：自定义角色 + 权限配置真正生效

### 老大本轮要求

1. 「客服后期」更正为「**客服后端**」（客服与仓配合并）；
2. **增加功能：用户可以自己新增角色并配置相应的管理权限。**

### 阻塞：自定义角色建不出账号

`users.role` 上有硬编码 CHECK 约束，只允许 15 个内置角色值：

```sql
CHECK ((role)::text = ANY (ARRAY['super_admin','admin',...,'cs_agent','warehouse']))
```

→ 即使 `roles` 表新增了自定义角色，也无法给任何账号分配该角色。

**修法**：新增迁移 `database/migrations/168_custom_roles.sql`，把「枚举白名单」换成「引用 `roles.code` 的外键」：

```sql
ALTER TABLE public.users DROP CONSTRAINT users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_fkey
  FOREIGN KEY (role) REFERENCES roles(code) ON UPDATE CASCADE ON DELETE RESTRICT;
```

好处：新增角色立即可分配账号；删除角色时若有账号引用会被外键拦住，与「仍有账号使用的角色不可删」业务规则天然一致。

### 顺带修掉一个隐藏很久的缺陷：权限改了不生效

`PUT /system/roles/modules` 原先**只写 `role_modules`**，而 `access-resolver.ts` 的真实权限源是：

```
sys_role_permission（resource LIKE 'module:%'）  ← 第一优先级
  ↓ 无记录才回退
role_module_grants
  ↓ 无记录才回退
role_modules
```

→ 「角色与模块权限」页上的勾选，对后端**零影响**。

**修法**：`role_modules` 与 `sys_role_permission` 双写，保证前端配置真正生效。

### 新增能力

**后端** `apps/api/src/routes/system.ts`：

| 接口 | 说明 |
|---|---|
| `POST /system/roles` | 创建自定义角色 + 初始模块授权（双写两张表） |
| `PUT /system/roles/:code` | 修改角色名称/描述 |
| `DELETE /system/roles/:code` | 删除自定义角色 |
| `PUT /system/roles/modules` | **修复**：现同时写 `role_modules` 与 `sys_role_permission` |

**校验规则**：
- 角色编码：`^[a-z][a-z0-9_]{2,31}$`（3-32 位小写字母/数字/下划线，字母开头）
- `super_admin` 为保留编码，不可创建
- 编码重复 → 409
- 内置角色（11 个）不可删除 → 403
- 仍有账号使用的角色不可删除 → 409 并提示账号数

**前端** `RolesPage.tsx`：
- 角色列表头部「+ 新增」按钮 → 弹窗（编码/名称/描述/模块多选）
- 自定义角色悬停显示删除图标（内置角色不显示）
- 创建成功后自动选中新角色，便于继续微调权限

### 端到端实测

```
1. POST /system/roles  {code:"e2e_role", modules:["live_registration"]}
   → {"id":95,"code":"e2e_role"}

2. PUT  /system/roles/modules  {roleCode:"e2e_role", moduleCodes:["live_registration","live_data"]}
   → {"updated":true}

3. sys_role_permission 实际值：live_data,live_registration     ← 权限调整真的生效了

4. 建账号 e2e_user（role=e2e_role）→ 登录 200
   /auth/me modules: live_data, live_registration               ← 与第 2 步一致

5. 清理：DELETE users / DELETE roles → 各 1 行
```

### 角色改名

`cs_agent`：客服 → **客服后端**（职责：售前咨询、售后工单、评价维护、DSR，兼管仓配履约）

### 最终角色矩阵（11 正式账号 + 5 中控）

| 角色 | 账号 | 模块数 |
|---|---|---:|
| super_admin | `admin` | 41 |
| admin | `manager_liu`, `finance_chen` | 39 |
| ops_director | `director_zhou` | 34 |
| operator | `operator_wang` | 29 |
| ops_staff | `staff_lin` | 24 |
| ad_buyer | `buyer_xu` | 14 |
| video_editor | `video_lin` | 14 |
| hrbp | `hr_li` | 16 |
| cs_agent（客服后端） | `cs_qian` | 12 |
| controller（中控） | `ctrl_douyin`/`ctrl_taobao`/`ctrl_xhs`/`ctrl_wechat`/`ctrl_wu` | 3 |
| employee | `anchor_shen`, `control_zhao` | 3 |

### 验收

| 项 | 结果 |
|---|---|
| 后端 tsc / 前端 tsc | 0 / 0 |
| 前端测试 | 3 套全绿 |
| **后端测试** | **145/145 全通过** |
| OpenAPI 漂移 | 0（427 路由，316 前端调用全匹配） |
| CI 守卫 | 通过 |
| web / api | 200 / 200 |

---

## 补记六（2026-11-18）：中控增加「今天播什么 / 谁播 / 排什么品」只读权限

### 老大本轮要求

> 中控还能看到场次排品、排班，要知道今天播什么，由谁播。

（前一轮曾要求中控「仅能访问人工登记三个分组」，本轮补充：还需只读查看场次、排品、排班。）

### 权限调整：6 个模块，读开放、写全禁

| 模块 | 页面 | 权限 |
|---|---|---|
| `personal_achievement` | 个人达成 | 读写（自己的登记） |
| `live_registration` | 直播登记 | 读写（提交登记） |
| `live_data` | 登记数据管理 | **只读**（DELETE/PUT 403） |
| `session` | 场次管理 | **只读** |
| `session_products` | 场次排品 | **只读** |
| `anchor` | 主播列表 / 直播排班 / 排班设置 | **只读** |

### 发现的既有缺陷：中控原本能写场次和排品

`controller` 出现在三处写权限白名单里：

```ts
// sessions.ts（原）
const SESSION_WRITE_ROLES = ['super_admin','admin','ops_director','ops_staff','operator','controller']
// ops.ts（原）
const OPS_PLAN_WRITE_ROLES = ['super_admin','admin','ops_director','ops_staff','operator','controller']
// schedule.ts（原）
const SCHEDULE_WRITE_ROLES = [...,'hrbp','operator','controller','ad_buyer']
```

即中控**能新建/修改场次、改排品、改排班**——与「只读」诉求相反。已全部移除。

### 修掉的 guard 映射缺陷

`/api/v1/overview/sessions` 原映射到 `overview` 模块（中控未授权）→ 403。但前端「场次管理」页（`/overview/sessions`）正是走这个接口，中控有 `session` 模块却读不到。

新增更具体的映射（顺序敏感，须在 `/api/v1/overview` 之前）：

```ts
{ prefix: '/api/v1/overview/sessions',  module: 'session' },
{ prefix: '/api/v1/overview',          module: 'overview' },
```

### 实测边界（ctrl_douyin）

**读——全部 200**：
```
GET /overview/sessions      ← 今天播什么
GET /ops/session-plans      ← 排什么品
GET /schedule/calendar      ← 谁播（排班）
GET /anchors                ← 主播列表
GET /data/live              ← 登记数据管理（只读）
GET /attendance             ← 个人达成
```

**写——全部 403**：
```
POST   /sessions                 403
PATCH  /sessions/1               403
PUT    /sessions/1/slots         403
POST   /ops/session-plans        403
POST   /schedule/sessions/1/staff 403
DELETE /data/live/1              403
```

**越界——仍 403**：
```
/system/users          403
/ops/goal-tracking     403
/assortment/recommend  403
```

### 回归：其他角色未受影响

| 角色 | 场次/排品/排班写 |
|---|---|
| admin | 放行（500=过权限层，因 payload 空） |
| operator | 放行（400=过权限层） |
| hrbp | 排班写放行（400=过权限层） |
| cs_agent | 403（无写权限，正确） |
| video_editor | 403（无写权限，正确） |

### 前端无需改动

`Sidebar.tsx` 的 `canSee()` 基于 `/auth/me` 返回的 `allowedModules` 过滤，中控获授 6 个模块后，这三个页面的导航项**自动出现**。

### 验收

| 项 | 结果 |
|---|---|
| 后端 tsc / 前端 tsc | 0 / 0 |
| 前端测试 | 3 套全绿 |
| **后端测试** | **145/145 全通过** |
| OpenAPI 漂移 | 0（427 路由） |
| CI 守卫 | 通过 |
| web / api | 200 / 200 |
