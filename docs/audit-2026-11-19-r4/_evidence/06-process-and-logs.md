# 证据 06 · 进程、端口与日志

> 采集时间：2026-11-19 06:32 UTC

## 1. pm2 list

| 名称 | pid | uptime | 重启 | 状态 | 内存 |
|---|---:|---:|---:|---|---:|
| leyova-api | 189686 | 11h | 1 | online | 186.4 MB |
| leyova-web | 189699 | 11h | 1 | online | 100.6 MB |
| leyova-mcp | 2283 | 17h | 0 | online | 100.7 MB |
| leyova-postgres | 2275 | 17h | 0 | online | 30.9 MB |
| **leyova-worker** | — | — | — | **未注册/未运行** | — |

`ecosystem.config.cjs` 定义了 `leyova-worker`（`src/worker.ts`），但 pm2 列表无此应用；`logs/worker-out.log` 最后写入 **2026-11-18 13:12**。

## 2. 监听进程

```
189686 node /home/leyova/apps/api/src/index.ts            # 0.0.0.0:8788
189699 node /home/leyova/apps/web/node_modules/vite/bin/vite.js  # 0.0.0.0:5513
2283   node /home/leyova/apps/mcp-server/src/index.ts      # 9101
2275   postgres                                           # 127.0.0.1:55432
```

## 3. health

```json
{"ok":true,"db":"connected","latencyMs":0,"uptimeSec":42153,"rssMb":186,
 "timestamp":"2026-11-19T06:32:21.911Z"}
```

约 11.7 小时；Web `GET /` 200。

## 4. Worker 缺失的真实影响（重要修正）

API 进程 `/proc/189686/environ` 中**没有** `DISABLE_CRON`，日志证明定时任务在 API 内执行：

```
2026-11-19 01:30:00 [cron] fact aggregation done
2026-11-19 04:00:00 [cron] partition maintenance done
2026-11-19 05:00:01 [cron] multi-platform sync done (total=22, completed=0)
```

`system_jobs` 147 行全部 `completed`，最新 06:00 UTC。

**结论**：独立 worker 未运行，但 **API 内嵌 cron 仍在跑**；`ecosystem.config.cjs` 的 `DISABLE_CRON=true` 与真实进程环境不一致 → 部署配置漂移。多平台同步 `total=22, completed=0` → 22 个店铺同步全部未成功。

## 5. 日志异常

- `logs/api-error.log`（最新 2026-11-19 02:30）：`[llm] provider call failed (404): model 'deepseek-chat' not found` → **AI 生成能力当前不可用**，接口以 200 降级路径掩盖失败。
- 更早（2026-11-13）：`[ai-gateway] OpenClaw call failed ... 401 Unauthorized`。
- `logs/api-out.log` 06:32：本次 P1 探针的外键错误（`live_sessions_anchor_id_fkey`），符合预期。
