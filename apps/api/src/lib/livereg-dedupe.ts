/**
 * livereg-dedupe.ts -- 直播登记去重校验
 *
 * 重复判定规则：同一天 + 同主播 + 同直播间 + 同开始时间，且状态非作废
 * （status <> 'cancelled'）视为重复。编辑更新时通过 excludeId 排除自身。
 * startTime 为空时跳过查重（与现状一致，避免误拦截）。
 */

export interface SqlPool {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>
}

export interface DedupeParams {
  date?: string
  roomId?: number
  anchorId?: number
  startTime?: string
  /** 编辑更新时传入当前记录 id，用于排除自身 */
  excludeId?: number
}

export interface DuplicateRow {
  id: number
  anchor_name: string | null
  room_name: string | null
}

/** 查重查询；命中返回重复行，否则返回 null。 */
export async function findDuplicateSession(
  pool: SqlPool,
  { date, roomId, anchorId, startTime, excludeId }: DedupeParams
): Promise<DuplicateRow | null> {
  if (!startTime) return null
  const excludeClause = excludeId ? 'AND ls.id <> $5' : ''
  const bind: unknown[] = excludeId
    ? [date, roomId, anchorId, startTime, excludeId]
    : [date, roomId, anchorId, startTime]
  const { rows } = await pool.query(
    `SELECT ls.id, a.name AS anchor_name, r.name AS room_name
     FROM live_sessions ls
     LEFT JOIN anchors a ON a.id = ls.anchor_id
     LEFT JOIN live_rooms r ON r.id = ls.room_id
     WHERE ls.date = $1::date
       AND ls.room_id = $2
       AND ls.anchor_id = $3
       AND ls.start_time = $4::time
       AND ls.status <> 'cancelled'
       ${excludeClause}
     LIMIT 1`,
    bind
  )
  return rows[0] ?? null
}

/** 拼装给用户的可读重复提示文案。 */
export function buildDuplicateMessage(
  dup: DuplicateRow | null,
  date?: string,
  startTime?: string
): string {
  const dateText = String(date ?? '').slice(0, 10)
  const timeText = String(startTime ?? '').slice(0, 5)
  const anchorName = dup?.anchor_name ?? ''
  const roomName = dup?.room_name ?? ''
  return `${anchorName} 在${roomName ? `「${roomName}」` : ''}${dateText} ${timeText} 已登记开播，请勿重复登记`
}
