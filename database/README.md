# 数据库自带实例（database/）

本目录是 leyova 的**全部数据库定义**，不依赖任何外部数据库或历史备份。
执行基线 schema、基础数据与增量迁移，即可从零得到一个可直接登录的空系统。

> 仓库不再附带任何演示/合成业务数据、默认管理员口令或预置大模型凭据。系统初始化后只保留角色、权限、模块、
> 系统配置、告警规则、目标模板等系统默认数据；首次访问通过 `/setup` 创建最高权限账号。

## 文件清单

| 文件 / 目录 | 作用 | 是否必需 |
|---|---|---|
| `01_schema.sql` | 初始基线表结构：基线表、约束、索引、序列 | 必需（空库初始化） |
| `02_seed.sql` | 系统默认数据：6 个内置角色、模块、角色模块授权、系统配置、告警规则、目标模板 | 必需 |
| `migrations/` (`100`~`226`) | 增量演进迁移链（共 122 个 SQL）：多平台底座、数据治理分区、双轨代播、全链路业务域、PostgreSQL RLS、中期架构优化、SKU 级订单明细闭环、演示/冗余数据与默认配置清理 | 必需（`pnpm db:setup`） |

> 基线 schema 中已包含后续迁移的最终对象形态；迁移文件对历史视图/约束做了幂等兼容，
> 因此既支持“空库全量迁移”，也支持在既有库上增量执行。

## 快速初始化（推荐）

```bash
# 1. 建库（PostgreSQL 14+）
createdb -h 127.0.0.1 -p 5432 -U postgres leyova

# 2. 执行基线 + 基础数据 + 全部增量迁移
DATABASE_URL=postgresql://postgres:your-password@127.0.0.1:5432/leyova pnpm db:setup
```

`pnpm db:setup` 等价于 `node database/migrate.js`：空库时先执行 `01_schema.sql` 与
`02_seed.sql`，再按文件名顺序执行 `migrations/*.sql`，执行记录写入 `schema_migrations`。

也可手工分步执行（仅基线 + 基础数据，之后再跑迁移）：

```bash
psql -h 127.0.0.1 -p 5432 -U postgres -d leyova -v ON_ERROR_STOP=1 -f database/01_schema.sql
psql -h 127.0.0.1 -p 5432 -U postgres -d leyova -v ON_ERROR_STOP=1 -f database/02_seed.sql
DATABASE_URL=postgresql://postgres:your-password@127.0.0.1:5432/leyova pnpm db:migrate
```

然后把 `apps/api/.env` 与 `apps/mcp-server/.env` 的数据库配置指向该库：

```dotenv
DATABASE_URL=postgresql://postgres:your-password@127.0.0.1:5432/leyova
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

# 3. 建库并初始化
createdb -h 127.0.0.1 -p 55432 -U leyova leyova
DATABASE_URL=postgresql://leyova@127.0.0.1:55432/leyova pnpm db:setup
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

## 首次初始化超管账号

全新数据库初始化完成后**不预置任何用户账号**，`instance_setup.status` 为 `pending`：

- 首次访问 Web 控制台时会自动跳转 `/setup` 安装向导；
- 使用服务端启动日志打印的一次性 `X-Leyova-Setup-Token`（或提前设置的 `LEYOVA_SETUP_TOKEN` 环境变量），即可由部署者自主创建首个 `super_admin` 最高权限账号与密码；
- 如有已自定义超管账号的存量数据库升级，`223_purge_demo_data.sql` 会保留已有超管账号，仅清理演示数据、历史默认口令账号与未加密的预置大模型配置。

## 幂等性

- `02_seed.sql`：可重复执行。角色/模块用 `ON CONFLICT` 更新，`system_config`、
  `alert_rules`、`target_templates` 使用 `NOT EXISTS` 防重复。
- `migrations/`：按 `schema_migrations.version` 记录，已执行的版本不会重复执行。
- `01_schema.sql` 是建表脚本，只应在空库执行一次。
- 迁移 `223_purge_demo_data.sql` 为幂等兜底：清理既有库中的演示业务数据与演示账号，
  仅保留默认超管 admin，可安全重复执行。

## 基础数据说明

由 `02_seed.sql` 填充的系统默认数据：

- 角色（6 个）：`super_admin`、`ops_director`、`ops_staff`、`controller`、`hrbp`、
  `ad_buyer`。其余角色由用户在「角色管理」页自建（`POST /api/v1/system/roles`）
- 系统模块与角色模块授权
- 平台配置与系统配置项
- 默认告警规则
- 目标模板

不含任何账号（默认超管由迁移 `113` / `223` 确保存在）、商品、店铺、场次、指标或订单数据。

## 测试数据库

API 集成测试使用独立的 `_test` 库，不触碰产品库：

```bash
createdb -h 127.0.0.1 -p 55432 -U leyova leyova_test
DATABASE_URL=postgresql://leyova@127.0.0.1:55432/leyova_test pnpm db:setup

cd apps/api
TEST_DATABASE_URL=postgresql://leyova@127.0.0.1:55432/leyova_test pnpm test
```

`apps/api/test/fixtures/seed.ts` 会在 `NODE_ENV=test` 且库名以 `_test` 结尾时，
写入固定 ID（9001 段）的最小测试夹具（店铺、品牌、商品、主播、场次、指标、结算等），
用于测试断言；产品库始终为零演示数据。

## 说明与限制

- 表结构与 `apps/api/src/routes/*` 的 SQL 完全对应。
- `raw_records`、`clean_records`、`canonical_orders`、`canonical_order_items`、`canonical_refund_events`、`fact_trade_daily`、`fact_traffic_daily` 均已纳入 `cron/manage-partitions.ts` 按月自动预建及 `DEFAULT` 分区兜底机制。
- `apps/api/prisma/schema.prisma` 仅作参考，**不参与建表**，不要用 `prisma migrate` 初始化本项目。
- `01_schema.sql` 由 PostgreSQL 18 导出的 DDL 清洗而来，移除了 `OWNER TO`、事务超时等环境相关语句，可在 PostgreSQL 14+ 上直接执行（需可用的 `vector` 与 `pg_trgm` 扩展，脚本会自动创建）。
- 如需重置：删库重建后重新执行 `pnpm db:setup` 即可。
