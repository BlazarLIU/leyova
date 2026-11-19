# 数据覆盖实测（2026-11-19）

执行方式：`psql -h 127.0.0.1 -p 55432 -U leyova -d leyova -tAc "select count(*) from <table>"`

## 已有数据（≥1 行）
| 表 | 行数 | 说明 |
|---|---:|---|
| fact_fulfillment_waybill | 420 | 11-18 补记补齐（48h 发货时限；378 已签收 / 39 待发货 / 3 已发货未揽收；15 延迟 / 3 假发货风险 / 14 预计赔付） |
| fact_cs_session | 480 | 11-18 补记补齐（4 客服 × 2 班次 × 120 日） |
| fact_after_sale_tickets | 24 | 11-18 补记补齐 |
| canonical_refund_events | 24 | 11-18 补记补齐 |
| session_plan_products | 446 | ⚠️ **其中 417 行 product_name 损坏** |
| session_staff_assignments | 378 | 排班到岗位 |
| script_library | 96 | 话术库 |
| ad_plan | 48 | 投放计划 |
| fact_ad_spend_daily | 140 | 投流消耗 |
| fact_trade_daily | 140 | 交易事实 |
| alert_events | 12 | 告警 |
| goal_tracking | 7 | 11-18 补记补齐（目标 CRUD + 种子） |
| system_jobs | 144 | 异步任务 |
| users | 40 | ⚠️ **其中 25 个是测试污染账号** |

## 仍为 0 行
| 表 | 归属模块 | 性质 |
|---|---|---|
| issue_library | 问题库 | 需用户持续录入（11-18 已做 CRUD + 自动检测一键转问题，但无种子） |
| promotions | 活动管理 | 需用户录入 |
| competitor_brands | 竞品观察 | 需用户录入 |
| compliance_events | 平台规则雷达 / 违规事件看板 | ⚠️ 采集器是 MOCK（见 05） |
| fact_kol_cooperation | 达人合作与佣金 | 可手工录入，无引导 |
| xhs_note | 小红书内容 5 件套 | 依赖平台 API |
| fact_content_daily | 内容排产与归因 | 依赖平台 API |
| fact_search_keyword_daily | 搜索词卡位 | 依赖平台 API |
| fact_settlement_cycles | 结算对账 | 财务，需用户录入 |
| room_health | 直播间健康度 | 有代码无数据 |
| multi_room_status | 多直播间总览 | 有代码无数据 |

## 数据缺陷：417 行坏商品名
```sql
select count(*) total, count(*) filter (where product_name like '%[object Object]%') corrupted
from session_plan_products;
-- 446 | 417
```
坏值样例：`[object Object]精选-T款`、`[object Object]精选-G款`、`[object Object]精选-S款`

根因：`database/demo/generate.mjs:224` `products.push({ id: i, cost, price, safety, cat })`（`cat` 是 `{code, name}` 对象），
`:381` 处使用 `` `${p.cat}精选-${String.fromCharCode(64 + p.id)}款` `` → 对象被字符串化为 `[object Object]`。

影响面：
- `GET /api/v1/sessions/:id/slots` 返回 `"skuTitle":"[object Object]精选-T款"`
- 前端排品编辑页（`/ops/session-products`、`/ai-ops/session/planning`）
- 货盘结构分析、复盘商品分析

## 店铺授权状态
```sql
select platform_code, auth_status, count(*) from dim_shop where status='active' group by 1,2;
```
| 平台 | 授权 |
|---|---|
| douyin | 2 authorized / 3 manual_only |
| kuaishou | 3 manual_only |
| taobao | 3 manual_only |
| tmall | 3 manual_only |
| wechat | 5 manual_only |
| xiaohongshu | 3 manual_only |

合计 22 店，仅 2 个官方 API 授权。
