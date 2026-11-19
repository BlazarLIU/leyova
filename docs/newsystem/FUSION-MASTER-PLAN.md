# Leyova AI 运营系统 · 融合全案（v1.0）

> 融合来源：**A** = ChatGPT《运营 OS（重心重排）》｜**B** = 豆包《AI-Native 总体架构与实施全案》｜**L** = 本团队既有施工单与审计。
> 取舍原则：**产品骨架取 A，架构与治理取 B，SME 落地与数据/指标细节取 L**；冲突处给出裁决，不做拼接。
> 读者：产品负责人、架构负责人、以及直接执行的工程团队。全文所有数字（表/页/人天/验收）互相对齐。

***

## 0. 融合说明：谁贡献了什么

4206072443439763:c5e9b4b2c64349518ed62d37e936f087\_6aed79095e40fce2046703f7.6aed8e6c659de5a41a96c17d.6aed8e6c659de5a41a96c17c:TRAE CN.3.4.20.no\_sid.no\_ppe.T(2026/11/6 16:23:08)

### 0.1 三份方案的原罪与长处

|       | 原罪                                                    | 必须保留的长处                                                                                                          |
| ----- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **A** | 无多租户、无开通/定价/移动、跨境缺合规闸门                                | **场为中心**的对象模型；日循环与 30 个 Action；4 个工作面；12 表起步 + 延后触发；"AI 默认执行、人管例外"                                               |
| **B** | 与 SME 错位（Temporal/LangGraph/Nuxt SSR/7 角色）；数据先行路线；不定价 | **Decision Case** 统一决策对象；DDD 边界与跨域规则；Outbox/幂等/重放；RLS 多租户；模块 manifest + entitlement + metering；风险分级 R0–R4；SLO/DR |
| **L** | 早期偏"全量建模"（109 表）、偏工程脚手架                               | 四层数据流与 Artifact 状态机；指标口径版本化与 Critic；SME 六件套；容量触发条件；可执行的任务粒度与验收                                                   |

### 0.2 十二条融合裁决（冲突处一句话定案）

| #  | 冲突                        | 裁决                                                            |
| -- | ------------------------- | ------------------------------------------------------------- |
| 1  | 场为中心 vs 商品为中心             | **双层主语**：运营对象是"场"，事实主体是 SKU/订单；场不替代商品主数据                      |
| 2  | 12 表 vs 分层全建              | **MVP 43 表**（业务 22 + 内核 8 + 身份 8 + 平台 5），全量 65 封顶；其余按触发条件     |
| 3  | Temporal 首期 vs pg-boss    | **pg-boss + 表驱动状态机**；Temporal 仅在"跨天补偿 >1 万实例/天"时评估            |
| 4  | LangGraph vs Mastra vs 自研 | **自研执行器**，状态在自家库；LangGraph/Mastra 只做一周 A/B，谁赢谁当可选执行器          |
| 5  | Nuxt SSR vs React SPA     | **业务台用 React SPA**（无 SEO 需求）；官网/内容站另起 Nuxt，不混在一个应用            |
| 6  | 五层数据 vs 12 表              | **三层**：staging → canonical → fact；不做 raw/standardized 独立存储层   |
| 7  | 部署形态                      | **私有化单机交付**：装在客户自己的服务器（本地机房或自有云），独立库/桶/备份/版本；**离线许可，无控制面**    |
| 8  | 定价                        | **一次性 license + 年维护**（1.98/3.98/6.98 万，按模块可拆）+ 30 天试用 license |
| 9  | AI 自动执行                   | **L1/L2 自动、L3 审批、L4 人工**；平台写操作永远 L3 以上                        |
| 10 | 跨境定位                      | **运营节奏 + 合规闸门并列**：GPSR/EPR/CPC 缺失即阻断上架                        |
| 11 | 模块数量                      | **6 个业务模块 + 内核**；可单独售卖 4 个（直播/投放/内容/跨境）                       |
| 12 | 路线顺序                      | **先运营闭环，后数据治理**；O1 两周内必须能演示                                   |

### 0.3 数字基线（全文以此为准）

| 项    | 数值                                                              |
| ---- | --------------------------------------------------------------- |
| 业务模块 | 6（live / assortment / ads / content / crossborder / people）+ 内核 |
| 表    | MVP 43（业务 22 + 内核 8 + 身份 8 + 平台 5）/ P1 后 52 / 全量封顶 65           |
| 页面   | 29（22 业务页 + 7 系统页，4 个工作面）                                       |
| 阶段   | O0–O5，共 28 周                                                    |
| 工作量  | 152 人天                                                          |
| 验收   | 53 条                                                            |
| 目标客户 | 年 GMV 500 万–5,000 万的中小企业；1–3 店、1–2 直播间、3–10 人                   |

***

## 1. 定位与边界

### 1.1 一句话

**一套 AI 运营系统：观察经营 → 诊断问题 → 产出可执行物 → 人审 → 执行 → 测量效果 → 学习。**（A 的循环 + L 的 Artifact 落地）

**运营系统的第一性问题是"今天这场怎么打"，不是"这个月账对不对"。账是证据，不是目的。**【A】

### 1.2 六条反 ERP 判据（任何功能先过一遍）

| # | 判据                         | 不通过             |
| - | -------------------------- | --------------- |
| 1 | 主语是**动作**（排品/盯盘/复盘/调预算/上架） | 主语是单据 → 不做      |
| 2 | 产出**可执行物**（入库/审批/被下游消费）    | 只产出报表 → 不做      |
| 3 | 有**闭环**（下一场自动验证效果）         | 做完就结束 → 不做      |
| 4 | 数据围绕**人·货·场·钱·客**          | 围绕会计科目/BOM → 不做 |
| 5 | **只装一个模块也能用**              | 必须全模块 → 不做      |
| 6 | 关掉 AI 价值**显著下降**           | 没影响 = 在做 ERP    |

### 1.3 不做清单（写进 README，不参与讨论）

通用 ERP（总账/采购到付款/生产 BOM/全流程 HR）、自研自动出价引擎、无人直播/纯 AI 驱动直播、自建数仓与 OLAP（按阈值后置）、一次性接全部平台、运行时加载第三方代码。

### 1.4 成功定义（运营指标，不是功能数）

| 指标        | 目标             |
| --------- | -------------- |
| 建议采纳率     | ≥60%           |
| 行动项下场执行率  | ≥50%           |
| 单场复盘耗时    | 2 小时 → 15 分钟   |
| 排品表制作     | 3 小时 → 20 分钟   |
| 运营每天打开次数  | ≤4 次，每次 ≤10 分钟 |
| 首值时间（装机后） | ≤30 分钟出首份复盘    |

***

## 2. 客户与场景

### 2.1 SME 客户画像与硬约束【L】

年 GMV 500 万–5,000 万；1 品牌、1–3 店、1–2 直播间、3–10 人；**无专职数据/IT**；多数拿不到平台 API，只有后台 Excel；老板兼运营负责人。

| 约束         | 硬要求                                      | 反例                             |
| ---------- | ---------------------------------------- | ------------------------------ |
| 无 IT 团队    | **1 小时装机**（离线安装包 + 一条命令）+ 30 分钟首次引导出首份复盘 | 需要专职运维、需要联网激活                  |
| 拿不到 API    | Excel/CSV 是主路径，API 是增强                   | 假设已有开放平台授权                     |
| 可能无外网      | AI 支持三种模式：客户 API 出网 / 本地模型网关 / 纯规则降级     | 假设模型一定可联网                      |
| 不会配流程      | 审批默认关闭（≥3 人提示开启）；工作流只给预置模板               | 画布/BPMN 编辑器                    |
| 不懂术语       | 说人话，指标名收进"解释"层                           | 暴露"漏斗归因/口径版本"                  |
| 预算敏感       | **license 一次性 + 年维护**（可按模块）；无云月费；安装可远程协助 | 按调用量计价、强制订阅                    |
| 现场用手机      | 待办/提词卡/告警/复盘四页 375px 可用                  | 只做 1440px                      |
| 客户要装在自己服务器 | **私有化交付**：客户本地机房或自有云；数据不出客户网络；离线许可       | 共享库多租户、SaaS 托管、按 tenant\_id 隔离 |

### 2.2 三类主体（决定权限与结算，不是三个版本）【A+L】

| 主体   | 承担什么            | 系统映射                         |
| ---- | --------------- | ---------------------------- |
| 品牌自播 | 库存、退款、体验分、投流    | 全模块                          |
| MCN  | 人力与交付 KPI，不承担库存 | 关 inventory，开 people/creator |
| 达播合作 | 只承担流量与佣金        | 只开 review + creator（按达人维度）   |

### 2.3 九个岗位的一天【A+L】

运营/操盘手、主播、助播、中控、场控、投手、选品、切片、客服。
小团队一人多岗是常态 → **用户可绑多岗位**，不做"一岗一账号"；每个写动作有审计与回滚。

***

## 3. 对象模型：三层主语

> A 给"场"，B 给"决策对象"，L 给"事实与证据"。三者不是竞争关系，是三层。

```
判断层（AI 与人共同产出）   Decision Case（= 可执行物 Artifact）
                              ↑ 依据
运营层（人每天操作的对象）    Session（场）＝ 货 × 流量 × 人 × 场
                              ↑ 由事实聚合
事实层（系统记录的世界）      SKU / 订单 / 退款 / 投放 / 内容 / 结算 / 库存
```

### 3.1 运营层：Session 是唯一一等公民【A】

```
Session（场）= 货（排什么/什么价/什么顺序）× 流量（自然/付费/内容）× 人（主播/中控/投手）× 场（时段/时长/节奏）
```

商品库、订单、退款、投放、内容都是这场的**输入或输出**，不是独立主角。

### 3.2 判断层：Decision Case（统一决策对象）【B+A+L】

一个业务问题从发现到验证的唯一承载：

| 字段                     | 内容                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `case_id / domain`     | 标识（单实例部署，无租户字段）                                                                                   |
| `subject`              | 场次 / SKU / 广告计划 / 市场 / 店铺                                                                         |
| `question / objective` | 问题、目标、窗口、约束                                                                                       |
| `evidence_refs[]`      | 事实引用（指标+维度+区间+哈希）                                                                                 |
| `diagnosis`            | 诊断、置信度、未知项                                                                                        |
| `proposal[]`           | 候选动作、预估收益、成本、风险、可逆性                                                                               |
| `risk_level`           | R0–R4（见 §8.4）                                                                                     |
| `state`                | draft → pending\_review → approved → applied → measured → closed（+ rejected/expired/rolled\_back） |
| `execution_ref`        | 工作流实例 / 工具调用 / 平台回执 / 幂等键                                                                         |
| `outcome`              | 目标 vs 实际、基线、归因局限                                                                                  |
| `versions`             | 指标口径、prompt、模型、Agent、连接器版本                                                                        |

### 3.3 事实层

- SKU/订单/退款/投放/内容/库存/结算，一律**三口径金额分列**（下单/支付/结算），永不合并。【L】
- 每个数字带 `caliber_version`、来源、成熟度（T+1/T+15/T+30）。【L+B】

***

## 4. 运营循环与工作面

### 4.1 日循环（产品全部价值所在）【A】

| 时刻        | 运营动作  | AI 做什么                     | 人做什么           |
| --------- | ----- | -------------------------- | -------------- |
| 09:00     | 定今天打法 | 生成今日作战单：3 场排品草案 + 目标 + 风险点 | 5 分钟确认/改 1–2 处 |
| 开播前 1h    | 排品定稿  | 库存校验、备选品、价格带检查             | 只处理异常          |
| 开播中       | 盯盘    | 每 5 分钟出"加投/换品/停"建议，异常直推    | 只批大额动作         |
| 下播后 30min | 复盘    | 自动五段归因 + 明天 3 条建议          | 看结论，不看全表       |
| 21:00     | 明日预告  | 明日排品草案                     | 确认             |

### 4.2 周循环 / 月循环【A】

- 周：货盘结构（主推/清库存/测新品配比）、投放预算分配、内容排产、主播状态与排班。
- 月：人效（人均场次/单场净利）、毛利结构、达人结算（**月循环的一小节，不是主线**）。

### 4.3 人的角色反转：默认 AI 执行，人管例外【A】

```
AI 提议（带证据与预估影响）
 → L1/L2 低风险：自动执行，事后汇总
 → L3：进审批队列（平台写操作一律 L3 起）
 → 人只在"异常清单"上工作，不在"待办清单"上工作
```

首页不是待办列表，而是\*\*"AI 今天替你做了什么 + 3 件要你拍板"\*\*。

### 4.4 四个工作面（不是 12 屏）【A】

| 工作面      | 回答什么                  | 屏数 |
| -------- | --------------------- | -- |
| **作战台**  | 今天怎么打、AI 干了什么、要我拍什么   | 1  |
| **场次台**  | 排品 / 盯盘 / 复盘（一场的完整生命） | 3  |
| **货与内容** | 货盘结构、新品、内容引流          | 2  |
| **人与钱**  | 人效、绩效、（后置）结算          | 2  |

跨境不是独立工作面，是作战台的**站点筛选 + 一个"上新/活动"子流程**（但合规闸门独立成页）。

***

## 5. 架构

### 5.1 总形态：模块化单体 + 多进程【B】

```
Web（React SPA，静态）
 ├─ API（Fastify）：身份/权限/模块闸门/用例编排
 ├─ Workflow Worker：决策执行、审批、定时、事件消费
 ├─ Connector/Data Worker：平台拉取、Excel 解析、清洗、汇总
 └─ AI Worker：Agent 运行、向量化
共享：PostgreSQL（真值源 + 队列 + 向量）、对象存储、模型网关
```

**不做微服务**：亿元级不需要；拆了会让"场次 ↔ 订单"重新变成两个宇宙。【A】

### 5.2 分层与依赖规则【B】

| 层       | 职责                    | 禁止                |
| ------- | --------------------- | ----------------- |
| 交互层     | 页面、工作台、审批、任务          | 直接查库、业务规则写在组件里    |
| API/BFF | 身份、品牌/店铺上下文、校验、限流、DTO | 复杂跨域 SQL          |
| 应用层     | 用例编排、事务边界、幂等、授权       | 万能 Service        |
| 领域层     | 实体、规则、状态机、领域事件        | 依赖 HTTP/UI/厂商 SDK |
| 基础设施    | DB、队列、连接器、对象存储、模型适配   | 细节泄漏到领域           |
| AI 层    | 语义、规划、分析、证据、建议        | 成为事实唯一来源、绕过权限写库   |

**跨域规则**：同步只走对方 Application/Query API；异步只走领域事件/Outbox；**禁止读对方私有表**。

### 5.3 一致性模型【B+L】

| 场景                       | 一致性       | 做法                                      |
| ------------------------ | --------- | --------------------------------------- |
| 模块内写                     | 强一致       | 单 PG 事务                                 |
| 决策落库（case + 状态 + outbox） | 强一致       | 同事务写                                    |
| 跨模块（场次→复盘→行动项）           | 最终一致      | outbox → 事件 → 幂等 upsert；死信人工            |
| 平台回调                     | 至少一次 + 幂等 | `(channel, external_id, version)` 唯一    |
| AI 动作                    | 显式 + 可补偿  | `action_receipt` 记 before/after；回滚=反向命令 |

事件信封：`event_id / aggregate_type|id / event_type / schema_version / occurred_at / correlation_id / causation_id / payload_ref`。

### 5.4 私有化单机交付（装在客户自己的服务器）

> 最新约束推翻了"托管专属实例"：**客户把系统装在自己的本地服务器或自己的云服务器上**，我们不托管、不联网控制。

| 项    | 设计                                                                      |
| ---- | ----------------------------------------------------------------------- |
| 交付物  | 离线安装包（容器镜像 tar + 迁移脚本 + 种子 + 安装器 CLI + 许可工具 + 诊断工具），一个压缩包               |
| 安装   | `./leyova install`：检查环境 → 加载镜像 → 起 5 个容器 → 跑迁移 → 建管理员 → 输出访问地址；全程 ≤1 小时 |
| 硬件基线 | 最低 4C8G/200GB；推荐 8C16G/500GB；单机即可，不需要 K8s                               |
| 网络   | **默认不要求外网**；AI 支持"客户 API 出网 / 内网模型网关 / 纯规则降级"三种模式                       |
| 许可   | 离线 license 文件（签名 + 机器指纹 + 模块列表 + 到期日），本地校验；不联网激活                        |
| 升级   | 离线升级包（镜像 + 迁移 + 回滚脚本）；客户自行执行或我们远程协助；**不强制升级**                           |
| 数据   | 全部在客户库与客户对象存储；我们不持有任何客户数据                                               |
| 支持   | 诊断包导出（脱敏日志/版本/健康/表统计）；远程协助需客户临时授权                                       |
| 无控制面 | 不做实例注册、不做远程监控、不做远程开关；产品能力靠许可文件与本地配置                                     |

**代价**：每个客户环境不同（OS/磁盘/网络/时区），必须有安装前检查与诊断工具；版本会漂移，升级必须向后兼容至少一个小版本。

### 5.5 部署与硬件基线

| 项     | 要求                                                       |
| ----- | -------------------------------------------------------- |
| 进程/容器 | api、worker、web、postgres(+pgvector)、对象存储（或本地 fs）= **5 个** |
| 最低配置  | 4C8G / 200GB SSD / Linux x86\_64（Ubuntu 22.04+、麒麟/统信可选）  |
| 推荐配置  | 8C16G / 500GB SSD；50 人以内团队足够                             |
| 依赖    | Docker 24+ 与 compose 插件（或提供 systemd 裸机安装脚本）              |
| 端口    | 80/443（web+api 反代）、5432 仅本机                              |
| 时区/币种 | 安装时选择，默认 Asia/Shanghai + CNY                             |
| 外网    | 非必需；AI 三种模式见 §8.6                                        |
| 备份    | 本地磁盘 + 客户自有对象存储/NAS；提供 `leyova backup` 脚本                |
| 卸载    | `leyova uninstall` 保留数据卷；`--purge` 才删数据（二次确认 + 导出）       |

**判据：客户一台机器能装完、能备份、能升级，才算交付完成。**【A+L】

### 5.6 开源取舍（只借机制）【A+B+L】

| 项目                    | 借什么                      | 怎么用                        |
| --------------------- | ------------------------ | -------------------------- |
| Mastra / LangGraph JS | 状态图、checkpoint、interrupt | 一周 A/B；**状态存自家库**，框架只当执行器  |
| Temporal              | 耐久执行语义（重试/补偿/信号）         | 只借语义；首期 pg-boss；触发才引入      |
| RAGFlow               | 版面感知切分、引用优先              | 只借流水线形态；首期 pgvector + 自研解析 |
| OpenViking            | 记忆分域（租户/角色/场景）           | AGPL，不引入；自研 200 行          |
| Langfuse              | trace 四层、评估数据集           | 自托管（MIT 核心），可降级            |
| Phoenix               | 评估指标算法                   | ELv2，不引入                   |
| Vendure               | Channel = 币种/语言/税/价格/可见性 | GPLv3，只读模型                 |
| Medusa                | 模块隔离 + link 表            | MIT，借结构                    |
| Vercel AI SDK         | 模型/工具/流式抽象               | 唯一运行时依赖（边缘可替换）             |

**移除测试**：依次拿掉 Langfuse / 编排框架 / AI SDK / 向量检索，核心闭环仍能跑。

***

### 5.7 账号与身份系统（单实例内）

> 没有"跨租户账号"，也没有"切换租户"——一套实例里只有一套账号体系。

#### 5.7.1 模型

```
instance（本实例元信息：名称/版本/许可/开通时间）
account（用户：手机/邮箱唯一，可设密码）
  ├─ user_role（岗位 + 数据范围 brand/store/self）
  └─ session（设备会话）
invitation / verification_code / login_attempt
```

| 表                    | 关键字段                                                                                   | 说明                       |
| -------------------- | -------------------------------------------------------------------------------------- | ------------------------ |
| `instance`           | id, name, version, license\_json, provisioned\_at, timezone, currency                  | 单行表，记录本实例身份              |
| `account`            | id, phone unique, email unique, password\_hash?, status, mfa\_secret?, last\_login\_at | 实例内用户                    |
| `role` / `user_role` | role(code,name)、user\_id+role\_id+scope\_type+scope\_id                                | 一人多岗；范围 brand/store/self |
| `invitation`         | token\_hash, role\_id, scope\_json, expires\_at, invited\_by, accepted\_at             | 一次性、72h                  |
| `session`            | id, account\_id, token\_hash, ip, ua, last\_seen\_at, revoked\_at                      | 可撤销、可看设备                 |
| `verification_code`  | phone/email, code\_hash, purpose, expires\_at, attempts                                | 60s 重发、10 分钟、一次性         |
| `login_attempt`      | identifier, ip, success, at                                                            | 撞库与锁定                    |

#### 5.7.2 安装与首个管理员（安装器 → 首次引导）

1. 客户在服务器执行 `./leyova install`（或双击安装脚本），安装器检查 CPU/内存/磁盘/端口/Docker。
2. 加载离线镜像 → 起容器 → 跑迁移 → 初始化 `instance` 表（名称/时区/币种/版本）。
3. 安装器生成 **一次性管理员口令**（打印在终端），或用 `--admin-phone` 指定手机号。
4. 管理员首次登录 → 设置密码/绑定手机 → 进入引导：建品牌/店铺 → 传 Excel → 出首份复盘（≤30 分钟）。
5. 全程不需要外网；许可文件由安装器导入或在"系统-许可"页上传。

#### 5.7.3 登录

| 方式          | 优先级  | 规则                                           |
| ----------- | ---- | -------------------------------------------- |
| 手机号 + 短信验证码 | 主路径  | 60s 重发；同手机 5 次/小时、同 IP 20 次/小时；验证码 10 分钟、一次性 |
| 密码（可选）      | 次路径  | Argon2id；≥10 位；失败 5 次锁 15 分钟；可开 TOTP         |
| 微信扫码        | P1 后 | 绑定手机后可用；不作唯一方式                               |
| 邮箱          | 备用   | 找回密码/通知                                      |

改密、停用、踢设备 → 立即撤销全部会话。

#### 5.7.4 成员与离职

- 管理员生成邀请（绑定岗位与范围）→ 被邀请人验证手机 → 加入。
- 离职：停用账号 → 撤销会话 → 资产（品牌/店铺/场次）转交 → 记审计。
- 实例内不开放自助注册；账号只能由管理员邀请，首个管理员由安装器创建。

#### 5.7.5 权限：三维判定

```
can(user, action, object) =
    role_has_action(user.roles, action)
 && scope_covers(user.roles, object)      // brand / store / self
 && object_state_allows(object, action)   // 状态机守卫
```

- 岗位模板：老板、运营/操盘手、主播、中控、投手、选品、客服、财务。
- **模块许可与岗位授权分离**：买了模块 ≠ 人人可用。
- 数据范围在查询层注入（brand\_id/store\_id），不靠前端隐藏。
- 敏感动作（改价、退款、结算、权限、导出）二次确认 + 审计 + 可回滚。

#### 5.7.6 安全基线

Argon2id；验证码/邀请 token 只存哈希；错误文案统一（防枚举）；IP+账号双维度限流；Cookie `HttpOnly+Secure+SameSite=Lax`；CSRF；CSP；会话 12h 滑动/7 天绝对；审计保留 2 年。

#### 5.7.7 API

`POST /auth/code` ·`POST /auth/login/code` ·`POST /auth/login/password` ·`GET /auth/sessions` ·`DELETE /auth/sessions/{id}` ·`POST /auth/password/reset` ·`GET /me` ·`GET /members` ·`PATCH /members/{id}` ·`POST /invitations` ·`POST /invitations/{token}/accept` ·`POST /instance/bootstrap`

#### 5.7.8 验收

owner 5 分钟内可登录；新员工 3 分钟加入；离职 1 分钟失效；验证码超限被限流；跨实例数据物理不可达；会话撤销立即生效。

### 5.8 系统底层（平台服务）

> 账号是"谁能进"，底层是"进来之后系统靠什么稳定运行"。以下每一项都要在 O0 落地，不允许"先写业务再补底座"。

| 能力        | 设计要求                                                                                                     | 验收                   |
| --------- | -------------------------------------------------------------------------------------------------------- | -------------------- |
| **运行时**   | api 无状态；worker 按队列分池；启动校验迁移版本/模块 manifest/能力冲突/必填环境变量；优雅停机（停收新请求→等在途→关池）                                 | 启动缺配置即失败并指明变量        |
| **配置**    | 三层：环境变量（非密）/ secrets（KMS 或系统 keyring）/ DB 配置（可热更：阈值、开关）；密钥不入库、不入日志                                       | 日志抽查无密钥              |
| **数据访问**  | 连接池（api 20、worker 10）；`withTx()` 封装；`statement_timeout=5s`；慢查询 >500ms 记录；迁移只增不改、启动校验 checksum；禁止运行时 DDL  | 慢查询有日志；重复迁移无变化       |
| **任务与调度** | pg-boss 队列：event-dispatch / sync / ai / rollup / notify；重试 3 次指数退避；死信表；任务执行前检查模块 enabled 与实例配额；cron 集中注册 | kill worker 重启后续跑不重复 |
| **幂等**    | 所有外部写入带 `idempotency_key`（表 `idempotency_key`，24h 去重）；回调 `(channel, external_id, version)` 唯一            | 同回调 10 次只落 1 条       |
| **缓存**    | 进程内 LRU 60s；key 带业务前缀（store/日）；只缓存可重建数据；写后失效；Redis 仅 P2 引入                                               | 改数据后 60s 内可见         |
| **文件服务**  | `file_object` 表（key/mime/size/hash/owner/tenant）；S3 兼容（dev 本地 fs）；预签名 URL 5 分钟；上传白名单 + 大小限制              | 越权下载 403；大文件拒绝       |
| **通知**    | 站内 / 短信 / 企微机器人 / Webhook；模板 + 变量；去重与静默；失败重试；`notification` 记录投递结果                                       | 告警 10 分钟不重复；失败可见     |
| **可观测**   | JSON 日志（trace\_id/actor，脱敏）；RED 指标 + 业务指标（数据新鲜度、AI 失败率）；OTel 可选；Langfuse 只做 AI trace；诊断包一键导出             | 任一请求可按 trace\_id 串起来 |
| **错误契约**  | 10 个统一错误码；Zod 契约；OpenAPI 100% domain tag；前端类型由契约生成                                                       | 前后端类型零 diff          |
| **环境与发布** | stable/beta 两个交付通道；迁移先行；升级前自动备份；回滚=上一镜像 + 向后兼容迁移                                                         | 回滚演练 15 分钟内完成        |
| **备份容灾**  | 每日全量 + WAL；RPO ≤15 分钟、RTO ≤2 小时；季度恢复演练；对象存储版本化                                                           | 演练记录存档               |
| **安全基线**  | OWASP Top10 自查；依赖许可证 SBOM 扫描；密钥扫描；SQL 全参数化；CSP；上传校验                                                      | 扫描零高危                |

***

## 6. 数据模型

### 6.1 三层数据流（不是五层）【L+B】

```
staging（原样 + 文件指纹 + 幂等键）
  → canonical（字段映射、单位/币种/时区归一、实体解析）
  → fact（订单行/退款/投放/场次分钟/结算）
  → metric（注册表 + 汇总）
```

门禁只留 5 条：必填、金额符号、退款 ≤ 支付、时间连续、重复检测。**不做 8 门质量门。**【A】

### 6.2 表规模：MVP 43 → 全量 65【A+L】

| 域              | MVP 表                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 身份与实例（8）       | instance、account、role、user\_role、invitation、session、verification\_code、login\_attempt                                      |
| 平台底座（5）        | audit\_log、feature\_flag、file\_object、notification、idempotency\_key                                                        |
| 内核业务（8）        | metric\_definition、source\_registry、decision\_case、action\_receipt、domain\_event、module\_manifest、entitlement、usage\_meter |
| live（6）        | session、session\_slot、session\_minute、script\_version、run\_checklist、alert\_event                                          |
| assortment（4）  | product、sku、channel\_listing、price\_list\_item                                                                             |
| trade（3）       | order、order\_line、refund                                                                                                   |
| ads（2）         | ad\_campaign、ad\_spend\_hourly                                                                                             |
| content（2）     | content\_daily、content\_clip                                                                                               |
| crossborder（3） | market\_listing、compliance\_file、fx\_rate                                                                                  |
| knowledge（2）   | kb\_document、kb\_chunk                                                                                                     |

**全量 65 张**在 P1 后按模块加：审批/工作流、结算、库存预留、达人、客服、体验分、汇总表、平台时钟等。

### 6.3 关键建模铁律【L】

1. 金额三口径分列，`numeric(18,4)` + `currency`。
2. 价格属市场（`price_list_item`），渠道差异属 `channel_listing`。
3. 跨模块只走 `module_link`，不建外键。
4. 单实例部署：**没有 `tenant_id`**；范围用 `brand_id` / `store_id`；软删 `deleted_at`。
5. 大字段（prompt、原始报文、切片）只存对象存储 key + hash。

### 6.4 分区与索引【L+B】

- 按月分区：`order`、`order_line`、`session_minute`、`domain_event`。自动建未来 3 个月、删 13 个月前，**禁止手工建月表**。
- 时间列 BRIN；业务键用复合索引（如 `(store_id, biz_date)`）；禁止低基数列单列索引。
- 看板只读汇总（`agg_*`），明细钻取走分区裁剪。

### 6.5 容量口径（单实例 + 实例总量）

**单实例**：年 GMV 2 亿 → 约 1.2 亿行 / 210 GB（3 年），单机 PG + 分区 + 汇总足够。

**交付总量**（我们侧视角）：50 个客户环境 × 平均 2,000 万行 = 100 亿行，但**分散在 50 个独立部署**，不存在单库压力；压力在"安装/升级/诊断/支持"的标准化。

| 触发条件                         | 动作                        |
| ---------------------------- | ------------------------- |
| 单实例单表 >3,000 万行 或 聚合 P95 >2s | 加汇总表                      |
| 汇总后仍 >1.5s 且扫描 >2,000 万行     | 该实例引入 ClickHouse（只读投影）    |
| 单实例写入 >2,000 行/秒             | 批量 COPY + worker 扩容       |
| 单实例库 >500 GB                 | 冷数据归档到对象存储                |
| 客户版本漂移                       | 交付升级包 + 兼容矩阵；升级前自动备份与迁移预检 |

## 7. 模块与商业化

### 7.1 模块切分：6 个，不是 15 个【A+B】

| 模块                  | 依赖     | 关闭后还能用吗    | 可单独卖    |
| ------------------- | ------ | ---------- | ------- |
| `m.live` 直播作战       | kernel | 能          | ✅ 主 SKU |
| `m.ads` 投放          | kernel | 能          | ✅       |
| `m.content` 内容      | kernel | 能          | ✅       |
| `m.crossborder` 跨境  | kernel | 能          | ✅       |
| `m.assortment` 选品货盘 | m.live | 能（排品退化为手工） | ❌ 增强包   |
| `m.people` 人效       | m.live | 能          | ❌ 增强包   |

**内核（永不可关）**：身份、指标、决策对象、事件、审计、模块运行时、知识库。

### 7.2 manifest 契约【A+B】

```yaml
module: live-ops
id: m.live
depends: [kernel]
capabilities:
  actions: [live.slot.plan, live.watch.suggest, live.review.generate]
  metrics: [gpm, conv_rate, refund_rate]
  screens: [/ops/session/*]
entitlement: plan.ops
events_in: [OrderPaid, SessionStarted]
events_out: [SlotPlanned, ActionProposed, ReviewGenerated]
migrations: db/modules/live
```

启动校验两件事：**依赖闭包**（缺依赖启动失败，不许半启动）；**capability 冲突**（同一 action/route/metric 被两个模块注册 → 启动失败）。【A+B】

### 7.3 三层开关与四口拦截（按实例）

- 编译期（裁包）/ 部署期（`ENABLED_MODULES`）/ 运行期（实例许可 `entitlement`）。
- 拦截四口：导航（服务端过滤）、API（403 `MODULE_NOT_LICENSED`）、worker（跳过并记 skipped）、AI 工具（未许可模块的工具对 LLM 不可见）。
- 关闭 ≠ 删数据：表保留、API 不可用；重新开启 90 天内数据完整。

### 7.4 商业化：私有化 license + 年维护

| 版本   | 一次性 license（建议） | 年维护（建议） | 含模块                           |    店铺上限 |
| ---- | --------------: | ------: | ----------------------------- | ------: |
| 基础版  |          1.98 万 |     20% | live + assortment + knowledge |       1 |
| 专业版  |          3.98 万 |     20% | + ads + content + people      |       3 |
| 跨境版  |          6.98 万 |     20% | + crossborder                 | 3（2 市场） |
| 增值模块 |       0.5–1 万/个 |     20% | 按需                            |       — |
| 实施服务 |         0.5–2 万 |       — | 安装/数据迁移/培训（可选）                |       — |

规则：

- **一份 license 绑定一套环境指纹**（主机名+MAC+安装 ID），离线校验；换机走重新签发。
- 维护期内提供升级包与远程支持；过期不升级但仍可运行。
- 不按调用量、不按 AI 次数收费（客户自付模型 API 或自建模型）。
- 试用：提供 30 天临时 license（功能全开、限 1 店铺）。

## 8. AI 运行时

### 8.1 七阶段（每步落库）【L+B】

```
scope → observe（只走指标/对象工具）→ plan（显式 JSON）→ act（工具白名单）
→ verify（Critic 数字复算）→ propose（decision_case draft）→ apply（审批后领域命令）
```

### 8.2 工具网关（LLM 只能看到这些）【B+L】

`list_metrics` / `describe_metric` / `run_metric` / `get_object` / `list_objects` / `create_draft` / `apply_action`（+ `check_compliance`、`search_knowledge`，按模块授权）。
**永不发裸 SQL**；工具内部再做模块许可/数据范围校验。

### 8.3 五个 Agent（对应你的五项 AI 优先级）

| Agent      | 输入                              | 产出                                         | 硬闸门                         | 验收                    |
| ---------- | ------------------------------- | ------------------------------------------ | --------------------------- | --------------------- |
| 排品         | SKU 近 30/90 天支付/结算 GMV、退款、毛利、库存 | `run_plan_draft`（货盘四层 + 时长 + 机制 + 理由 + 证据） | 资质/毛利/库存/价格                 | 采纳率 ≥60%，坑产 MAPE ≤35% |
| 复盘         | 单场全量指标（带成熟度）                    | `run_report` + `action_item`               | 归因之和 = 差额 ±1%；禁空话           | 认可率 ≥70%，执行率 ≥50%     |
| 投放         | 计划消耗/转化/结算 GMV                  | `ad_action`                                | 三 ROI 分列；T+15 未成熟禁加预算；≤±30% | 采纳率 ≥50%，7 日结算 ROI 不劣 |
| 内容         | 录像索引、授权、历史高转化段                  | `clip_list` + `script_version`             | 无授权拒绝；违禁词 0 漏检              | 成片可用率 ≥40%            |
| 跨境 Listing | SKU + 合规档案 + 市场                 | `listing_draft`（多语言 + 合规依据）                | GPSR/EPR/CPC 缺失即拦           | 改写率 ≤40%，拦截召回 100%    |

### 8.4 风险分级与审批【B+A】

| 级别 | 例子                   | 处理        |
| -- | -------------------- | --------- |
| R0 | 只读分析、生成草案            | 自动        |
| R1 | 排品草稿保存、脚本入库          | 自动 + 审计   |
| R2 | 站内提醒、任务创建、低额预算（≤500） | 自动 + 事后汇总 |
| R3 | 改价、上架、预算调整（>500）、停计划 | **必须审批**  |
| R4 | 批量改价、清库存、结算调整        | 双人审批      |

**平台写操作永远 R3 起**；审批策略支持金额分级、会签/或签/顺序、SLA 升级。

### 8.5 Critic（数字校验）【L】

1. 抽取结论中的所有数字；
2. 每个数字必须映射到 evidence 的 `(metric, dims, period)`；
3. 容差：金额 ±0.5%、比率 ±0.05pp、计数 0；
4. 全匹配 verified；部分 insufficient；不匹配 rejected（不出稿）；
5. rejected 写回 `unmatched`，UI 显示"哪个数字没依据"。

### 8.6 评测与成本【A+B+L】

- 黄金集：每 Agent ≥20 例（含埋雷：高退款低毛利 SKU、流量跌 20% 的场次）。
- 五项指标：数字准确性、证据完备率、执行成功率、审批正确率、业务结果。
- 升级门槛：准确率 >85%、无证据率 0、执行成功率 >95%、审批错误 <5%、业务结果为正。
- 成本：由客户承担（自带 API Key 或自建模型）；系统内设单次 60k token 上限与每日配额，超限降级为"只取数不出结论"。

#### 离线/内网环境的三种 AI 模式

| 模式           | 适用           | 做法                                       |
| ------------ | ------------ | ---------------------------------------- |
| A. 客户 API 出网 | 客户允许出网       | 配置 OpenAI 兼容地址与 Key；只放行模型域名              |
| B. 内网模型网关    | 客户有 GPU/私有模型 | 部署 vLLM/Ollama（OpenAI 兼容），系统只改 base\_url |
| C. 纯规则降级     | 完全无模型        | 关掉生成型能力，仅保留指标取数、阈值告警、模板化报告               |

**验收**：断网环境下系统可启动、可登录、可看数、可出模板报告；AI 功能明确显示"未配置模型"。

## 9. 指标、知识库与合规

### 9.1 指标（先 22 个，跨境 +5）【L+A】

`gmv_order / gmv_pay / gmv_settle / refund_rate / quality_return_rate / aov / uv_value / gpm / avg_stay / ctr_item / cvr_run / slot_output / attach_rate / ad_spend / roi_pay / roi_settle / roi_blended / experience_score / ship_sla / pickup_sla / live_duration / commission_base`，跨境追加 `landed_cost / cm3 / fx_loss / penalty_rate / inventory_days`。

- 每个指标带口径版本、来源、成熟度、允许维度。
- API/页面/AI 结论**必须带 caliber**；未注册指标不得出现。
- 体验分允许两套口径并存（5 分制/90 天、百分制/30 天），按 `as_of` 取版本。【L】

### 9.2 知识库（内核服务，不是"接个向量库"）【L+B】

`kb_document / kb_chunk`：版本号 + 生效期 + checksum；标题层级切分（500–800 token，15% 重叠）；`embedding vector(1024)` + `tsvector`（中文分词）；查询带 `as_of`；**每条结论必须引用**（doc\_id/页码/段），无引用被 Critic 拒绝；无答案就答"未收录"。

### 9.3 跨境合规闸门【L+审计结论】

- 字段级：GPSR 责任人、EPR/LUCID、CPC/CE、HS 编码、标签要素、AI 图像标注。
- 缺失 → 上架 409 `COMPLIANCE_BLOCKED` + missing 清单；补齐后可发布。
- 平台时钟：TikTok 48h 打包 + 3 日历日揽收；Amazon 按渠道配置；预警 24h/12h/4h。

***

## 10. 工作流与审批（三层，不是一套 BPMN）【L+B】

| 层         | 是什么            | 谁定义                  | 实现               |
| --------- | -------------- | -------------------- | ---------------- |
| L1 业务状态机  | 场次/决策/订单状态     | 代码                   | DB CHECK + 合法转移  |
| L2 审批     | 谁能批、几级、超时      | 配置 `approval_policy` | 策略 + 请求/决策表      |
| L3 SOP 编排 | 排品→审批→开播→复盘→验证 | 配置 DSL               | 表驱动状态机 + pg-boss |

DSL 五种步骤：`agent / approval / action / timer / webhook`；幂等 `unique(instance_id,seq)`；等人落 `waiting`（不在内存 await）；单步超时 1h、最多 50 步、失败 abort/retry/compensate。

**v1 六条预置流程**：排品发布、复盘发布、预算调整、Listing 发布、结算差异、周报。
**SME 默认**：审批关闭（自审留痕），≥3 人提示开启。

***

## 11. 前端

### 11.1 四个工作面 + 29 页（22 业务 + 7 系统）【A+L】

| 工作面  | 页面                                         |
| ---- | ------------------------------------------ |
| 作战台  | 今日作战（AI 做了什么 + 待拍板）、告警流、待办中心               |
| 场次台  | 场次列表、排品编辑、提词卡、盯盘驾驶舱、复盘报告、行动项               |
| 货与内容 | 商品/SKU、货盘结构、价格与渠道、内容排产、切片队列                |
| 人与钱  | 人效看板、绩效、（结算灰显）、利润与单位经济                     |
| 跨境   | 合规档案、Listing 草稿、履约时钟、结算对账                  |
| 系统   | 指标字典、数据源与接入、AI 运行与评测、权限与审计、模块与授权、知识库、流程与审批 |

### 11.2 规范

- 一页只解决一个动作；首屏 ≤3 数字 + ≤3 动作；每个数字 hover 显示口径/来源/成熟度。
- AI 草案必须"采纳/修改/驳回"三按钮；驳回要记原因（进评测）。
- **移动端四页**（待办/提词卡/告警/复盘）375px 可用。
- 首页不是待办列表，而是"AI 今天做了什么 + 要你拍什么"。【A】

***

## 12. 运维、安全与 SLO

| 项     | 要求                                                    |
| ----- | ----------------------------------------------------- |
| 备份    | 每日全量 + WAL 归档，RPO ≤15 分钟，RTO ≤2 小时；季度恢复演练             |
| 监控    | API QPS/P95/5xx、DB 连接/慢查询/磁盘、队列积压、数据新鲜度、AI 失败率        |
| 安全    | Argon2id、HttpOnly Cookie、CSRF、登录锁定、敏感字段加密、日志脱敏、上传白名单  |
| 部署隔离  | 每客户独立服务器/独立库；数据不出客户网络；我们不持有客户数据                       |
| 交付与升级 | 离线安装包 + 升级包 + 回滚脚本；兼容矩阵；升级前自动备份与迁移预检                  |
| 支持    | 诊断包（脱敏日志/版本/健康/表统计）一键导出；远程协助需客户临时授权                   |
| 许可    | 离线 license（签名 + 指纹 + 模块 + 到期）；换机重新签发；过期只停升级不停运行       |
| SLO   | 作战台 P95 <300ms；复盘页 <800ms；导入 10 万行 <5 分钟；分钟数据延迟 <3 分钟 |
| 可用性   | 单实例 99.5%（受客户环境与硬件影响；提供健康检查与告警建议）                     |

***

## 13. 实施路线（152 人天 / 28 周）

| 阶段        | 周期  | 人天 | 目标                                                     | 验收（运营指标）                                   |
| --------- | --- | -: | ------------------------------------------------------ | ------------------------------------------ |
| O0 地基     | 3 周 | 18 | 骨架、**实例初始化**、**账号与身份**、三维权限、**平台底座**、指标注册、决策对象、事件、演示数据 | 安装后 10 分钟可用；owner 5 分钟可登录；离职 1 分钟失效；底座服务可用 |
| O1 作战闭环   | 4 周 | 28 | Excel 导入 → 排品 → 开场 → 复盘 → 行动项                          | **两周内可演示**：一场能排出货盘、复出 3 条建议                |
| O2 AI 值守  | 4 周 | 24 | 排品/复盘 Agent、盯盘告警、审批                                    | 建议采纳率 >60%；运营每天打开 ≤4 次                     |
| O3 周运营    | 5 周 | 26 | 投放、内容、货盘结构、周报                                          | 单场净利可归因；人均管理场次 +50%                        |
| O4 跨境     | 6 周 | 32 | 合规闸门、Listing、履约时钟、结算对账、单品 P\&L                         | 一个站点一周上 20 SKU；时效异常提前 24h                  |
| O5 交付与商业化 | 6 周 | 24 | **离线交付工具链**（安装器/升级包/许可/诊断）、模块授权、移动端、压测                 | 1 小时装完一台；断网可用；升级可回滚；许可离线可验                 |

**顺序铁律**：账号、实例初始化与底座必须在 O0 完成；**离线安装包与升级回滚能力必须先于第 2 个客户**。【A+L】

***

## 14. 验收（53 条，摘录）

| 组     | 条数 | 代表用例                                                            |
| ----- | -: | --------------------------------------------------------------- |
| 业务    | 10 | 10 分钟出排品表 / 30 分钟出复盘 / 归因之和=差额 ±1% / 行动项回流                      |
| AI    |  8 | 每条结论有证据 / 无证据被 Critic 拒绝 / 回放 10 次一致 / 审批越权 403                 |
| 数据    |  5 | 同文件重复导入 0 重复 / 三口径不混算 / 退款≤支付 / 指标带口径                           |
| 模块    |  5 | 关模块 403+任务跳过 / 卸载 90 天可恢复 / 只装一个模块可用                            |
| SME   |  5 | 装完 30 分钟出首份复盘 / 只传订单也能出降级复盘 / 375px 可操作 / 试用降级 / 超店铺 402        |
| 跨境    |  4 | GPSR 缺失阻断 / 时钟三级预警 / 结算下钻 / 汇损进 P\&L                            |
| 安全    |  3 | 跨实例物理不可达 / 注入无效 / 日志脱敏                                          |
| 账号与身份 |  6 | 邀请→加入 3 分钟 / 验证码限流 / 离职 1 分钟失效 / 品牌与店铺范围不串 / 会话可撤销 / 密码重置撤销全部会话 |
| 平台底座  |  3 | 幂等回调 10 次落 1 条 / kill worker 续跑不重复 / 回滚 15 分钟                   |
| 私有化交付 |  4 | 1 小时装完 / 断网可用 / 许可绑定指纹且离线可验 / 升级失败可回滚                           |

***

## 15. 风险与 ADR

| 风险        | 缓解                                |
| --------- | --------------------------------- |
| 又长成 ERP   | 六判据 + 六模块 + 季度启用率审计（<20% 观察→下线）   |
| AI 又变聊天气泡 | 每个 Agent 绑定 artifact 采纳率，不达标不上线   |
| 私有化环境差异   | 安装前环境检查 + 诊断包 + 兼容矩阵（OS/磁盘/网络/时区） |
| 平台规则误踩    | 写操作 R3 起审批；合规闸门前置                 |
| 数据量上来崩    | 分区 + 汇总 + 5 条触发条件                 |
| 许可证踩坑     | 黑名单 + SBOM 扫描                     |

**关键 ADR**：① 场为中心（A）；② Decision Case 统一对象（B+L）；③ **私有化单机交付（客户服务器、离线许可、无控制面）**；④ pg-boss 先行、Temporal 触发（A+L）；⑤ 自研执行器、框架可换（L）；⑥ React SPA（L）；⑦ 6 模块 4 可售（A）；⑧ 一次性 license + 年维护（L）。

***

## 16. 一句话收尾

**A 让运营明天就用上，B 让系统三年不塌，L 让 SME 付得起；这份全案要求三件事同时成立。**

***

## 17. 附录

### 17.1 分阶段任务与验收（执行顺序）

#### O0 地基（18 人天）

| #     | 任务                                        |  人天 | 验收                              |
| ----- | ----------------------------------------- | --: | ------------------------------- |
| O0-1  | 工程骨架、运行环境、健康检查、优雅停机                       |   2 | `/health`、`/ready` 200；缺配置启动即失败 |
| O0-2  | 迁移框架 + 身份/内核表 + `ensure_partitions()`     |   2 | 空库跑通；再跑无变化                      |
| O0-3  | **账号与身份**：手机验证码、可选密码、邀请、会话管理、密码重置         |   3 | owner 5 分钟登录；离职即刻失效；验证码限流       |
| O0-4  | 岗位模板 + 三维权限（岗位×brand/store/self×状态）+ 审计   |   2 | 越权 403 且审计；一人多岗生效               |
| O0-5  | **实例初始化**：instance 元信息、owner 邀请、默认岗位与指标种子 | 1.5 | 新实例开箱可用；默认数据正确                  |
| O0-6  | 指标注册表（22 个）+ `metric.query`               | 1.5 | 带 caliber；非法维度 422              |
| O0-7  | 事件 outbox + worker（幂等/重试/死信）              |   1 | 重复事件只消费一次；kill 后续跑不重复           |
| O0-8  | Decision Case 状态机 + 工具网关骨架                |   2 | 假 Agent 端到端；未审批 apply → 428     |
| O0-9  | **平台底座**：配置分层、文件服务、通知、幂等键                 |   2 | 越权下载 403；通知去重；幂等回调落 1 条         |
| O0-10 | 演示数据生成器（固定种子 + 埋雷）                        |   1 | 两次生成一致；含 10 个劣质 SKU             |

#### O1 作战闭环（28 人天）

| #    | 任务                                  | 验收                     |
| ---- | ----------------------------------- | ---------------------- |
| O1-1 | Excel 导入（场次/订单/投放）+ 6 模板 + 幂等       | 同文件重传 0 重复；坏文件 422 列明行 |
| O1-2 | trade 最小集（order/order\_line/refund） | 三口径分列；退款 ≤ 支付          |
| O1-3 | assortment（商品/SKU/渠道/价格）            | 候选池可用；渠道价正确            |
| O1-4 | 排品表（6 组字段 + 四层货盘 + 硬闸门）             | 30 SKU 10 分钟出表；毛利负被拦   |
| O1-5 | 场次（从排品一键生成 + 提词卡 + 自检）              | 未自检开播 409              |
| O1-6 | 复盘（五段归因 + 行动项）                      | 归因之和 = 差额 ±1%          |
| O1-7 | 开箱向导（3 步 + 示例数据）                    | 装完 30 分钟出首份复盘          |

#### O2 AI 值守（24 人天）

| #    | 任务                       | 验收                 |
| ---- | ------------------------ | ------------------ |
| O2-1 | 排品 Agent + 黄金集 20 例      | 采纳率 ≥60%；闸门不放行     |
| O2-2 | 复盘 Agent + 黄金集 20 例      | 无证据结论被拒；认可率 ≥70%   |
| O2-3 | 盯盘快照 + 基线 + 告警（去重/冷却/升级） | 偏离 60 秒内告警；10 分钟去重 |
| O2-4 | 审批（金额分级/会签/超时升级）         | 越级 403；超时升级        |
| O2-5 | 风险分级 R0–R4 与工具网关联动       | R3 必须审批；R0 自动      |

#### O3 周运营（26 人天）

| #    | 任务                        | 验收            |
| ---- | ------------------------- | ------------- |
| O3-1 | 投放（计划/小时消耗/三 ROI/调整单/熔断）  | 结算未成熟禁加预算     |
| O3-2 | 内容（排产/切片/授权/分发）           | 无授权切片 409     |
| O3-3 | 货盘结构（周视图：主推/清库/测新）        | 结构建议可执行       |
| O3-4 | 周报 + 目标与行动项               | 周一自动生成；行动项闭环  |
| O3-5 | 投放 Agent + 内容 Agent + 黄金集 | 采纳率 ≥50%；漏检 0 |

#### O4 跨境（32 人天）

| #    | 任务                           | 验收           |
| ---- | ---------------------------- | ------------ |
| O4-1 | 合规档案（GPSR/EPR/CPC/HS/标签）+ 闸门 | 缺失阻断上架；补齐可发布 |
| O4-2 | Listing 草稿（多语言 + 合规依据）       | 人工改写率 ≤40%   |
| O4-3 | 履约时钟（48h/3 日/7 工作日 + 三级预警）   | 47h 未发货出两级预警 |
| O4-4 | 结算对账（批次/分录差异）+ 单品 P\&L       | 差异可下钻；误差 <1% |
| O4-5 | Listing Agent + 黄金集 20 例     | 合规拦截召回 100%  |

#### O5 交付与商业化（24 人天）

| #    | 任务                                         | 人天 | 验收                        |
| ---- | ------------------------------------------ | -: | ------------------------- |
| O5-1 | **离线安装包**：镜像 tar、安装器 CLI、环境检查、迁移、建管理员      |  7 | 干净机器 1 小时装完；断网可启动         |
| O5-2 | **升级与回滚**：升级包、迁移预检、自动备份、回滚脚本、兼容矩阵          |  5 | 上一版本升级成功；失败 15 分钟内回滚      |
| O5-3 | **许可与模块授权**：离线 license 签发/导入/指纹校验/到期降级     |  4 | 离线可验；换机需重签；过期只停升级         |
| O5-4 | 诊断包与备份脚本（`leyova diagnose/backup/restore`） |  2 | 一键导出脱敏诊断；恢复演练通过           |
| O5-5 | 移动端四页（375px）                               |  3 | 真机可操作                     |
| O5-6 | 单实例 1.5 亿行压测                               |  3 | 灌入 <8h；600 QPS P95 <300ms |

### 17.2 核心表 DDL（风格基准，其余同风格）

```sql
CREATE TABLE decision_case (
  id bigserial PRIMARY KEY,
  domain text NOT NULL,                 -- live/assortment/ads/content/crossborder
  subject_type text NOT NULL, subject_id bigint NOT NULL,
  question text, objective text,
  evidence_refs bigint[] NOT NULL DEFAULT '{}',
  diagnosis jsonb NOT NULL DEFAULT '{}',
  proposal jsonb NOT NULL DEFAULT '[]',
  risk_level smallint NOT NULL DEFAULT 0 CHECK (risk_level BETWEEN 0 AND 4),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN
    ('draft','pending_review','approved','rejected','applied','measured','closed','rolled_back','expired','superseded')),
  execution_ref jsonb, outcome jsonb, versions jsonb NOT NULL DEFAULT '{}',
  created_by_run_id bigint, approved_by bigint, approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON decision_case (state);
CREATE INDEX ON decision_case (subject_type, subject_id);

CREATE TABLE session (
  id bigserial PRIMARY KEY,
  store_id bigint NOT NULL, channel_id bigint NOT NULL, room_id bigint,
  status text NOT NULL DEFAULT 'planned',
  planned_start timestamptz, actual_start timestamptz, actual_end timestamptz,
  target_gmv numeric(18,4), created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE session_slot (
  id bigserial PRIMARY KEY, session_id bigint NOT NULL REFERENCES session(id),
  seq_no int NOT NULL, sku_id bigint NOT NULL,
  slot_role text NOT NULL CHECK (slot_role IN ('traffic','benefit','hero','profit')),
  planned_minutes int NOT NULL DEFAULT 5,
  live_price numeric(18,4), mechanism jsonb NOT NULL DEFAULT '{}',
  script_version_id bigint, UNIQUE (session_id, seq_no)
);

CREATE TABLE order_line (
  id bigserial PRIMARY KEY,
  order_id bigint NOT NULL, channel_id bigint NOT NULL,
  session_id bigint, sku_id bigint NOT NULL,
  qty int NOT NULL, unit_price numeric(18,4) NOT NULL,
  amount_order numeric(18,4) NOT NULL DEFAULT 0,
  amount_paid  numeric(18,4) NOT NULL DEFAULT 0,
  amount_settle numeric(18,4) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'CNY',
  paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (paid_at);

CREATE TABLE refund (
  id bigserial PRIMARY KEY,
  order_id bigint NOT NULL, order_line_id bigint,
  type text NOT NULL, reason_code text, amount numeric(18,4) NOT NULL,
  attributed_sku_id bigint, attributed_session_id bigint,
  status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE metric_definition (
  code text NOT NULL, caliber_version text NOT NULL,
  name text NOT NULL, unit text NOT NULL, formula_sql text NOT NULL,
  effective_from date NOT NULL, source_url text,
  maturity_required text, dims_allowed text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (code, caliber_version)
);

CREATE TABLE kb_chunk (
  id bigserial PRIMARY KEY,
  version_id bigint NOT NULL, seq int NOT NULL,
  heading_path text, page_from int, page_to int, text text NOT NULL,
  embedding vector(1024), ts tsvector, embedding_version text NOT NULL
);
CREATE INDEX ON kb_chunk USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON kb_chunk USING gin (ts);
```

### 17.3 API 端点（按模块，前缀 `/api/v1`）

| 模块       | 端点                                                                                                                                                                                                                  |                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| 身份/实例    | `POST /auth/code` `POST /auth/login/code` `POST /auth/login/password` `POST /auth/logout` `GET /me` `GET /auth/sessions` `DELETE /auth/sessions/{id}` `GET /members` `POST /invitations` `POST /instance/bootstrap` |                                                                                                  |
| 指标       | `GET /metrics` `GET /metrics/{code}` `POST /metrics/{code}/query`                                                                                                                                                   |                                                                                                  |
| 决策       | `GET /cases` `GET /cases/{id}` `POST /cases/{id}/approve` `POST /cases/{id}/reject` `POST /cases/{id}/apply` `POST /cases/{id}/rollback`                                                                            |                                                                                                  |
| 场次       | `GET/POST /sessions` `GET /sessions/{id}` \`POST /sessions/{id}/start                                                                                                                                               | end` `GET/POST /sessions/{id}/slots` `GET /sessions/{id}/prompter` `GET /sessions/{id}/cockpit\` |
| 复盘       | `POST /sessions/{id}/review` `GET /sessions/{id}/review` `GET /sessions/compare` `GET/POST /action-items`                                                                                                           |                                                                                                  |
| 货盘       | `GET/POST /products` `GET /products/candidates` `GET/POST /prices` `GET/POST /plans` `POST /plans/{id}/publish`                                                                                                     |                                                                                                  |
| 导入       | `POST /connect/upload` `GET /connect/jobs` `GET /connect/quality` `POST /connect/mappings`                                                                                                                          |                                                                                                  |
| 交易       | `GET /orders` `GET /orders/{id}` `GET /refunds` `POST /refunds/{id}/decide`                                                                                                                                         |                                                                                                  |
| 投放       | `GET/POST /ads/campaigns` `GET /ads/spend` `GET/POST /ads/actions` `GET /ads/roi`                                                                                                                                   |                                                                                                  |
| 内容       | `GET/POST /content/authorizations` `GET/POST /content/clips` `POST /content/clips/{id}/publish`                                                                                                                     |                                                                                                  |
| 跨境       | `GET /cb/compliance/{sku}` `GET/POST /cb/listing/drafts` `POST /cb/listing/drafts/{id}/publish` `GET /cb/fulfill/clock/{order}` `GET /cb/settle/reconciliation` `GET /cb/pnl`                                       |                                                                                                  |
| 知识库      | `POST /knowledge/documents` `POST /knowledge/search` `GET /knowledge/coverage`                                                                                                                                      |                                                                                                  |
| 告警/审批/流程 | `GET /alerts` `POST /alerts/{id}/ack` `GET /approvals` `POST /approvals/{id}/decide` `GET /workflows` `POST /workflows/{id}/start`                                                                                  |                                                                                                  |
| 系统       | `GET /system/metrics` `GET /system/sources` `GET /system/ai` `GET /system/modules` `POST /system/modules/{id}/entitle` `GET /audit-logs`                                                                            |                                                                                                  |

### 17.4 术语

| 术语                   | 含义                            |
| -------------------- | ----------------------------- |
| Session（场）           | 运营的一等公民：货 × 流量 × 人 × 场        |
| Decision Case        | 统一决策对象：问题→证据→诊断→方案→审批→执行→结果   |
| L1–L4 / R0–R4        | 动作自动化级别 / 风险等级；平台写操作永远 R3 起   |
| 三口径 GMV              | 下单 / 支付 / 结算，永不合并             |
| 坑产                   | 单品 GMV / 讲解分钟                 |
| 证据包（Evidence Packet） | 结论所依赖的事实、口径版本、区间与哈希           |
| 平台时钟                 | 平台罚则时间规则（48h 打包、3 日历日揽收等），版本化 |
| 熵减指标                 | 运营每天打开次数、决策周期、异常发现时延          |
