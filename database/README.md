# 数据库自带实例（database/）

本目录是 leyova 的**全部数据库定义**，不依赖任何外部数据库或历史备份。
三个 SQL 文件按顺序执行，即可从零得到一个可直接登录、各页面都有数据的完整系统。

> 所有业务数据均为**脚本生成的合成数据**（虚构品牌、主播、商品、场次），不含任何真实经营数据。

## 文件清单

| 文件 / 目录 | 作用 | 是否必需 |
|---|---|---|
| `01_schema.sql` | 初始基线表结构：59 张基线表、129 个约束、55 个索引、162 个序列 | 必需（空库初始化） |
| `02_seed.sql` | 基础数据：角色 / 权限 / 模块 / 管理员账号 / 系统配置 / 告警规则 / 目标模板 / 字典 | 必需 |
| `03_demo_data.sql` | 演示数据：运营人员、主播、直播间、场次、各类指标、告警、任务、竞品、话术、培训、排期等 | 可选（只想看空系统可不执行） |
| `migrations/` (`100`~`121`) | 增量演进迁移链（共 22 个 SQL）：多平台底座、数据治理分区、双轨代播、全链路业务域、PostgreSQL RLS、Round 2/中期架构优化与 SKU 级订单明细闭环 | 必需（`pnpm db:migrate`） |

> 执行完整基线 + 全量迁移后，数据库共计 **136 张逻辑表**（含 129 张常规表与 7 张按月分区父表；空库冷启动基线共 **206 张物理表**），其中 **30 张表**启用了 `leyova_app` 角色下的 PostgreSQL RLS 行级安全策略（10 角色 / 41 模块）。

## 快速初始化

```bash
# 1. 建库（PostgreSQL 14+，示例用本机 5432）
createdb -h localhost -p 5432 -U postgres leyova

# 2. 按顺序执行（遇到错误立即停止，便于定位）
psql -h localhost -p 5432 -U postgres -d leyova -v ON_ERROR_STOP=1 -f database/01_schema.sql
psql -h localhost -p 5432 -U postgres -d leyova -v ON_ERROR_STOP=1 -f database/02_seed.sql
psql -h localhost -p 5432 -U postgres -d leyova -v ON_ERROR_STOP=1 -f database/03_demo_data.sql
```

或一条命令：

```bash
for f in database/01_schema.sql database/02_seed.sql database/03_demo_data.sql; do
  psql -h localhost -p 5432 -U postgres -d leyova -v ON_ERROR_STOP=1 -f "$f" || break
done
```

然后把 `apps/api/.env` 与 `apps/mcp-server/.env` 的数据库配置指向该库：

```dotenv
DATABASE_URL=postgresql://postgres:your-password@localhost:5432/leyova
```

## 使用独立的 PostgreSQL 实例（推荐，彻底隔离）

如果机器上已有别的 PostgreSQL（系统实例或其它项目实例），建议为 leyova 单独起一个数据目录，
避免误连到别人的库。以 PostgreSQL 18 为例：

```bash
# 1. 初始化独立数据目录（放在项目内，已加入 .gitignore）
/usr/lib/postgresql/18/bin/initdb -D ./.pgdata -U leyova \
  --auth-local=trust --auth-host=trust --encoding=UTF8 --locale=C

# 2. 启动在独立端口 55432，仅监听本机
/usr/lib/postgresql/18/bin/pg_ctl -D ./.pgdata \
  -o "-p 55432 -c listen_addresses=127.0.0.1 -k /tmp" -l ./.pgdata/server.log start

# 3. 建库并导入
createdb -h 127.0.0.1 -p 55432 -U leyova leyova
psql -h 127.0.0.1 -p 55432 -U leyova -d leyova -v ON_ERROR_STOP=1 -f database/01_schema.sql
psql -h 127.0.0.1 -p 55432 -U leyova -d leyova -v ON_ERROR_STOP=1 -f database/02_seed.sql
psql -h 127.0.0.1 -p 55432 -U leyova -d leyova -v ON_ERROR_STOP=1 -f database/03_demo_data.sql
```

对应 `.env`：

```dotenv
DB_HOST=127.0.0.1
DB_PORT=55432
DB_USER=leyova
DB_NAME=leyova
DATABASE_URL=postgresql://leyova@127.0.0.1:55432/leyova
```

也可以用 PM2 托管该实例，使其随进程列表自动拉起（不写入 `ecosystem.config.cjs`，避免仓库绑定机器路径）：

```bash
pm2 start /usr/lib/postgresql/18/bin/postgres --name leyova-postgres -- \
  -D /absolute/path/to/.pgdata -p 55432 -c listen_addresses=127.0.0.1 -k /tmp
pm2 save
```

## 默认管理员账号

| 用户名 | 密码 | 角色 |
|---|---|---|
| `admin` | `Admin@123456` | super_admin（全部 31 项权限） |

首次登录后请立即在「系统管理 → 用户」中修改密码。

## 幂等性

- `02_seed.sql`：可重复执行。角色/权限/模块用 `ON CONFLICT` 更新，`alert_rules`/`target_templates` 用 `NOT EXISTS` 防重复。
- `03_demo_data.sql`：可重复执行。开头会按外键依赖顺序清空 34 张演示表再重建，**不影响** `users`/`roles`/`permissions`/`system_config` 等基础数据。
- `01_schema.sql` 是建表脚本，只应在空库执行一次。

## 演示数据规模

| 数据 | 数量 | 说明 |
|---|---|---|
| 运营人员 / 主播 / 直播间 | 10 / 20 / 12 | 虚构人员与门店 |
| 直播场次 | 144 | 120 已完结 + 6 直播中 + 18 已排期，覆盖最近 90 天 |
| 场次基础信息 / 总览指标 | 126 / 126 | 与已完结 + 直播中场次对应 |
| 渠道流量指标 | 360 | 90 天 × 4 渠道（自然 / 付费 / 短视频 / 搜索） |
| 场次商品明细 | 720 | 每场 6 个商品 |
| 短视频引流 | 240 | 每场 2 条 |
| 主播历史场次指标 | 600 | 独立历史区间，避免与场次表重复统计 |
| 总览日汇总 | 90 | 最近 90 天 |
| 抖音渠道 / 主播日报 | 120 / 600 | 复盘-渠道、主播效能页使用 |
| 告警事件 / 改进任务 / 动态 | 24 / 18 / 20 | |
| 竞品 / 话术库 / 问题库 / 话术模板 | 6 / 20 / 16 / 8 | |
| 主播能力 / 排名 / 培训计划 / 培训记录 | 20 / 20 / 3 / 12 | |
| 场次排期 / 排期商品 | 21 / 84 | |
| 大促 / 目标 / 数据上传 / 导出 / 多直播间快照 | 3 / 4 / 12 / 6 / 12 | |

数据由 `generate_series` + 取模运算确定性生成，不使用 `random()`，**每次执行结果完全一致**，便于复现问题。

## 覆盖的业务表

`operators`、`anchors`、`anchor_profiles`、`anchor_capabilities`、`anchor_rankings`、
`anchor_script_templates`、`anchor_training_plans`、`anchor_training_records`、
`live_rooms`、`live_sessions`、`room_health`、`multi_room_status`、
`session_live_basic_info`、`session_overview_metrics`、`session_channel_metrics`、
`session_product_details`、`session_short_video_traffic`、`session_anchor_metrics`、
`session_plans`、`session_plan_products`、
`overview_daily_stats`、`overview_activities`、
`douyin_channel_daily_metrics`、`douyin_anchor_daily_metrics`、
`alert_events`、`improvement_tasks`、`promotions`、`goal_tracking`、
`data_uploads`、`data_exports`、`competitor_brands`、`competitor_price_data`、
`script_library`、`issue_library`。

基础表（由 `02_seed.sql` 填充）：`roles`、`permissions`、`role_permissions`、
`system_modules`、`role_modules`、`users`、`system_config`、`alert_rules`、
`target_templates`、`dict_items`。

## 说明与限制

- 表结构与 `apps/api/src/routes/*` 的 SQL 完全对应，空库导入 `01~03` 后需再执行 `pnpm db:migrate`（即 `node database/migrate.js`，记录于 `schema_migrations`）以同步全部 22 个增量迁移 (`100`~`121`)。
- `raw_records`、`clean_records`、`canonical_orders`、`canonical_order_items`、`canonical_refund_events`、`fact_trade_daily`、`fact_traffic_daily` 均已纳入 `cron/manage-partitions.ts` 按月自动预建及 `DEFAULT` 分区兜底机制。
- `apps/api/prisma/schema.prisma` 仅作参考，**不参与建表**，不要用 `prisma migrate` 初始化本项目。
- `01_schema.sql` 由 PostgreSQL 18 导出的 DDL 清洗而来，移除了 `OWNER TO`、扩展依赖（`vector`）与事务超时等环境相关语句，可在 PostgreSQL 14+ 上直接执行。
- 演示数据中的 GMV、订单等为随机合成值，仅用于展示与联调，不具备业务参考意义。
- 如需重置：删库重建后重新执行 `01~03` 与 `pnpm db:migrate` 即可。

参见：[核心数据字典](../docs/data-dictionary/README.md) · [生产运维手册](../docs/operations.md)
