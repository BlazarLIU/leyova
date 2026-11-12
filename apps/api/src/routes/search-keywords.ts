import type { FastifyInstance } from 'fastify'
import { sendError, sendOk } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { assertShopPlatform } from '../lib/shop-guard.js'

const SEARCH_WRITE_ROLES = ['super_admin', 'admin', 'ops_director', 'operator', 'ops_staff', 'ad_buyer']

/**
 * 搜索关键词卡位排名 & 小红书笔记搜索词联合分析路由
 */
export async function searchKeywordRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/search-keywords ── 搜索词卡位、份额与 GMV 转化追踪
  app.get<{
    Querystring: { platform?: string; shopId?: string; from?: string; to?: string; q?: string }
  }>('/api/v1/search-keywords', { preHandler: [requireAuth] }, async (request, reply) => {
    const { platform, shopId, from, to, q } = request.query || {}
    const toDate = to || new Date().toISOString().slice(0, 10)
    const fromDate = from || new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10)

    try {
      const data = await withRlsContext(request, async (client) => {
        const params: any[] = [fromDate, toDate]
        let filterSql = ''
        if (platform) {
          params.push(platform)
          filterSql += ` AND f.platform_code = $${params.length}`
        }
        if (shopId) {
          params.push(Number(shopId))
          filterSql += ` AND f.shop_id = $${params.length}`
        }
        if (q && q.trim()) {
          params.push(`%${q.trim()}%`)
          filterSql += ` AND f.keyword ILIKE $${params.length}`
        }

        const { rows: items } = await client.query(
          `SELECT f.*, s.shop_name, p.platform_name, dp.product_name AS product_title
           FROM public.fact_search_keyword_daily f
           LEFT JOIN public.dim_shop s ON s.id = f.shop_id
           LEFT JOIN public.system_platform_configs p ON p.platform_code = f.platform_code
           LEFT JOIN public.dim_product dp ON dp.id = f.product_id
           WHERE f.biz_date >= $1::date AND f.biz_date <= $2::date ${filterSql}
           ORDER BY f.search_gmv DESC, f.search_rank ASC, f.impressions DESC`,
          params,
        )

        const totalKeywords = new Set(items.map((r) => `${r.platform_code}:${r.keyword}`)).size
        const totalImpressions = items.reduce((a, r) => a + Number(r.impressions || 0), 0)
        const totalClicks = items.reduce((a, r) => a + Number(r.clicks || 0), 0)
        const totalOrders = items.reduce((a, r) => a + Number(r.orders || 0), 0)
        const totalSearchGmv = items.reduce((a, r) => a + Number(r.search_gmv || 0), 0)
        const topRankCount = items.filter((r) => Number(r.search_rank || 99) <= 5).length
        const avgRank = items.length > 0
          ? Number((items.reduce((a, r) => a + Number(r.search_rank || 0), 0) / items.length).toFixed(1))
          : 0
        const avgCvr = totalClicks > 0 ? Number(((totalOrders / totalClicks) * 100).toFixed(2)) : 0

        // 小红书笔记搜索词数组同步检索（仅展示当前登录人可见店铺的笔记）
        let xhsNotes: any[] = []
        if (!platform || platform === 'xiaohongshu') {
          const xhsParams: any[] = [fromDate, toDate]
          let xhsWhere = ''
          if (shopId) {
            xhsParams.push(Number(shopId))
            xhsWhere += ` AND n.shop_id = $${xhsParams.length}`
          }
          if (q && q.trim()) {
            xhsParams.push(`%${q.trim()}%`)
            xhsWhere += ` AND (n.title ILIKE $${xhsParams.length} OR array_to_string(n.search_keywords, ',') ILIKE $${xhsParams.length})`
          }
          const xhsRes = await client.query(
            `SELECT n.id, n.biz_date, n.shop_id, s.shop_name, n.note_id, n.title,
                    n.search_impressions, n.recommend_impressions,
                    COALESCE(n.search_keywords, '{}'::text[]) AS search_keywords,
                    n.onsite_gmv, n.offsite_gmv
             FROM public.xhs_note n
             JOIN public.dim_shop s ON s.id = n.shop_id
             WHERE n.biz_date >= $1::date AND n.biz_date <= $2::date ${xhsWhere}
             ORDER BY n.search_impressions DESC, n.biz_date DESC
             LIMIT 30`,
            xhsParams,
          )
          xhsNotes = xhsRes.rows
        }

        return {
          range: { from: fromDate, to: toDate },
          summary: {
            total_keywords: totalKeywords,
            total_impressions: totalImpressions,
            total_clicks: totalClicks,
            total_orders: totalOrders,
            total_search_gmv: Number(totalSearchGmv.toFixed(2)),
            top_rank_count: topRankCount,
            avg_rank: avgRank,
            avg_cvr: avgCvr,
          },
          items,
          xhsNotes,
        }
      })

      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'search-keywords query failed')
      return sendError(reply, 500, '查询搜索关键词卡位数据失败')
    }
  })

  // ── POST /api/v1/search-keywords ── 录入/更新搜索关键词卡位，并联动同步小红书笔记词包
  app.post<{
    Body: {
      platformCode: string
      shopId: number
      bizDate: string
      keyword: string
      productId?: number | null
      skuCode?: string
      noteId?: string
      impressions?: number
      clicks?: number
      searchRank?: number
      searchSharePct?: number
      orders?: number
      searchGmv?: number
      cvr?: number
      source?: string
    }
  }>('/api/v1/search-keywords', { preHandler: [requireRole(SEARCH_WRITE_ROLES)] }, async (request, reply) => {
    const b = request.body || ({} as any)
    const keyword = String(b.keyword || '').trim()
    if (!b.platformCode || !b.shopId || !b.bizDate || !keyword) {
      return sendError(reply, 400, '缺少必要参数 (platformCode, shopId, bizDate, keyword)')
    }

    try {
      const outcome = await withRlsContext(request, async (client, scope) => {
        const shopCheck = await assertShopPlatform(client, b.shopId, b.platformCode)
        if (!shopCheck.ok) {
          return { error: { code: shopCheck.statusCode || 400, msg: shopCheck.message || '店铺校验失败' } }
        }

        const clicks = Number(b.clicks || 0)
        const orders = Number(b.orders || 0)
        const cvr =
          b.cvr !== undefined ? Number(b.cvr) : clicks > 0 ? Number(((orders / clicks) * 100).toFixed(2)) : 0

        const { rows } = await client.query(
          `INSERT INTO public.fact_search_keyword_daily
             (tenant_id, platform_code, shop_id, biz_date, keyword, product_id, sku_code, note_id,
              impressions, clicks, search_rank, search_share_pct, orders, search_gmv, cvr, source)
           VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT (tenant_id, platform_code, shop_id, biz_date, keyword) DO UPDATE SET
             product_id = COALESCE(EXCLUDED.product_id, public.fact_search_keyword_daily.product_id),
             sku_code = EXCLUDED.sku_code,
             note_id = EXCLUDED.note_id,
             impressions = EXCLUDED.impressions,
             clicks = EXCLUDED.clicks,
             search_rank = EXCLUDED.search_rank,
             search_share_pct = EXCLUDED.search_share_pct,
             orders = EXCLUDED.orders,
             search_gmv = EXCLUDED.search_gmv,
             cvr = EXCLUDED.cvr,
             source = EXCLUDED.source
           RETURNING *`,
          [
            scope.tenantId,
            b.platformCode,
            Number(b.shopId),
            b.bizDate,
            keyword,
            b.productId ? Number(b.productId) : null,
            b.skuCode || '',
            b.noteId || '',
            Number(b.impressions || 0),
            clicks,
            Number(b.searchRank ?? 99),
            Number(b.searchSharePct || 0),
            orders,
            Number(b.searchGmv || 0),
            cvr,
            b.source || 'manual',
          ],
        )

        // 若绑定了小红书笔记 ID，自动把关键词写入 xhs_note.search_keywords 数组避免丢失归因标签
        if (b.platformCode === 'xiaohongshu' && b.noteId) {
          await client.query(
            `UPDATE public.xhs_note
             SET search_keywords = (
               SELECT ARRAY(SELECT DISTINCT k FROM unnest(COALESCE(search_keywords, '{}'::text[]) || ARRAY[$1::text]) AS k)
             )
             WHERE shop_id = $2 AND note_id = $3`,
            [keyword, Number(b.shopId), b.noteId],
          )
        }

        await writeAuditLog(client, {
          request,
          action: 'search_keyword.upsert',
          resourceType: 'fact_search_keyword_daily',
          resourceId: rows[0].id,
          afterData: rows[0],
        })

        return { row: rows[0] }
      })

      if ('error' in outcome && outcome.error) {
        return sendError(reply, outcome.error.code, outcome.error.msg)
      }
      return sendOk(reply, outcome.row, '搜索词卡位记录已保存')
    } catch (err) {
      request.log.warn({ err }, 'search-keywords upsert failed')
      return sendError(reply, 500, '保存搜索关键词卡位失败')
    }
  })
}
