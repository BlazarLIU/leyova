# 演示数据包（Demo Data Pack）

本目录存放**独立的演示数据集**，与生产运行完全分离。

## 设计原则

| 原则 | 说明 |
|---|---|
| **独立存放** | 全部演示数据逻辑在 `database/demo/`，不污染 `database/migrations/`（迁移 = 生产 schema 变更） |
| **部署时可选** | 部署脚本默认 **不** 灌入演示数据；显式加 `--with-demo` 才初始化 |
| **可一键清空** | `npm run demo:reset` 清空演示数据，回到「用户自己接数据」的干净状态 |
| **明确标注** | 所有演示数据 `is_demo = true`，与真实数据在库里可区分 |
| **幂等** | 重复执行安全（先清后建） |

## 使用方式

```bash
# 部署时初始化演示数据（首次部署 / 演示环境）
node database/demo/init.mjs --with-demo

# 正式部署（用户自己接数据，不灌演示数据）—— 默认行为
node database/demo/init.mjs

# 用户接入真实数据后，清空演示数据
npm run demo:reset

# 重新灌入演示数据
npm run demo:seed
```

## 文件说明

| 文件 | 作用 |
|---|---|
| `generate.mjs` | 演示数据生成器（确定性，无随机漂移）。生成人员/场次/排品/短视频/订单/HRBP 考勤等全套数据 |
| `init.mjs` | 部署初始化入口：建库 → 跑迁移 → 可选灌演示数据 → 触发聚合回填 |

## 演示数据内容

| 数据域 | 表 | 规模 |
|---|---|---|
| 人员 | `anchors` / `anchor_profiles` / `anchor_capabilities` | 12 / 12 / 12 |
| 团队 | `operators` | 6 |
| 场地 | `live_rooms` | 4（关联真实 `dim_shop`） |
| 货盘 | `dim_product` / `fact_inventory_stock` | 20 / 20 |
| 渠道配额 | `dim_product_channel_listing` | 80 |
| 场次 | `live_registrations` / `live_sessions` | 150 |
| **排品** | `session_plans` / `session_plan_products` | 140 / 426（T/B/P 三组主推款） |
| **短视频引流** | `session_short_video_traffic` | 501 |
| 场次指标 | `session_overview_metrics` / `session_anchor_metrics` | 140 / 140 |
| **交易** | `fact_trade_daily` | 140（`amount_type` 按平台默认口径） |
| **投流** | `fact_ad_spend_daily` | 140（真实投流工具码） |
| 流量 | `fact_traffic_daily` | 140（`source='api_sync'`） |
| **订单** | `canonical_orders` / `canonical_order_items` | 420 / 420 |
| **运单（48h SLA）** | `fact_fulfillment_waybill` | 420（含 15 延迟 / 3 假发货风险 / 14 预计赔付） |
| **退款事件** | `canonical_refund_events` | ~25（约 6% 退款率） |
| **售后工单** | `fact_after_sale_tickets` | ~25（6 类原因归因 + 自治保护） |
| **客服会话** | `fact_cs_session` / `dim_cs_agent` | 480 / 4（含响应率 / 超时率 / 询单转化） |
| 大促提醒 | `compliance_activity_reminder` | 4 |
| **HRBP 排班** | `session_staff_assignments` | 378 |
| **HRBP 考勤** | `staff_day_status` | 720 |
| 培训 | `anchor_training_plans` | 4 |

## 数据来源标注（对应「用户手动上传 / 官方平台 API」两条真实路径）

| 来源 | 标注 | 真实路径对应 |
|---|---|---|
| 用户手动上传 | `source = 'manual_upload'` | `POST /api/v1/ingest/manual-upload`、`POST /api/v1/ingest/preview` |
| 官方平台 API | `source = 'api_sync'` | `POST /api/v1/ingest/sync`、`POST /api/v1/governance/ingest/api` |

> 官方平台 API 的**真实凭证与直连由用户自行接入**；本演示包只用 `api_sync` 标签模拟接入后的数据形态，
> 不含任何真实店铺凭证。

## 不包含的内容（按产品决策）

- **财务板块**：不做，不生成任何凭证 / 总账 / 对账数据
- **AI 运营子系统**：由 Antigravity 单独开发，不在本包范围
