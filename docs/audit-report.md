# 开源发布前审计报告

本文件记录 leyova 在开源发布前所做的安全审计、脱敏处理与可运行性调整。

## 1. 审计范围

| 模块 | 路径 | 说明 |
| --- | --- | --- |
| 后端 API | `apps/api` | Fastify 5 + PostgreSQL，含路由、定时任务、CLI |
| 前端 Web | `apps/web` | Vite 6 + React 19 + TypeScript |
| MCP Server | `apps/mcp-server` | 21 个工具，风险分级 + 审批 + 审计 |

## 2. 已处理的敏感信息

| 问题 | 位置 | 处理方式 |
| --- | --- | --- |
| 数据库超级用户明文口令 | `src/cli/backup.ts` | 移除硬编码，改从 `PGPASSWORD` / `DB_PASSWORD` 读取 |
| 数据库 socket 路径硬编码 | `src/cli/backup.ts`、`src/lib/db.ts` | 改由 `DATABASE_URL` 或 `DB_*` 环境变量驱动 |
| MCP 连接串兜底硬编码 | `mcp-server/src/db.ts` | 移除兜底值，缺少 `DATABASE_URL` 时直接报错退出 |
| 备份脚本命令拼接 | `src/cli/backup.ts` | `execSync` 字符串拼接改为 `execFileSync` 参数数组 |
| 默认账号口令 `123456` | `src/config/env.ts`、`src/routes/system.ts`、`src/routes/personnel.ts`、前端 `AccountsSection.tsx` | 去掉默认值，未配置时拒绝创建账号 |
| 开发用弱口令默认值 | `SESSION_SECRET`、`YON_MCP_TOKEN` | 生产环境（`NODE_ENV=production`）强制校验不得使用开发默认值 |
| 真实 `.env` | `apps/*/.env` | 不入库（`.gitignore`），仅提交全占位的 `.env.example` |

## 3. 已去除的品牌与部署信息

| 类型 | 处理 |
| --- | --- |
| 原品牌名 | 全量替换为 `leyova`，含前端页面文案、后端 AI 系统提示词、OpenAPI 文档、架构文档 |
| 企业自定义 Logo | 删除 `apps/web/public/logo.jpg`，统一使用 `orbit-icon.svg` |
| 法律警示文案 | 登录页「刑事责任」中英警示替换为 Apache-2.0 通用说明 |
| 内网穿透域名 | `vite.config.ts` 中 `newy.vip.cpolar.cn` 改为 `VITE_ALLOWED_HOSTS` 环境变量 |
| 本机绝对路径 | `/home/<user>/...`、`/home/odlive/...` 改为环境变量或相对路径 |
| 数据库名 / Cookie 名 | 示例值改为 `leyova` / `leyova_session` |

## 4. 可运行性调整

- 补充缺失依赖声明：`dotenv`、`node-cron`、`pino`、`@types/node-cron`。
- `pino` 导入方式修正为具名导入（`import { pino } from 'pino'`）。
- 端口错开，避免与既有部署冲突：后端 `8788`、前端 `5513`、MCP `9101`。
- OpenClaw 集成改为可选：未设置 `OPENCLAW_HOME` 时相关接口返回 `{ enabled: false }`。
- 前端依赖锁定为与已验证版本一致的 `~` 版本号，避免次版本漂移导致构建失败。

## 5. 验证结果

| 项目 | 结果 |
| --- | --- |
| `pnpm install` | 通过 |
| `tsc --noEmit`（api / web / mcp-server） | 0 error |
| `pnpm build`（三端） | 通过 |
| `GET /api/v1/health`（8788） | `{"ok":true,"db":"connected"}` |
| `GET /api/v1/ready`（8788） | `{"ok":true,"db":"connected"}` |
| 前端 `http://localhost:5513/` | HTTP 200 |
| MCP `GET /health`（9101） | `{"status":"ok","tools":21}` |
| 与既有部署并存（8787） | 无冲突 |
| 敏感串扫描（`.env` 除外） | 无残留 |

## 6. 发布前仍需处理

1. 轮换所有曾在开发环境中使用过的密钥（数据库口令、`SESSION_SECRET`、`YON_MCP_TOKEN`、AI Provider Key）。
2. 若曾将真实 `.env` 提交到任何历史仓库，需重写历史或视为已泄漏处理。
3. 生产部署时通过环境变量注入密钥，不要写入镜像或仓库。
