# Leyova 生产运维与安全手册

> 更新日期：2026-11-12

---

## 1. PM2 进程架构与启停管理

进程托管配置位于 [ecosystem.config.cjs](../ecosystem.config.cjs)：

| 进程名 | 工作目录 | 监听端口 | 职责 |
|---|---|---|---|
| `leyova-api` | `apps/api` | `8788` | Fastify 主后端 REST API、SSE AI 编排、内部 `/mcp` 端点及 Cron 调度 |
| `leyova-mcp` | `apps/mcp-server` | `9101` | 独立无状态 MCP 工具服务（对接外部 Agent Runtime） |
| `leyova-web` | `apps/web` | `5513` | React 19 Vite 构建静态资源服务 |

常用启停命令：

```bash
pnpm build
pm2 restart ecosystem.config.cjs --update-env
pm2 status
```

---

## 2. 健康与就绪探针

- **存活与 DB 探针 (`GET /api/v1/health`)**：校验 `SELECT 1`，返回 `200 { success: true, data: { ok: true, db: 'connected', latencyMs, uptimeSec, rssMb } }`；数据库不可用时返回 `503`。
- **就绪探针 (`GET /api/v1/ready`)**：除 `SELECT 1` 外检查核心表 `users`、`roles`、`dim_shop` 是否就绪；未就绪时返回 `503`。
- 该两项端点位于公开白名单中，可直接接入 Nginx/Docker `HEALTHCHECK` 或监控系统探活。

---

## 3. 定时任务调度与 `system_jobs` 可观测性

所有周期任务定义在 [apps/api/src/cron/index.ts](../apps/api/src/cron/index.ts)，统一经由 `runTrackedJob()` 将开始时间、耗时 (`durationMs`)、执行摘要或异常栈写入 PostgreSQL `system_jobs` 表：

| 任务标识 (`job_type`) | Cron 表达式 | 执行频率 | 功能说明 |
|---|---|---|---|
| `aggregate_daily_stats` | `0 1 * * *` | 每日 01:00 | 聚合已完成场次到 `overview_daily_stats` |
| `fact_aggregation` | `30 1 * * *` | 每日 01:30 | 多平台 `agg_shop_daily` / `agg_platform_monthly` 汇总 |
| `ai_review_drafts` | `30 2 * * *` | 每日 02:30 | 为近期已完结场次生成 AI 复盘草稿 |
| `archive_old_data` | `0 3 * * *` | 每日 03:00 | 归档历史 `overview_daily_stats` 到归档表 |
| `partition_maintenance` | `0 4 * * *` | 每日 04:00 | 预建 7 张分区表未来 3 个月分区并确保 `DEFAULT` 分区就位 |
| `platform_api_sync` | `0 5 * * *` | 每日 05:00 | 扫描授权店铺拉数（`manual_only`/未配置 Token 店铺自动跳过） |
| `anomaly_detection` | `0 * * * *` | 每小时 | 执行指标阈值告警规则与波动异常检测 |
| `log_rotation` | `0 2 * * 0` | 每周日 02:00 | 调用 `rotateAllFiles()` 对超过 10MB 的 PM2/系统日志进行滚写截断 |

---

## 4. 数据库备份、分区与日志维护 CLI

### 4.1 数据库备份 ([apps/api/src/cli/backup.ts](../apps/api/src/cli/backup.ts))
- 默认输出到仓库 `.backup/<db>_<timestamp>.sql`，自动校验备份文件体积（`>= 128 bytes`）与 `'PostgreSQL database dump'` 头标识。
- 默认保留最近 `7` 份历史备份（可用 `--retain=N` 或 `--output=/path` 调整）。

```bash
set -a && source apps/api/.env && set +a
pnpm --filter @leyova/api backup
```

### 4.2 日志状态巡检与清理 ([apps/api/src/cli/cleanup-logs.ts](../apps/api/src/cli/cleanup-logs.ts))
- 默认扫描工作区 `logs/` 下的 `api-out.log`、`api-error.log`、`mcp-out.log`、`mcp-error.log`、`web-out.log`、`web-error.log`、`system.log`、`actions.log`、`error.log`。
- 采用 `copyFileSync` 备份 + `truncateSync(..., 0)` 原地清空，确保 PM2 文件句柄不断裂。

```bash
pnpm --filter @leyova/api cleanup-logs          # 只读查看当前日志体积
pnpm --filter @leyova/api cleanup-logs cleanup  # 手动触发超阈值日志滚写清理
```

### 4.3 按月物理分区守护 ([apps/api/src/cron/manage-partitions.ts](../apps/api/src/cron/manage-partitions.ts))
- 全覆盖 `raw_records`、`clean_records`、`canonical_orders`、`canonical_order_items`、`canonical_refund_events`、`fact_trade_daily`、`fact_traffic_daily`。
- 自动查询 `pg_inherits` 与 `pg_get_expr(c.relpartbound, c.oid)` 识别历史区间边界，兼容 `_yYYYYmMM` / `_yYYYYMM` 命名并保障 `DEFAULT` 分区存在。

---

## 5. 安全基线与密钥治理

1. **生产环境强校验 (`apps/api/src/config/env.ts`)**：`NODE_ENV=production` 下拒绝默认示例密钥（`leyova-local-session-secret-change-in-prod`、`leyova-local-mcp-token-change-in-prod`、`change-me` 等），要求随机生成高强度密钥。
2. **MCP 服务间鉴权与防伪造**：
   - `LEYOVA_MCP_TOKEN`：48 位以上随机 Bearer Token，使用 `crypto.timingSafeEqual` 等时比对；
   - `LEYOVA_MCP_SIGNING_SECRET` + `X-Leyova-User-Sig`：网关传递 `X-Leyova-User-Id` 时附带 HMAC-SHA256 签名，并在后端与独立 MCP Server 两侧双向验签；默认禁用 `LEYOVA_MCP_DEFAULT_USER_ID` 隐式回退（fail-closed 返回 `401`/`403`）。
3. **防爆破锁定与账号隔离**：`/api/v1/auth/login` 连续 5 次密码错误锁定 15 分钟并返回 `429` + 写入 `audit_logs`；敏感成本与投放花费由路由守卫、AI 语义层与 PostgreSQL `leyova_app` RLS 策略多重隔离。
4. **测试与静态检查**：

```bash
pnpm --filter @leyova/api exec tsc -p tsconfig.test.json --noEmit
pnpm build
pnpm test
```
