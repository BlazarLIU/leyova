# Leyova 核心数据字典

> 适用范围：PostgreSQL 18 生产数据库 (`146` 张逻辑表 / `222` 张物理含分区表，增量迁移至 `118_complete_audit_domains_and_governance.sql`)。

---

## 1. 全渠道事实表与口径控制（含 PostgreSQL 月分区）

| 表名 | 分区/隔离 | 核心字段说明 | 口径与用途 |
|---|---|---|---|
| `fact_trade_daily` | 按 `biz_date` 月分区 (+ `DEFAULT`) · RLS | `biz_date`, `platform_code`, `shop_id`, `channel_name`, `amount_type`, `gmv`, `pay_amount`, `paid_order_count`, `refund_amount`, `source`, `upload_id` | 平台交易日汇总；默认按 `platform_caliber_config` 过滤主口径 `amount_type`，`upload_id` 关联 `data_uploads` |
| `fact_traffic_daily` | 按 `biz_date` 月分区 (+ `DEFAULT`) · RLS | `biz_date`, `platform_code`, `shop_id`, `traffic_source_code`, `impressions`, `clicks`, `visitors`, `upload_id` | 各平台流量日事实表，联动 `dim_traffic_source` 与 `platform_source_mapping` |
| `fact_ad_daily` | 普通表 | `biz_date`, `platform_code`, `shop_id`, `ad_spend`, `ad_gmv`, `impressions`, `clicks`, `conversions` | AI 语义层投流主题事实源（仅对 `canAccessAdSpend` 角色开放） |
| `fact_ad_spend_daily` | RLS | `biz_date`, `platform_code`, `shop_id`, `ad_tool_code`, `ad_spend`, `attributed_gmv`, `settled_gmv`, `settled_net_roi` | 分工具/归因窗口与 T+7 净成交 ROI 双时间线事实表，关联 `ad_tool_dict` |
| `fact_search_keyword_daily` | RLS | `platform_code`, `shop_id`, `biz_date`, `keyword`, `product_id`, `search_rank`, `search_share_pct`, `search_gmv` | 全域搜索卡位与转化指标，关联 `dim_product` / `xhs_note` |
| `fact_content_daily` | 普通表 | `biz_date`, `platform_code`, `shop_id`, `views`, `likes`, `comments`, `shares`, `collects`, `attributed_gmv` | 短视频与图文内容数据汇总 |
| `fact_settlement_cycles` | 普通表 | `platform_code`, `shop_id`, `order_id`, `settlement_status`, `gross_amount`, `settled_amount` | 平台回款结算与 T+N 周期对账 |

---

## 2. 电商全业务链领域表（迁移 116 / 118）

| 领域 | 核心表名 | 关键业务能力 |
|---|---|---|
| 商品与全渠道库存 | `dim_product`, `dim_sku_mapping`, `fact_inventory_stock`, `fact_inventory_ledger` | 一物一码主数据、`platform_sku_id` 跨平台映射、可用/锁定库存与出入库流水 |
| 履约 SLA 与赔付风控 | `platform_sla_config`, `fact_fulfillment_waybill` | 7 平台 48h 揽收/虚假发货/延误赔付标准 (`sla_hours`) 与运单履约状态 |
| 售后工单与原因归因 | `fact_after_sale_tickets` | 仅退款/退货退款工单、退因分类 (`reason_category`)、责任人流转 |
| 外部达人与分销台账 | `dim_kol`, `fact_kol_cooperation` | 外部达人级别档案、PIT/寄样/佣金比例与带货结算追踪 |
| 客服响应绩效 | `dim_cs_agent`, `fact_cs_session` | 首次响应时长 (`first_reply_seconds`)、满意度、询单转化追踪 |
| 内容排期与归因闭环 | `content_schedules`, `content_attribution_ledger`, `content_assets` | 选题至多端适配发布追踪、内容 → 回搜 → 成交 GMV 归因台账 |
| 大促规则 · 会员 · 合规 | `promotions`, `promotion_rules`, `platform_members_summary`, `compliance_events` | 5 层优惠叠加防破价试算（独占互斥+商家/平台分摊）、私域复购分级、自动跟价风控台账 |

---

## 3. 企业级数据治理与双轨接入管道

| 阶段 | 表名 | 说明 |
|---|---|---|
| 批次与文件防重 | `import_batches`, `import_files`, `data_uploads`, `ingest_sync_jobs` | 记录 SHA-256 哈希去重、上传文件血缘 (`upload_id`) 与平台 API 同步作业 |
| 原始/清洗层 (月分区) | `raw_records`, `clean_records`, `cleaning_runs`, `clean_rule_sets`, `field_mapping_rules`, `upload_column_mappings` | 全量留存原始行并执行字段映射、人民币/万单位转换及空值不补零清洗 |
| 校验与人工审核 | `validation_runs`, `data_quality_issues`, `review_actions` | P0/P1/P2 分级问题隔离；未解决 P0 严格阻断发布 |
| 规范事实与发布冲正 (月分区) | `canonical_orders`, `canonical_order_items`, `canonical_refund_events`, `publish_runs`, `publish_reversals`, `reconciliation_runs` | 财务级余数归底分摊、双源对账；撤销冲正原子级作废并扣回 `fact_trade_daily` |

---

## 4. 权限矩阵、PostgreSQL RLS 与可观测审计

| 表名 | 说明 |
|---|---|
| `roles`, `permissions`, `role_permissions`, `role_modules`, `system_modules` | 10 类内部角色与 31 项功能权限、12+ 模块菜单绑定 |
| `role_platform_permissions`, `user_platform_permissions`, `brand_viewer_permissions` | 角色×平台、账号×店铺及外部 `brand_viewer` (`can_view_cost`) 细粒度权限与 RLS 辅助函数 (`rls_can_access_shop`, `rls_tenant_id`, `rls_is_agency_staff`) |
| `users`, `user_sessions`, `anchors` | 登录账号、会话 Token (`user_sessions`) 及与主播实体的可选绑定 (`users.anchor_id`) |
| `audit_logs`, `ai_tool_logs`, `ai_action_approvals`, `ai_analysis_runs`, `ai_analysis_steps` | 写操作变更前后快照、防爆破锁定事件、AI 工具/审批链路与分析步骤审计 |
| `system_jobs`, `system_config`, `system_platform_configs`, `platform_caliber_config` | Cron 运行状态与耗时/报错记录 (`system_jobs`)、平台开关与主口径配置 |
