import type { DbExecutor } from '../lib/db.js'

export interface AnchorCapabilityRow {
  id: number
  anchor_id: number
  anchor_name: string
  platform: string | null
  platform_code: string | null
  expression: number
  interaction: number
  conversion: number
  professionalism: number
  overall: number
  evaluated_at: string
}

export interface AnchorDimensionSummary {
  id: 'expression' | 'interaction' | 'conversion' | 'professionalism'
  label: string
  score: number
  color: 'primary' | 'accent' | 'success' | 'warning'
}

export interface AnchorRankingItem {
  rank: number
  id: number
  anchorId: number
  name: string
  overall: number
  expression: number
  interaction: number
  conversion: number
  professionalism: number
}

/**
 * 统一的主播能力评估与综合排名服务。
 * 单一事实源：anchor_capabilities（按 evaluated_at 取每位在播主播最新一次评估）。
 */
export async function getAnchorCapabilitiesAndRankings(
  executor: DbExecutor,
  options?: { anchorId?: number; status?: number },
): Promise<{
  dimensions: AnchorDimensionSummary[]
  anchorRankings: AnchorRankingItem[]
  capabilities: AnchorCapabilityRow[]
  rankings: AnchorRankingItem[]
}> {
  const statusFilter = options?.status ?? 1
  const params: any[] = [statusFilter]
  let anchorFilterSql = ''
  if (options?.anchorId !== undefined) {
    params.push(options.anchorId)
    anchorFilterSql = `AND ac.anchor_id = $${params.length}`
  }

  const { rows: caps } = await executor.query<AnchorCapabilityRow>(
    `SELECT *
     FROM (
       SELECT DISTINCT ON (ac.anchor_id)
              ac.id,
              ac.anchor_id,
              a.name AS anchor_name,
              a.platform,
              a.platform_code,
              COALESCE(ac.expression, 0)::numeric::float AS expression,
              COALESCE(ac.interaction, 0)::numeric::float AS interaction,
              COALESCE(ac.conversion, 0)::numeric::float AS conversion,
              COALESCE(ac.professionalism, 0)::numeric::float AS professionalism,
              COALESCE(ac.overall, 0)::numeric::float AS overall,
              ac.evaluated_at::text AS evaluated_at
       FROM anchor_capabilities ac
       JOIN anchors a ON a.id = ac.anchor_id
       WHERE a.status = $1
         ${anchorFilterSql}
       ORDER BY ac.anchor_id, ac.evaluated_at DESC, ac.id DESC
     ) latest
     ORDER BY latest.overall DESC, latest.anchor_id ASC`,
    params,
  )

  const avg = (picker: (row: AnchorCapabilityRow) => number) =>
    caps.length > 0
      ? Math.round(caps.reduce((sum, c) => sum + Number(picker(c) || 0), 0) / caps.length)
      : 0

  const dimensions: AnchorDimensionSummary[] = [
    { id: 'expression', label: '表达能力', score: avg((c) => c.expression), color: 'primary' },
    { id: 'interaction', label: '互动能力', score: avg((c) => c.interaction), color: 'accent' },
    { id: 'conversion', label: '转化能力', score: avg((c) => c.conversion), color: 'success' },
    { id: 'professionalism', label: '专业度', score: avg((c) => c.professionalism), color: 'warning' },
  ]

  const anchorRankings: AnchorRankingItem[] = caps.map((r, idx) => ({
    rank: idx + 1,
    id: r.id || r.anchor_id || idx + 1,
    anchorId: r.anchor_id,
    name: r.anchor_name || `主播 ${idx + 1}`,
    overall: Number(r.overall) || 0,
    expression: Number(r.expression) || 0,
    interaction: Number(r.interaction) || 0,
    conversion: Number(r.conversion) || 0,
    professionalism: Number(r.professionalism) || 0,
  }))

  return {
    dimensions,
    anchorRankings,
    capabilities: caps,
    rankings: anchorRankings,
  }
}

export async function getAnchorCapabilityHistory(
  executor: DbExecutor,
  anchorId: number,
): Promise<Array<{
  date: string
  expression: number
  interaction: number
  conversion: number
  professionalism: number
  overall: number
}>> {
  const { rows } = await executor.query(
    `SELECT to_char(evaluated_at, 'YYYY-MM-DD') AS date,
            expression, interaction, conversion, professionalism, overall
     FROM anchor_capabilities
     WHERE anchor_id = $1
     ORDER BY evaluated_at ASC`,
    [anchorId],
  )
  return rows
}

