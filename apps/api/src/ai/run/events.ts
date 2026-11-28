/**
 * ai/run/events.ts — Run 事件持久化与实时订阅
 *
 * 设计要点：
 *   1. 每个 Run 的事件 seq 由 ai_v2_run.cursor 原子自增分配，保证全局单调且无空洞。
 *   2. 事件先落库（durable）再广播（live），断线重连时按 cursor 从库里补发，做到「事件无丢」。
 *   3. 广播只在单进程内有效；跨进程（API ↔ Worker）通过数据库补发兜底。
 */

import { getPool, type DbExecutor } from '../../lib/db.js'

export type RunEventType =
  | 'run.started'
  | 'plan.ready'
  | 'step.started'
  | 'step.completed'
  | 'answer.delta'
  | 'run.completed'
  | 'run.failed'
  | 'run.cancelled'

export interface RunEvent {
  runId: string
  seq: number
  type: RunEventType | string
  payload: Record<string, unknown>
  createdAt?: string
}

type Listener = (event: RunEvent) => void

const listeners = new Map<string, Set<Listener>>()

export function subscribeRun(runId: string, listener: Listener): () => void {
  let set = listeners.get(runId)
  if (!set) {
    set = new Set()
    listeners.set(runId, set)
  }
  set.add(listener)
  return () => {
    const current = listeners.get(runId)
    if (!current) return
    current.delete(listener)
    if (current.size === 0) listeners.delete(runId)
  }
}

function publishRunEvent(event: RunEvent): void {
  const set = listeners.get(event.runId)
  if (!set) return
  for (const listener of set) {
    try {
      listener(event)
    } catch {
      // 单个订阅者异常不影响其它订阅者
    }
  }
}

/** 追加一条事件并实时广播；seq 来自 run.cursor 的原子自增 */
export async function appendRunEvent(
  db: DbExecutor | undefined,
  runId: string,
  type: RunEventType | string,
  payload: Record<string, unknown> = {},
  tenantId = 1
): Promise<RunEvent> {
  const executor = db || getPool()
  const { rows } = await executor.query<{ cursor: number }>(
    `UPDATE public.ai_v2_run
        SET cursor = cursor + 1, updated_at = now()
      WHERE id = $1
      RETURNING cursor`,
    [runId]
  )
  if (!rows[0]) throw new Error(`run not found: ${runId}`)
  const seq = rows[0].cursor

  const inserted = await executor.query<{ created_at: Date }>(
    `INSERT INTO public.ai_v2_event (run_id, seq, type, payload, tenant_id)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING created_at`,
    [runId, seq, type, JSON.stringify(payload), tenantId]
  )

  const event: RunEvent = {
    runId,
    seq,
    type,
    payload,
    createdAt: inserted.rows[0]?.created_at?.toISOString?.() || new Date().toISOString(),
  }
  publishRunEvent(event)
  return event
}

/** 按 cursor 补发事件（seq > cursor），用于断线重连 */
export async function listRunEvents(
  db: DbExecutor | undefined,
  runId: string,
  cursor = 0,
  limit = 500
): Promise<RunEvent[]> {
  const executor = db || getPool()
  const { rows } = await executor.query<{
    run_id: string
    seq: number
    type: string
    payload: Record<string, unknown>
    created_at: Date
  }>(
    `SELECT run_id, seq, type, payload, created_at
       FROM public.ai_v2_event
      WHERE run_id = $1 AND seq > $2
      ORDER BY seq ASC
      LIMIT $3`,
    [runId, cursor, limit]
  )
  return rows.map((r) => ({
    runId: r.run_id,
    seq: r.seq,
    type: r.type,
    payload: r.payload || {},
    createdAt: r.created_at?.toISOString?.() || undefined,
  }))
}
