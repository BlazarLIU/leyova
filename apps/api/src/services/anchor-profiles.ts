/**
 * anchor-profiles.ts — 主播轻量能力画像服务
 */

import type { Queryable } from './attribution-engine.js'

export interface AnchorCompetencyProfile {
  id: number
  tenantId: number
  anchorName: string
  suitableCategories: string[]
  styleTags: string[]
  hourlyRate: number
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
}

export async function listAnchorCompetencyProfiles(
  db: Queryable,
  tenantId: number,
): Promise<AnchorCompetencyProfile[]> {
  const { rows } = await db.query(
    `SELECT id, tenant_id AS "tenantId", anchor_name AS "anchorName",
            suitable_categories AS "suitableCategories", style_tags AS "styleTags",
            hourly_rate::numeric AS "hourlyRate", status,
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM public.anchor_competency_profiles
      WHERE tenant_id = $1
      ORDER BY id ASC`,
    [tenantId],
  )
  return rows.map((r: any) => ({
    ...r,
    hourlyRate: Number(r.hourlyRate) || 0,
    suitableCategories: Array.isArray(r.suitableCategories) ? r.suitableCategories : [],
    styleTags: Array.isArray(r.styleTags) ? r.styleTags : [],
  }))
}

export async function createAnchorCompetencyProfile(
  db: Queryable,
  tenantId: number,
  data: {
    anchorName: string
    suitableCategories?: string[]
    styleTags?: string[]
    hourlyRate?: number
  },
): Promise<AnchorCompetencyProfile> {
  const { rows } = await db.query(
    `INSERT INTO public.anchor_competency_profiles
       (tenant_id, anchor_name, suitable_categories, style_tags, hourly_rate, status)
     VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
     ON CONFLICT (tenant_id, anchor_name)
     DO UPDATE SET
       suitable_categories = EXCLUDED.suitable_categories,
       style_tags = EXCLUDED.style_tags,
       hourly_rate = EXCLUDED.hourly_rate,
       status = 'ACTIVE',
       updated_at = now()
     RETURNING id, tenant_id AS "tenantId", anchor_name AS "anchorName",
               suitable_categories AS "suitableCategories", style_tags AS "styleTags",
               hourly_rate::numeric AS "hourlyRate", status,
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [
      tenantId,
      data.anchorName,
      data.suitableCategories || [],
      data.styleTags || [],
      data.hourlyRate || 0,
    ],
  )
  const r = rows[0]
  return {
    ...r,
    hourlyRate: Number(r.hourlyRate) || 0,
    suitableCategories: Array.isArray(r.suitableCategories) ? r.suitableCategories : [],
    styleTags: Array.isArray(r.styleTags) ? r.styleTags : [],
  }
}

export async function updateAnchorCompetencyProfile(
  db: Queryable,
  tenantId: number,
  id: number,
  data: Partial<{
    anchorName: string
    suitableCategories: string[]
    styleTags: string[]
    hourlyRate: number
    status: 'ACTIVE' | 'INACTIVE'
  }>,
): Promise<AnchorCompetencyProfile | null> {
  const fields: string[] = []
  const values: any[] = [tenantId, id]
  let idx = 3

  if (data.anchorName !== undefined) {
    fields.push(`anchor_name = $${idx++}`)
    values.push(data.anchorName)
  }
  if (data.suitableCategories !== undefined) {
    fields.push(`suitable_categories = $${idx++}`)
    values.push(data.suitableCategories)
  }
  if (data.styleTags !== undefined) {
    fields.push(`style_tags = $${idx++}`)
    values.push(data.styleTags)
  }
  if (data.hourlyRate !== undefined) {
    fields.push(`hourly_rate = $${idx++}`)
    values.push(data.hourlyRate)
  }
  if (data.status !== undefined) {
    fields.push(`status = $${idx++}`)
    values.push(data.status)
  }
  fields.push(`updated_at = now()`)

  const { rows } = await db.query(
    `UPDATE public.anchor_competency_profiles
        SET ${fields.join(', ')}
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id AS "tenantId", anchor_name AS "anchorName",
                suitable_categories AS "suitableCategories", style_tags AS "styleTags",
                hourly_rate::numeric AS "hourlyRate", status,
                created_at AS "createdAt", updated_at AS "updatedAt"`,
    values,
  )
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    ...r,
    hourlyRate: Number(r.hourlyRate) || 0,
    suitableCategories: Array.isArray(r.suitableCategories) ? r.suitableCategories : [],
    styleTags: Array.isArray(r.styleTags) ? r.styleTags : [],
  }
}
