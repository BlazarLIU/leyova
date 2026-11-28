/**
 * wechat.ts — 视频号（微信小店）专属路由
 *
 * 填补审计发现的最大平台缺口：视频号此前 0 专属路由文件，
 * 所有能力只能复用通用页，无法体现「公私域混合 + 全域带货」的独特性。
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'
import { assertShopPlatform } from '../lib/shop-guard.js'
import {
  getWechatPrivatePublicSplit,
  getWechatAffiliateScenes,
  getWechatSettlement,
  getWechatContentTraffic,
} from '../platform/wechat-analytics.js'

function defaultRange(from?: string, to?: string) {
  const t = new Date()
  const toDate = to || t.toISOString().slice(0, 10)
  const f = from || (() => {
    const d = new Date(toDate)
    d.setDate(d.getDate() - 29)
    return d.toISOString().slice(0, 10)
  })()
  return { from: f, to: toDate }
}

export async function wechatRoutes(app: FastifyInstance) {
  // ── GET /api/v1/wechat/private-public ── 公私域拆分（视频号核心洞察）
  app.get<{ Querystring: { from?: string; to?: string; shopId?: string } }>(
    '/api/v1/wechat/private-public',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { from, to } = defaultRange(request.query.from, request.query.to)
      const shopId = request.query.shopId ? Number(request.query.shopId) : undefined
      try {
        const data = await withRlsContext(request, (client) =>
          getWechatPrivatePublicSplit(from, to, client, shopId),
        )
        return sendOk(reply, data)
      } catch (err) {
        request.log.warn({ err }, 'wechat/private-public failed')
        return sendError(reply, 500, '获取视频号公私域拆分失败')
      }
    },
  )

  // ── GET /api/v1/wechat/affiliate ── 全域带货场景拆分
  app.get<{ Querystring: { from?: string; to?: string; shopId?: string } }>(
    '/api/v1/wechat/affiliate',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { from, to } = defaultRange(request.query.from, request.query.to)
      const shopId = request.query.shopId ? Number(request.query.shopId) : undefined
      try {
        const data = await withRlsContext(request, (client) =>
          getWechatAffiliateScenes(from, to, client, shopId),
        )
        return sendOk(reply, data)
      } catch (err) {
        request.log.warn({ err }, 'wechat/affiliate failed')
        return sendError(reply, 500, '获取视频号全域带货数据失败')
      }
    },
  )

  // ── GET /api/v1/wechat/settlement ── 结算周期与资金占用（T+30 是视频号关键差异）
  app.get<{ Querystring: { from?: string; to?: string; shopId?: string } }>(
    '/api/v1/wechat/settlement',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { from, to } = defaultRange(request.query.from, request.query.to)
      const shopId = request.query.shopId ? Number(request.query.shopId) : undefined
      try {
        const data = await withRlsContext(request, (client) =>
          getWechatSettlement(from, to, client, shopId),
        )
        return sendOk(reply, data)
      } catch (err) {
        request.log.warn({ err }, 'wechat/settlement failed')
        return sendError(reply, 500, '获取视频号结算数据失败')
      }
    },
  )

  // ── GET /api/v1/wechat/content ── 内容场（短视频 + 公众号图文）
  app.get<{ Querystring: { from?: string; to?: string; shopId?: string } }>(
    '/api/v1/wechat/content',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { from, to } = defaultRange(request.query.from, request.query.to)
      const shopId = request.query.shopId ? Number(request.query.shopId) : undefined
      try {
        const data = await withRlsContext(request, (client) =>
          getWechatContentTraffic(from, to, client, shopId),
        )
        return sendOk(reply, data)
      } catch (err) {
        request.log.warn({ err }, 'wechat/content failed')
        return sendError(reply, 500, '获取视频号内容场数据失败')
      }
    },
  )

  // ── GET /api/v1/wechat/shop/:id/overview ── 单店总览（店铺维度）
  app.get<{ Params: { id: string }; Querystring: { from?: string; to?: string } }>(
    '/api/v1/wechat/shop/:id/overview',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (reply.sent) return
      const { from, to } = defaultRange(request.query.from, request.query.to)

      const result = await withRlsContext(request, async (client) => {
        const check = await assertShopPlatform(client, request.params.id, 'wechat')
        if (!check.ok || !check.shop) return { shopError: check }
        const shopId = check.shop.id

        const [split, settlement] = await Promise.all([
          getWechatPrivatePublicSplit(from, to, client, shopId),
          getWechatSettlement(from, to, client, shopId),
        ])

        return {
          data: {
            shop: { id: shopId, name: check.shop.shop_name },
            range: { from, to },
            privatePublic: split.summary,
            settlement: settlement.summary,
            channels: split.channels,
          },
        }
      })

      if ('shopError' in result && result.shopError) {
        return sendError(reply, result.shopError.statusCode || 400, result.shopError.message || '店铺校验失败')
      }
      return sendOk(reply, (result as any).data)
    },
  )
}
