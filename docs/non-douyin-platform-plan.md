# 非抖音平台功能补全 · 实施计划

> 制定日期：2026-11-08
> 依据：[各平台业务模型调研报告](./platform-business-model-comparison.md)
> 现状：抖音平台完整（144 场次、720 商品、360 渠道真实数据），**其余 6 平台事实表 0 行，功能为骨架**

---

## 一、核心诊断：为什么现在的功能"根本没用"

调研报告的 5 个差异化维度，逐条对照当前系统：

| 差异化维度 | 调研结论 | 系统现状 | 差距 |
|---|---|---|---|
| **① 成交口径** | 6 个平台 GMV 定义全不同（含货到付款/含间接成交/站内站外/三套口径）| `fact_trade_daily.gmv` 单字段，无口径标记 | 🔴 **完全缺失** |
| **② 经营单元** | 店铺/采销单/商品+团/快手号/笔记 | 只有 `dim_shop` 一种 | 🔴 **完全缺失** |
| **③ 流量来源体系** | 各平台来源目录不可复用 | `channel_name` 自由文本，无映射 | 🔴 **完全缺失** |
| **④ 推广归因模型** | 归因窗口 24h/14天/30天 各异，含间接成交 | `ad_roi` 单值 | 🔴 **完全缺失** |
| **⑤ 履约售后模型** | 状态机不同（拼多多有"待成团"）、SLA 各异 | 无订单表，只有日汇总 | 🔴 **完全缺失** |

**结论：当前系统是"把抖音直播的日报表，换了个平台名重复了 6 遍"。** 店铺经营看板、商品分析、退款分析这些页面，对非抖音平台全部建立在同一种「店铺×日期×渠道」扁平模型上，无法表达：
- 京东自营 vs POP 的两套口径
- 拼多多的成团状态与三套结算口径
- 快手的私域复购与间接成交
- 小红书的笔记经营与站外转化

---

## 二、修复总策略

### 不做「每平台一套」，做「语义层 + 平台扩展」

```
┌──────────────────────────────────────────────────────────┐
│ 展示层：按平台业态呈现不同页面与指标（已完成导航分层）        │
├──────────────────────────────────────────────────────────┤
│ 语义层：统一指标口径 + amount_type + attribution 维度      │  ← 新增
├──────────────────────────────────────────────────────────┤
│ 实体层：通用实体（shop/product/order）+ 平台扩展实体        │  ← 新增
│         group_buy / note / purchase_order / service_ticket │
├──────────────────────────────────────────────────────────┤
│ 事实层：fact_trade/traffic/ad/content                     │  ← 改造：加口径字段
└──────────────────────────────────────────────────────────┘
```

---

## 三、分阶段实施

### 阶段 A：数据底座改造（P0，必须先做）

> 没有这层，后面所有平台功能都是空中楼阁

#### A1. 成交口径模型 `metric_caliber`
**问题**：6 平台 GMV 定义不同，跨平台直接相加是错的。

**方案**：新增 `amount_type` 维度与 `platform_caliber_config` 表

```sql
-- 平台口径配置
CREATE TABLE platform_caliber_config (
  id serial PRIMARY KEY,
  platform_code varchar(32) NOT NULL,
  metric_code varchar(50) NOT NULL,
  amount_type varchar(30) NOT NULL,        -- 'gross_paid'|'gross_settled'|'net_settled'|'indirect_included'|'offline_cod_included'|'onsite'|'offsite'
  attribution_window_hours integer,        -- 归因窗口
  attribution_type varchar(20),            -- 'last_click'|'view'|'cross_platform'
  is_default boolean DEFAULT false,
  display_note text,                       -- 页面展示的口径说明
  UNIQUE(platform_code, metric_code, amount_type)
);

-- 事实表加口径字段
ALTER TABLE fact_trade_daily ADD COLUMN amount_type varchar(30) DEFAULT 'gross_paid';
ALTER TABLE fact_trade_daily ADD COLUMN attribution_window_hours integer;
```

**平台默认口径预设**（来自调研）：
| 平台 | 默认 amount_type | 归因窗口 | 说明 |
|---|---|---|---|
| taobao/tmall | gross_paid | 待核实 | 支付金额，未剔退款 |
| jd_pop | gross_paid（含货到付款）| 30 天 | 需标记 offline_cod_included |
| jd_self | gross_settled（供货金额）| — | 与 POP 不可相加 |
| pdd | gross_paid / gross_settled / net_settled | 14 天 | 三套并存 |
| kuaishou | indirect_included（含间接）| 24 小时 | 另有 net_settled |
| xiaohongshu | onsite / offsite | 跨平台 | 站内外分开 |
| douyin | gross_paid | — | 对照组 |

**工作量**：2 天

#### A2. 平台扩展实体
**问题**：拼多多有"团"、小红书有"笔记"、京东有"采销单"、快手有"粉丝团"。

**方案**：
```sql
-- 拼多多的团
CREATE TABLE pdd_group_buy (
  id bigserial PRIMARY KEY,
  biz_date date NOT NULL,
  shop_id bigint REFERENCES dim_shop(id),
  group_id varchar(64) NOT NULL,
  product_id varchar(64),
  status varchar(20) NOT NULL,             -- 'waiting'|'grouping'|'grouped'|'expired'
  group_size_required integer DEFAULT 2,
  group_size_actual integer DEFAULT 0,
  pay_amount numeric(14,2) DEFAULT 0,
  grouped_at timestamptz,
  UNIQUE(biz_date, shop_id, group_id)
);

-- 小红书的笔记
CREATE TABLE xhs_note (
  id bigserial PRIMARY KEY,
  biz_date date NOT NULL,
  shop_id bigint REFERENCES dim_shop(id),
  note_id varchar(64) NOT NULL,
  title varchar(300),
  note_type varchar(20),                   -- 'image_text'|'video'
  impressions bigint DEFAULT 0,
  reads bigint DEFAULT 0,
  likes bigint DEFAULT 0,
  collects bigint DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  follows integer DEFAULT 0,
  search_impressions bigint DEFAULT 0,     -- 搜索来源曝光（小红书独立维度）
  recruit_impressions bigint DEFAULT 0,
  onsite_gmv numeric(14,2) DEFAULT 0,
  offsite_gmv numeric(14,2) DEFAULT 0,     -- 站外成交（小红星回传）
  UNIQUE(biz_date, shop_id, note_id)
);

-- 京东采销单
CREATE TABLE jd_purchase_order (
  id bigserial PRIMARY KEY,
  biz_date date NOT NULL,
  shop_id bigint REFERENCES dim_shop(id),
  po_number varchar(64) NOT NULL,
  sku_code varchar(64),
  business_mode varchar(20) NOT NULL,      -- 'self_operated'|'pop_sop'|'pop_fbp'
  supply_price numeric(14,2),
  retail_price numeric(14,2),
  quantity integer,
  settle_amount numeric(14,2),
  UNIQUE(biz_date, shop_id, po_number)
);

-- 快手粉丝团/私域
CREATE TABLE kuaishou_fans_ops (
  id bigserial PRIMARY KEY,
  biz_date date NOT NULL,
  shop_id bigint REFERENCES dim_shop(id),
  account_id varchar(64) NOT NULL,         -- 快手号
  new_followers integer DEFAULT 0,
  fans_team_joiners integer DEFAULT 0,     -- 粉丝团新增
  follow_page_gmv numeric(14,2) DEFAULT 0, -- 关注页成交（私域）
  discover_page_gmv numeric(14,2) DEFAULT 0, -- 发现页成交（公域）
  indirect_gmv numeric(14,2) DEFAULT 0,    -- 间接成交
  UNIQUE(biz_date, shop_id, account_id)
);

-- 店铺扩展属性（承载业务模式等）
ALTER TABLE dim_shop ADD COLUMN business_mode varchar(20);
ALTER TABLE dim_shop ADD COLUMN shop_type varchar(30);
```

**工作量**：2 天

#### A3. 流量来源映射体系
**问题**：`channel_name` 是自由文本，各平台叫法完全不同。

**方案**：
```sql
-- 通用流量来源三级目录
CREATE TABLE dim_traffic_source (
  id serial PRIMARY KEY,
  code varchar(50) UNIQUE NOT NULL,
  name varchar(100) NOT NULL,
  level1 varchar(30) NOT NULL,  -- 自然搜索/推荐/私域/内容/付费/站外
  level2 varchar(30),
  platform_scope text[]         -- 空=全平台
);

-- 平台原始来源 → 通用来源 映射
CREATE TABLE platform_source_mapping (
  id serial PRIMARY KEY,
  platform_code varchar(32) NOT NULL,
  raw_source text NOT NULL,     -- 平台后台原始叫法
  source_code varchar(50) NOT NULL REFERENCES dim_traffic_source(code),
  match_type varchar(10) DEFAULT 'exact',  -- 'exact'|'contains'|'regex'
  priority integer DEFAULT 0,
  UNIQUE(platform_code, raw_source)
);
```

**预置映射**（来自调研）：
| 平台 | 原始来源 | 通用 code |
|---|---|---|
| 淘系 | 手淘搜索 | natural_search |
| 淘系 | 猜你喜欢 | recommend |
| 淘系 | 逛逛 | content |
| 京东 | 京东搜索 | natural_search |
| 京东 | 微信商城 | external |
| 拼多多 | 搜索 | natural_search |
| 拼多多 | 推荐 | recommend |
| 拼多多 | 拼团分享 | private |
| 快手 | 发现页 | recommend |
| 快手 | 关注页 | private |
| 小红书 | 搜索 | natural_search |
| 小红书 | 发现页 | recommend |
| 小红书 | 群聊 | private |

**工作量**：1.5 天

#### A4. 推广归因模型
**问题**：`fact_ad_daily.ad_roi` 单值，无法表达「直接/间接/净成交/不同窗口」。

**方案**：
```sql
ALTER TABLE fact_ad_daily ADD COLUMN attribution_window_hours integer DEFAULT 24;
ALTER TABLE fact_ad_daily ADD COLUMN attribution_type varchar(20) DEFAULT 'last_click';
ALTER TABLE fact_ad_daily ADD COLUMN direct_gmv numeric(14,2) DEFAULT 0;
ALTER TABLE fact_ad_daily ADD COLUMN indirect_gmv numeric(14,2) DEFAULT 0;
ALTER TABLE fact_ad_daily ADD COLUMN net_gmv numeric(14,2) DEFAULT 0;
ALTER TABLE fact_ad_daily ADD COLUMN ad_tool varchar(50);  -- 工具名（千川/金牛/万相台等）
```

**双源对账视图**（承认广告后台与商家后台数不一致）：
```sql
CREATE VIEW v_ad_reconciliation AS
SELECT platform_code, biz_date, shop_id,
       ad_tool,
       ad_gmv AS ad_platform_gmv,       -- 广告后台口径
       trade_gmv_attributed,            -- 商家后台口径
       ROUND((ad_gmv - trade_gmv_attributed) / NULLIF(trade_gmv_attributed,0) * 100, 2) AS diff_pct
FROM ...;
```

**工作量**：1.5 天

#### A5. 订单状态机与售后 SLA
**问题**：没有订单表，只有日汇总；拼多多的"待成团"、京东的 24h 售后兜底无处承载。

**方案**：
```sql
CREATE TABLE order_status_config (
  id serial PRIMARY KEY,
  platform_code varchar(32) NOT NULL,
  status_code varchar(30) NOT NULL,
  status_name varchar(50) NOT NULL,
  is_final boolean DEFAULT false,       -- 是否终态
  counts_as_gmv boolean DEFAULT false,  -- 该状态是否计入 GMV
  sort_order integer,
  UNIQUE(platform_code, status_code)
);

CREATE TABLE platform_sla_config (
  id serial PRIMARY KEY,
  platform_code varchar(32) NOT NULL,
  sla_type varchar(30) NOT NULL,        -- 'ship'|'aftersale_review'|'aftersale_receive'|'customer_service'
  threshold_hours integer NOT NULL,
  business_hours_only boolean DEFAULT false,  -- 京东客服 9-23 点
  penalty_note text,
  UNIQUE(platform_code, sla_type)
);
```

**预置状态机差异**：
| 平台 | 特有状态 | 计入 GMV |
|---|---|---|
| 拼多多 | `waiting_group`（待成团）| ❌ 不计入，成团后才算 |
| 京东 | `cod_pending`（货到付款待收）| ✅ 计入但标记 |
| 快手 | 无特殊 | — |
| 小红书 | `offsite_converted`（站外转化）| 单独口径 |

**预置 SLA**：
| 平台 | 类型 | 阈值 |
|---|---|---|
| 京东 | aftersale_review | 24h |
| 京东 | aftersale_receive | 24h |
| 京东 | ship（延迟发货减分）| 48h |
| 京东 | customer_service（9-23点）| 响应时长 |
| 拼多多 | ship（发货+揽收）| 48h |
| 拼多多 | refund_rate 分母 | 已成团订单 |

**工作量**：2 天

**阶段 A 合计：9 天**

---

### 阶段 B：平台专属功能页面（P1）

> 基于 A 的数据底座，为每个平台做真正符合其业务的功能

#### B1. 淘宝/天猫（2 天）
**核心**：店铺 + SKU 货架经营

| 功能 | 说明 | 现有页面改造 |
|---|---|---|
| 店铺经营看板 | 支付金额/支付转化率/客单价/DSR/店铺层级 | `ShopOverviewPage` 增强 |
| 商品结构分析 | 父子订单拆分、商品动销率、加购收藏 | `ShopProductsPage` 增强 |
| 流量渠道分析 | 淘内免费/付费/淘外 三级结构 | `ChannelAnalysisPage` 支持 |
| **万相台投放分析** | 投产比 + 与生意参谋双源对账 | 新建 `TaobaoAdAnalysisPage` |
| **DSR 与体验分看板** | 三项评分 180 天趋势、体验分对仅退款自主权影响 | 新建 `TaobaoStoreHealthPage` |

**⚠️ 关键设计**：淘宝与天猫**不拆成两个平台**，改为 `dim_shop.shop_type ∈ {taobao_personal, taobao_enterprise, tmall}`，指标层共享。

#### B2. 京东（3 天，最复杂）
**核心**：自营 vs POP 双轨，**禁止跨 mode 加总**

| 功能 | 说明 | 新建页面 |
|---|---|---|
| **自营采销看板** | 供货金额、毛利（零售价-供货价）、账期、采销单明细 | `JdSelfOperatedPage` |
| **POP 店铺看板** | 成交金额（含货到付款）、SOP/FBP 拆分 | `JdPopPage` |
| **店铺星级看板** | 四维评分、延迟发货单量、咚咚响应时长 | `JdStoreRatingPage` |
| **履约时效监控** | 48h 延迟发货、24h 售后兜底预警 | `JdSlaMonitorPage` |
| **京准通分析** | 投产比 30 天窗口、直接/间接订单拆分 | `JdAdAnalysisPage` |

**⚠️ 关键设计**：`dim_shop.business_mode ∈ {self_operated, pop_sop, pop_fbp}`，页面按 mode 切换，GMV 汇总时**强制分开展示**。

#### B3. 拼多多（2.5 天）
**核心**：三套口径 + 成团状态

| 功能 | 说明 | 新建页面 |
|---|---|---|
| **成团转化分析** | 待成团 → 已成团 转化率损耗 | `PddGroupFunnelPage` |
| **三口径对账** | 交易额 / 结算金额 / 净成交 对比 | `PddCaliberComparePage` |
| **仅退款专项** | 仅退款占比、介入率、纠纷退款率、品质退款率 | 增强 `RefundAnalysisPage` |
| **商品推广分析** | 投产比（14天）+ 结算投产比 | `PddAdAnalysisPage` |
| **店铺领航员** | 领航员 + 成长层级 + 体验星级 三套并存 | `PddStoreHealthPage` |

**⚠️ 关键设计**：售后指标分母必须是**已成团订单数**，不能用支付订单数。

#### B4. 快手（2 天）
**核心**：私域复购 + 间接成交

| 功能 | 说明 | 新建页面 |
|---|---|---|
| **公私域流量分析** | 发现页（公域）vs 关注页（私域）成交占比 | `KsTrafficSplitPage` |
| **间接成交分析** | 直接/间接成交拆分，这是快手独有核心指标 | `KsIndirectGmvPage` |
| **粉丝团运营** | 粉丝团亲密度分布、转化贡献 | `KsFansTeamPage` |
| **磁力金牛 ROI** | 当日总ROI / 净成交ROI / 7日累计 / 涨粉N日ROI | `KsAdRoiPage` |
| **双源对账** | 金牛 vs 生意通 口径差异（官方说不可直接比）| `KsReconciliationPage` |

**⚠️ 关键设计**：快手与抖音虽都是直播电商，但**快手的核心是粉丝资产，抖音是内容效率**，页面必须体现差异。

#### B5. 小红书（3 天）
**核心**：笔记 × 搜索 × 人，**不是店铺经营**

| 功能 | 说明 | 新建页面 |
|---|---|---|
| **笔记经营看板** | 笔记曝光/阅读/互动/收藏/涨粉，按笔记列表 | `XhsNoteBoardPage` |
| **搜索分析** | 搜索曝光、搜索来源占比、买点词分析（小红书独立维度）| `XhsSearchPage` |
| **种草转化链路** | 笔记曝光 → 阅读 → 进店 → 成交 全链路 | `XhsConversionFunnelPage` |
| **站内外成交拆分** | 站内 GMV vs 站外（红猫/红京）GMV | `XhsOnOffsitePage` |
| **AIPS 人群资产** | 人群流转与渗透（小红书 ROI 过程度量）| `XhsAipsPage` |
| **达人/买手合作** | 蒲公英达人效果、买手分销 | `XhsTalentPage` |
| **群聊私域** | 群聊承接率、复购 | `XhsPrivateDomainPage` |

**⚠️ 关键设计**：小红书**必须支持「无成交的笔记」计入经营分析**——笔记本身是资产，不是只有成交才算数据。

#### B6. 抖音（对照，0 天）
已完整，无需改动。但需把口径字段补齐到 `platform_caliber_config` 保持一致。

**阶段 B 合计：12.5 天**

---

### 阶段 C：数据接入适配（P1，与 B 并行）

> 每个平台的导出文件格式完全不同，需要独立的解析模板

| 平台 | 导出源 | 解析要点 | 工作量 |
|---|---|---|---|
| 淘宝/天猫 | 生意参谋「自助取数」| 父子订单双层、PC/无线分列 | 1 天 |
| 京东 | 京麦 + 商智 + 京准通 | 三种模式分开、含货到付款标识 | 1.5 天 |
| 拼多多 | 商家后台 + 推广平台 + 对账中心 | 成团状态、结算口径 | 1.5 天 |
| 快手 | 磁力金牛 + 生意通 | 直接/间接成交、涨粉 ROI | 1.5 天 |
| 小红书 | 千帆 + 聚光 + 小红星 | 笔记维度、搜索来源、站内外 | 2 天 |

**方案**：复用现有 `IngestWizardPage` 六步向导，但增加「平台模板包」机制：
```
apps/api/src/ingest/templates/
  taobao.ts      列别名 + 校验规则 + 父子订单处理
  jd.ts          按 business_mode 分支
  pdd.ts         成团状态识别
  kuaishou.ts    间接成交字段
  xiaohongshu.ts 笔记维度 + 搜索来源
```

**阶段 C 合计��7.5 天**

---

### 阶段 D：语义层与 AI 分析扩展（P1）

> 让 AI 能回答各平台特有的问题

| 项目 | 说明 | 工作量 |
|---|---|---|
| 口径感知查询 | `queryMetric` 支持 `amountType` 参数，跨平台对比时强制检查口径一致 | 1 天 |
| 平台专属指标注册 | 快手 indirect_gmv、拼多多 settlement_gmv、小红书 offsite_gmv 等 | 1 天 |
| 平台专属分析剧本 | S7 成团转化（拼多多）/ S8 公私域（快手）/ S9 种草链路（小红书）/ S10 履约时效（京东）| 2 天 |
| 口径冲突保护 | 跨平台对比时若口径不同，返回明确警告而非静默混合 | 0.5 天 |

**阶段 D 合计：4.5 天**

---

### 阶段 E：数据初始化与验收（P2）

| 项目 | 说明 | 工作量 |
|---|---|---|
| 各平台演示数据 | 按真实业务逻辑构造（含拼团、笔记、采销单）| 2 天 |
| 端到端验收 | 每平台完整链路：导入 → 清洗 → 事实表 → 聚合 → 大盘 → AI 分析 | 2 天 |
| 口径说明文档 | 每个指标在页面标注来源与算法 | 1 天 |

**阶段 E 合计：5 天**

---

## 四、工作量汇总

| 阶段 | 内容 | 工作量 |
|---|---|---|
| A | 数据底座改造（口径/实体/来源/归因/SLA）| 9 天 |
| B | 平台专属功能页面（5 平台 × 5-7 功能）| 12.5 天 |
| C | 数据接入适配（5 套模板）| 7.5 天 |
| D | 语义层与 AI 扩展 | 4.5 天 |
| E | 数据初始化与验收 | 5 天 |
| **合计** | | **38.5 天** |

**并行优化后预计：25-28 个工作日**（C 可与 B 并行，D 可与 B 后半段并行）

---

## 五、优先级建议

### 如果只能先做一部分

**第一批（10 天）**：A1 成交口径 + A2 店铺扩展属性 + B1 淘宝 + B3 拼多多
- 理由：淘宝/拼多多是货架电商主力，口径问题最典型

**第二批（8 天）**：A3 来源映射 + A4 归因 + B4 快手
- 理由：快手补充直播电商第二形态

**第三批（10 天）**：A5 SLA + B2 京东 + B5 小红书
- 理由：京东最复杂、小红书最特殊，放最后

---

## 六、需要你确认的决策

### 决策 1：淘宝与天猫
**调研建议**：不拆平台，拆「店铺类型」维度（`shop_type`），因为共用生意参谋、指标定义一致。
**需要你确认**：是否接受这个设计？还是坚持拆成两个独立平台？

### 决策 2：京东自营
**调研结论**：自营是供货关系（采销额），POP 是成交关系（GMV），**两者不能相加**。
**需要你确认**：系统里京东自营要做吗？如果做，是做「供应商视角」（看供货额、账期、毛利）还是不做？

### 决策 3：小红书站外成交
**调研结论**：小红书 GMV 天然有站内/站外两个口径，站外靠小红星回传。
**需要你确认**：站外成交数据你有渠道拿到吗？如果没有，系统只做站内，站外留接口？

### 决策 4：调研中标注「待核实」的 7 项
主要是各平台最新售后规则、导出字段清单。这些需要你在实际后台确认，还是先按当前理解做、后面再调？

---

## 七、验收标准

每个平台完成后必须满足：

1. **数据链路完整**：能导入该平台真实格式的导出文件，正确落入事实表
2. **口径正确**：GMV 定义符合该平台实际，页面有明确口径标注
3. **特有对象可用**：拼多多的团、小红书的笔记、京东的采销单等能查询能分析
4. **AI 可回答**：能用自然语言问出该平台特有的经营问题
5. **跨平台对比安全**：口径不一致时明确警告，不静默混合

---

*本计划基于 researcher Agent 对 6 大平台的调研（见 [platform-business-model-comparison.md](./platform-business-model-comparison.md)）制定。*
