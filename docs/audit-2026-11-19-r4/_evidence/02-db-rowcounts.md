# 证据 02 · 数据库只读采集

> 采集时间：2026-11-19 06:30–06:40 UTC
> 采集方式：`SELECT` / `pg_stat_user_tables` 快照，未执行任何写操作
> 连接：`/home/leyova/apps/api/.env` 的 `DATABASE_URL`（PG `:55432`），本文件不展示连接串

## 1. 总览

| 指标 | 值 |
|---|---|
| public 表总数 | **243** |
| 非空表 | **120** |
| **0 行表** | **123（50.6%）** |

## 2. 关键表行数（采集快照）

| 表 | 行数 | 备注 |
|---|---:|---|
| ai_v2_evidence | 42531 | AI 证据血缘，最大表 |
| ai_v2_claim | 19983 | |
| ai_v2_step | 5244 | |
| ai_v2_run | 3648 | |
| ai_eval_run | 3420 | |
| staff_day_status | 720 | |
| session_short_video_traffic | 501 | |
| fact_cs_session | 480 | 演示数据 |
| session_plan_products | 446 | **其中 417 行商品名损坏** |
| fact_fulfillment_waybill | 420 | 演示数据 |
| session_staff_assignments | 378 | |
| user_module_overrides | 300 | |
| sys_role_permission | 222 | |
| canonical_order_items_y202610 | 216 | |
| canonical_orders_y202610 | 216 | |
| **platform_capability_matrix** | **198** | **0 行 is_applicable=false** |
| fact_order_event_stream | 171 | |
| role_modules | 166 | |
| session_plans | 164 | |
| user_sessions | 153 | |
| live_registrations | 150 | |
| live_sessions | 150 | |
| role_module_grants | 150 | |
| system_jobs | 147 | 全部 completed |
| fact_ad_spend_daily | 140 | |
| session_anchor_metrics | 140 | |
| session_overview_metrics | 140 | |
| user_platform_permissions | 138 | **全部属于测试账号，真实账号 0 行** |
| audit_logs | 130 | |
| canonical_orders_y202611 | 129 | |
| fact_inventory_ledger | 120 | |
| fact_gl_entry | 114 | |
| script_library | 96 | |
| compliance_risk_assessment | 63 | |
| compliance_rule_change | 63 | |
| compliance_rule_snapshot | 63 | |
| fact_selection_recommendation | 61 | |
| ai_eval_case | 60 | |
| fact_gl_voucher | 60 | biz_date 仅 2026-11-16 |
| schema_migrations | 56 | |
| ad_plan | 48 | |
| campaign_plan | 48 | |
| **issue_library** | **0** | 问题库空 |
| **fact_settlement_cycles** | **0** | 结算周期空 |
| system_modules | 41 | 全部 is_enabled=true |
| users | 40 | 含 25 个测试账号 |
| anchors | 13 | |
| alert_events | 24 | |
| goal_tracking | 7 | |
| **ai_config** | **0** | `count(*)=0`（pg_stat 显示 4，已陈旧） |
| ai_tool_logs | 3 | AI 工具调用极少 |
| agg_shop_daily | 3 | 仅 2026-11-18 一天 |
| agg_platform_monthly | 3 | |
| agg_traffic_day_live | 3 | |
| overview_daily_stats | 2 | |
| cleaning_runs | 1 | 手动上传几乎未用 |

**统计信息陈旧**：`ai_config` 的 `n_live_tup=4 / n_dead_tup=19`，实际 `count(*)=0`，`last_analyze` 为空。依赖 `pg_stat` 的估算会高估。

## 3. 0 行表清单（123 张）

```
_deprecated_session_product_details, _deprecated_session_product_skus, ai_action_approvals,
ai_analysis_runs, ai_analysis_steps, ai_context_bindings, ai_v2_llm_call, anchor_script_templates,
anchor_training_records, canonical_order_items, canonical_order_items_default,
canonical_order_items_y202608, canonical_order_items_y202612, canonical_order_items_y202701,
canonical_order_items_y202702, canonical_order_items_y202703, canonical_order_items_y202704,
canonical_order_items_y202705, canonical_order_items_y202706, canonical_orders,
canonical_orders_default, canonical_orders_y202608, canonical_orders_y202612,
canonical_orders_y202701, canonical_orders_y202702, canonical_orders_y202703,
canonical_orders_y202704, canonical_orders_y202705, canonical_orders_y202706,
canonical_refund_events, canonical_refund_events_default, canonical_refund_events_y202608,
canonical_refund_events_y202612, canonical_refund_events_y202701, canonical_refund_events_y202702,
canonical_refund_events_y202703, canonical_refund_events_y202704, canonical_refund_events_y202705,
canonical_refund_events_y202706, clean_records, clean_records_default, clean_records_y202608,
clean_records_y202609, clean_records_y202610, clean_records_y202611, clean_records_y202612,
clean_records_y202701, clean_records_y202702, clean_records_y202703, clean_records_y202704,
clean_records_y202705, clean_records_y202706, competitor_brands, competitor_price_data,
compliance_events, content_assets, content_attribution_ledger, content_projects, content_providers,
content_schedules, content_tasks, data_exports, data_quality_issues, data_uploads, dim_kol,
dim_sku_mapping, douyin_anchor_daily_metrics, douyin_channel_daily_metrics, dq_quarantine,
entity_aliases, fact_content_daily, fact_kol_cooperation, fact_search_keyword_daily,
fact_settlement_cycles, fact_trade_daily, fact_trade_daily_default, fact_trade_daily_y202608,
fact_trade_daily_y2026m12, fact_trade_daily_y202702, fact_trade_daily_y2027m01,
fact_traffic_daily, fact_traffic_daily_default, fact_traffic_daily_y202608,
fact_traffic_daily_y2026m12, fact_traffic_daily_y202701, fact_traffic_daily_y202702,
field_mapping_rules, import_batches, import_files, issue_library, kuaishou_fans_ops,
land_raw_dedup, multi_room_status, overview_activities, overview_daily_stats_archive,
platform_members_summary, pricing_rules, promotions, publish_reversals, publish_runs,
raw_records, raw_records_default, raw_records_y202608, raw_records_y202609,
raw_records_y202610, raw_records_y202611, raw_records_y202612, raw_records_y202701,
raw_records_y202702, raw_records_y202703, raw_records_y202704, raw_records_y202705,
raw_records_y202706, reconciliation_runs, review_actions, room_health, session_channel_metrics,
session_live_basic_info, stg_order_import, taobao_order_hierarchy, upload_column_mappings,
video_metrics, xhs_note
```

**解读**：空表集中在 ① 202608–202706 预建分区 ② raw/clean/canonical 默认分区（数据只在月分区）③ 内容/竞品/达人/搜索词等未接入业务域。`canonical_orders` 主表本身 0 行，数据只在月分区 → 查询必须走分区路由。

## 4. roles（8 行）

| id | code | name |
|---:|---|---|
| 1 | super_admin | 系统管理员 |
| 6 | ops_director | 运营总监 |
| 7 | ops_staff | 运营专员 |
| 8 | controller | 中控 |
| 19 | hrbp | HRBP |
| 33 | ad_buyer | 投放专员 |
| 36 | video_editor | 拍剪 |
| 38 | cs_agent | 客服后端 |

`role_modules` 授权数：super_admin 40、ops_director 34、ops_staff 32、hrbp 16、ad_buyer 14、video_editor 13、cs_agent 11、controller 6。

> 代码与 README 中出现的 `admin` / `operator` / `finance` **均不在该表**。

## 5. system_modules（41 行，全部 `is_enabled=true`）

- **core（28）**：overview, session, anchor, data, bi, ops, review, system_users, system_personnel_ops, system_ai, system_dict, system_rooms, session_products, system_config, audit_logs, system_alerts, system_tasks, system_promotions, system_competitors, system_multiroom, product_center, net_roi, review_overview, review_channels, review_anchors, review_funnel, review_closed_loop, cost_visibility
- **非 core（13）**：content, personal_achievement, ai, live_registration, live_data, fulfillment, after_sales, kol, customer_service, search_seo, content_schedule, members, compliance

> 「模块热插拔」在 DB 层等于不存在：41 个模块全部启用，没有一个是关闭状态。

## 6. platform_capability_matrix

| 指标 | 值 |
|---|---|
| 总行数 | **198** |
| distinct platform | **6** |
| `is_applicable=false` | **0** |
| `needs_dedicated_page=true` | 20 |
| 每平台行数 | 33 |
| 六平台 module_code 集合签名 | **完全相同**（`ef6f070d…`） |

## 7. system_platform_configs（8 行）

| 平台 | 名称 | 启用 | 能力行 | 店铺数 |
|---|---|---:|---:|---:|
| douyin | 抖音电商 | ✅ | 33 | 5（含 2 个测试店） |
| kuaishou | 快手电商 | ✅ | 33 | 3 |
| wechat | 视频号小店 | ✅ | 33 | 5 |
| taobao | 淘宝集市 | ✅ | 33 | 3 |
| tmall | 天猫商城 | ✅ | 33 | 3 |
| xiaohongshu | 小红书电商 | ✅ | 33 | 3 |
| jd | 京东 | ❌ | 0 | 0 |
| pdd | 拼多多 | ❌ | 0 | 0 |

**店铺总数 22**，其中 2 个是测试残留（`__test_oauth_shop`，dim_shop id 50/56，authStatus=authorized）。

## 8. 数据污染与边界

| 检查项 | 结果 |
|---|---|
| `session_plan_products` 总行数 | 446 |
| `product_name LIKE '%[object Object]%'` | **417（93.5%）** |
| `users` 总行数 | 40 |
| `username LIKE '\_\_%'` 测试账号 | **25** |
| `user_platform_permissions` | 138 行，**全部属于 23 个 `__t_ad_buyer_*` 测试账号**，真实账号 0 行 |
| `agg_shop_daily.biz_date` | 仅 **2026-11-18**，3 行 |
| `fact_trade_daily_y2026m10` | 72 行，2026-10-01 ~ 10-31 |
| `fact_traffic_daily_y2026m10` | 72 行，2026-10-01 ~ 10-31 |
| `canonical_orders_y202610` | 216 行，2026-10-01 ~ 10-31 |
| `fact_gl_voucher` | 60 行，biz_date 仅 2026-11-16，period=2026-11 |
| `fact_gl_entry` | 114 行，无 biz_date 字段（仅 created_at） |

**驾驶舱空壳**：`/overview/cockpit` 返回 200，但 `summary.roi=0`、`traffic_sources=[]`、`top_products=[]`。
