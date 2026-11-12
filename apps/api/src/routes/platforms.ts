import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { getUserAllowedPlatforms, requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { platformRegistry } from '../platform/index.js'
import { governancePlatformRegistry } from '../modules/data-governance/adapters/index.js'
import { decryptCredential, encryptCredential, maskCredential } from '../modules/data-governance/security.js'

function redactShopForAudit(row: any) {
  if (!row) return null
  return {
    id: row.id,
    platform_code: row.platform_code,
    shop_name: row.shop_name,
    auth_status: row.auth_status,
    hasTokenInfo: Boolean(row.auth_token_info?.accessToken),
  }
}

export async function platformRoutes(app: FastifyInstance) {
  // ── GET /api/v1/platforms ── 获取所有平台列表（含全局开关、能力声明与权限状态）
  app.get('/api/v1/platforms', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user

      const { permittedPlatforms, rows } = await withRlsContext(request, async (client) => {
        const permitted = await getUserAllowedPlatforms(client, user)
        const res = await client.query(`
          SELECT 
            p.platform_code, 
            p.platform_name, 
            p.category, 
            p.is_enabled, 
            p.sort_order, 
            p.icon,
            p.api_config,
            COALESCE(
              (SELECT json_agg(json_build_object(
                'id', s.id,
                'name', s.shop_name,
                'status', s.status,
                'authStatus', s.auth_status,
                'hasCredentials', (COALESCE(s.auth_token_info->>'accessToken', '') <> ''),
                'appKeyRaw', COALESCE(s.auth_token_info->>'appKey', ''),
                'authorizedAt', COALESCE(s.auth_token_info->>'authorizedAt', s.auth_token_info->>'updatedAt')
              ))
               FROM dim_shop s WHERE s.platform_code = p.platform_code AND s.status = 'active'),
              '[]'::json
            ) AS shops
          FROM system_platform_configs p
          ORDER BY p.sort_order ASC
        `)
        return { permittedPlatforms: permitted, rows: res.rows }
      })

      const result = rows.map((row: any) => {
        const capabilities = platformRegistry.getCapabilities(row.platform_code)
        const isPermitted = permittedPlatforms === null || permittedPlatforms.has(row.platform_code)
        const maskedShops = Array.isArray(row.shops)
          ? row.shops.map(({ appKeyRaw, ...shop }: any) => ({
              ...shop,
              appKeyMasked: appKeyRaw ? maskCredential(decryptCredential(String(appKeyRaw))) : '',
            }))
          : []
        return {
          ...row,
          shops: maskedShops,
          isPermitted,
          capabilities,
        }
      })

      return sendOk(reply, result)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch platforms')
      return sendError(reply, 500, '获取平台配置失败')
    }
  })

  // ── PUT /api/v1/platforms/:code ── 管理员开启/关闭特定平台
  app.put<{
    Params: { code: string }
    Body: { is_enabled?: boolean; sort_order?: number; api_config?: Record<string, any> }
  }>('/api/v1/platforms/:code', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    try {
      const { code } = request.params
      const { is_enabled, sort_order, api_config } = request.body || {}

      const updates: string[] = []
      const values: any[] = [code]
      let idx = 2

      if (typeof is_enabled === 'boolean') {
        updates.push(`is_enabled = $${idx++}`)
        values.push(is_enabled)
      }
      if (typeof sort_order === 'number') {
        updates.push(`sort_order = $${idx++}`)
        values.push(sort_order)
      }
      if (api_config && typeof api_config === 'object') {
        updates.push(`api_config = $${idx++}`)
        values.push(JSON.stringify(api_config))
      }

      if (updates.length === 0) {
        return sendError(reply, 400, '缺少更新字段')
      }

      updates.push(`updated_at = now()`)

      const sql = `
        UPDATE system_platform_configs
        SET ${updates.join(', ')}
        WHERE platform_code = $1
        RETURNING *
      `

      const outcome = await withRlsContext(request, async (client) => {
        const beforeRes = await client.query('SELECT * FROM system_platform_configs WHERE platform_code = $1', [code])
        if (beforeRes.rows.length === 0) return { notFound: true as const }

        const { rows } = await client.query(sql, values)
        await writeAuditLog(client, {
          request,
          action: 'platform.config.update',
          resourceType: 'system_platform_configs',
          resourceId: code,
          beforeData: beforeRes.rows[0],
          afterData: rows[0],
        })
        return { notFound: false as const, row: rows[0] }
      })
      if (outcome.notFound) {
        return sendError(reply, 404, '平台不存在')
      }

      return sendOk(reply, outcome.row, '平台配置更新成功')
    } catch (err) {
      request.log.error({ err }, 'Failed to update platform config')
      return sendError(reply, 500, '更新平台配置失败')
    }
  })

  // ── GET /api/v1/platforms/:code/shops ── 获取某平台下有效店铺列表
  app.get<{
    Params: { code: string }
  }>('/api/v1/platforms/:code/shops', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { code } = request.params
      const { rows } = await withRlsContext(request, (client) =>
        client.query(`
          SELECT id, platform_code, shop_name, external_shop_id, status, auth_status, extra, created_at
          FROM dim_shop
          WHERE platform_code = $1 AND status = 'active'
          ORDER BY id ASC
        `, [code])
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch shops')
      return sendError(reply, 500, '获取店铺列表失败')
    }
  })

  // ── GET /api/v1/platforms/permissions ── 获取角色-平台权限矩阵
  app.get('/api/v1/platforms/permissions', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { rows } = await withRlsContext(request, (client) => client.query(`
        SELECT 
          rpp.id,
          rpp.role_id,
          r.code AS role_code,
          r.name AS role_name,
          rpp.platform_code,
          spc.platform_name,
          rpp.allowed_modules
        FROM role_platform_permissions rpp
        JOIN roles r ON r.id = rpp.role_id
        JOIN system_platform_configs spc ON spc.platform_code = rpp.platform_code
        ORDER BY r.id, spc.sort_order
      `))
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch platform permissions')
      return sendError(reply, 500, '获取平台权限矩阵失败')
    }
  })

  // ── PUT /api/v1/platforms/permissions ── 更新角色-平台权限
  app.put<{
    Body: {
      roleId: number
      platformCode: string
      isPermitted: boolean
      allowedModules?: string[]
    }
  }>('/api/v1/platforms/permissions', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    try {
      const actor = (request as any).user
      const { roleId, platformCode, isPermitted, allowedModules } = request.body || {}
      if (!roleId || !platformCode) {
        return sendError(reply, 400, '缺少必要参数 (roleId, platformCode)')
      }

      const outcome = await withRlsContext(request, async (client) => {
        const roleRes = await client.query('SELECT code FROM roles WHERE id = $1', [roleId])
        if (roleRes.rows.length === 0) return { error: { code: 404, msg: '目标角色不存在' } }
        if (roleRes.rows[0].code === 'super_admin' && actor.role !== 'super_admin') {
          return { error: { code: 403, msg: '仅系统超级管理员可调整 super_admin 平台权限' } }
        }

        const beforeRes = await client.query(
          'SELECT * FROM role_platform_permissions WHERE role_id = $1 AND platform_code = $2',
          [roleId, platformCode]
        )

        if (isPermitted) {
          await client.query(`
            INSERT INTO role_platform_permissions (role_id, platform_code, allowed_modules)
            VALUES ($1, $2, $3)
            ON CONFLICT (role_id, platform_code)
            DO UPDATE SET allowed_modules = EXCLUDED.allowed_modules
          `, [roleId, platformCode, allowedModules || []])
        } else {
          await client.query(`
            DELETE FROM role_platform_permissions
            WHERE role_id = $1 AND platform_code = $2
          `, [roleId, platformCode])
        }

        await writeAuditLog(client, {
          request,
          action: 'platform.permission.update',
          resourceType: 'role_platform_permissions',
          resourceId: `${roleId}:${platformCode}`,
          beforeData: beforeRes.rows[0] ?? null,
          afterData: { roleId, roleCode: roleRes.rows[0].code, platformCode, isPermitted, allowedModules: allowedModules || [] },
        })
        return { error: null }
      })
      if (outcome.error) {
        return sendError(reply, outcome.error.code, outcome.error.msg)
      }

      return sendOk(reply, { success: true }, '角色平台权限更新成功')
    } catch (err) {
      request.log.error({ err }, 'Failed to update platform permissions')
      return sendError(reply, 500, '更新角色平台权限失败')
    }
  })

  // ── GET /api/v1/platforms/:code/oauth/url ── 生成官方 OAuth 授权跳转地址
  app.get<{
    Params: { code: string }
    Querystring: { shopId?: string; redirectUri?: string; state?: string; appKey?: string }
  }>('/api/v1/platforms/:code/oauth/url', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    try {
      const { code } = request.params
      const adapter = governancePlatformRegistry.get(code)
      if (!adapter) return sendError(reply, 404, `未注册平台适配器: ${code}`)

      const shopId = request.query.shopId ? Number(request.query.shopId) : 0
      const credLookup = await withRlsContext(request, async (client) => {
        let key = ''
        let baseUrl: string | undefined

        if (shopId > 0) {
          const shopRes = await client.query(
            `SELECT auth_token_info FROM dim_shop WHERE id = $1 AND platform_code = $2`,
            [shopId, code],
          )
          if (shopRes.rows.length === 0) return { notFound: true as const }
          const info = shopRes.rows[0].auth_token_info || {}
          key = decryptCredential(String(info.appKey || ''))
          baseUrl = info.oauthBaseUrl
        }

        if (!key) {
          const cfgRes = await client.query(
            `SELECT api_config FROM system_platform_configs WHERE platform_code = $1`,
            [code],
          )
          const apiConfig = cfgRes.rows[0]?.api_config || {}
          key = decryptCredential(String(apiConfig.appKey || ''))
          if (!baseUrl && apiConfig.oauthBaseUrl) baseUrl = apiConfig.oauthBaseUrl
        }
        return { notFound: false as const, storedAppKey: key, oauthBaseUrl: baseUrl }
      })
      if (credLookup.notFound) return sendError(reply, 404, '店铺不存在或不属于该平台')
      const { storedAppKey, oauthBaseUrl } = credLookup

      const appKey = (request.query.appKey || storedAppKey || '').trim()
      if (!appKey || appKey.startsWith('mock_') || appKey.startsWith('demo_')) {
        return sendError(reply, 400, `平台 ${code} 尚未配置有效的官方 appKey，请先提供真实应用凭证`)
      }

      const redirectUri = request.query.redirectUri || `http://localhost:5513/api/v1/platforms/${code}/oauth/callback`
      const state = request.query.state || `${shopId}_${Date.now()}`
      const authorizeUrl = adapter.getOAuthUrl(
        { appKey, appSecret: '', shopId, platformCode: code, oauthBaseUrl },
        redirectUri,
        state,
      )

      return sendOk(reply, {
        platformCode: code,
        shopId: shopId || null,
        authorizeUrl,
        redirectUri,
        state,
      })
    } catch (err) {
      request.log.error({ err }, 'Failed to build OAuth URL')
      return sendError(reply, 500, '生成 OAuth 授权地址失败')
    }
  })

  // ── POST /api/v1/platforms/:code/oauth/callback ── 授权码换取 Token 并加密落库
  app.post<{
    Params: { code: string }
    Body: {
      shopId: number
      code: string
      appKey?: string
      appSecret?: string
      oauthBaseUrl?: string
      gatewayBaseUrl?: string
    }
  }>('/api/v1/platforms/:code/oauth/callback', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    try {
      const platformCode = request.params.code
      const adapter = governancePlatformRegistry.get(platformCode)
      if (!adapter) return sendError(reply, 404, `未注册平台适配器: ${platformCode}`)

      const { shopId, code: authCode, appKey: bodyKey, appSecret: bodySecret, oauthBaseUrl, gatewayBaseUrl } = request.body || {}
      if (!shopId || !authCode) {
        return sendError(reply, 400, '缺少必要参数 (shopId, code)')
      }

      const shopRes = await withRlsContext(request, (client) => client.query(
        `SELECT id, platform_code, shop_name, auth_status, auth_token_info FROM dim_shop WHERE id = $1 AND platform_code = $2`,
        [shopId, platformCode],
      ))
      if (shopRes.rows.length === 0) return sendError(reply, 404, '店铺不存在或不属于该平台')

      const beforeRow = shopRes.rows[0]
      const prevInfo = beforeRow.auth_token_info || {}
      const appKey = (bodyKey || decryptCredential(String(prevInfo.appKey || ''))).trim()
      const appSecret = (bodySecret || decryptCredential(String(prevInfo.appSecret || ''))).trim()
      if (!appKey || !appSecret || appKey.startsWith('mock_') || appKey.startsWith('demo_') || appSecret.startsWith('mock_') || appSecret.startsWith('demo_')) {
        return sendError(reply, 400, '缺少有效的生产级 appKey 或 appSecret，无法换取开放平台 Token')
      }

      const tokenBundle = await adapter.exchangeCodeForToken(
        {
          appKey,
          appSecret,
          shopId,
          platformCode,
          oauthBaseUrl: oauthBaseUrl || prevInfo.oauthBaseUrl,
          gatewayBaseUrl: gatewayBaseUrl || prevInfo.gatewayBaseUrl,
        },
        authCode,
      )

      const encryptedInfo = {
        ...prevInfo,
        appKey,
        appSecret: encryptCredential(appSecret),
        accessToken: encryptCredential(tokenBundle.accessToken),
        refreshToken: tokenBundle.refreshToken ? encryptCredential(tokenBundle.refreshToken) : undefined,
        expiresIn: tokenBundle.expiresIn,
        authorizedAt: new Date().toISOString(),
        ...(gatewayBaseUrl ? { gatewayBaseUrl } : {}),
        ...(oauthBaseUrl ? { oauthBaseUrl } : {}),
      }

      await withRlsContext(request, async (client) => {
        const updated = await client.query(
          `UPDATE dim_shop
              SET auth_status = 'authorized',
                  auth_token_info = $1::jsonb,
                  updated_at = now()
            WHERE id = $2
          RETURNING id, platform_code, shop_name, auth_status`,
          [JSON.stringify(encryptedInfo), shopId],
        )

        await writeAuditLog(client, {
          request,
          action: 'platform.shop.oauth_bind',
          resourceType: 'dim_shop',
          resourceId: String(shopId),
          beforeData: redactShopForAudit(beforeRow),
          afterData: {
            ...updated.rows[0],
            appKeyMasked: maskCredential(appKey),
            accessTokenMasked: maskCredential(tokenBundle.accessToken),
          },
        })
      })

      return sendOk(reply, {
        shopId,
        platformCode,
        authStatus: 'authorized',
        appKeyMasked: maskCredential(appKey),
        accessTokenMasked: maskCredential(tokenBundle.accessToken),
        expiresIn: tokenBundle.expiresIn,
      }, '开放平台 OAuth 授权绑定成功')
    } catch (err: any) {
      request.log.error({ err }, 'OAuth token exchange failed')
      return sendError(reply, 502, `OAuth 换取 Token 失败: ${err?.message || '未知错误'}`)
    }
  })

  // ── POST /api/v1/platforms/:code/shops/:shopId/credentials ── 加密绑定/更新店铺 API 凭证或切换授权状态
  app.post<{
    Params: { code: string; shopId: string }
    Body: {
      appKey?: string
      appSecret?: string
      accessToken?: string
      refreshToken?: string
      authStatus?: 'authorized' | 'unauthorized' | 'manual_only'
      gatewayBaseUrl?: string
      oauthBaseUrl?: string
    }
  }>('/api/v1/platforms/:code/shops/:shopId/credentials', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    try {
      const platformCode = request.params.code
      const shopId = Number(request.params.shopId)
      if (!Number.isInteger(shopId) || shopId <= 0) {
        return sendError(reply, 400, '无效的店铺 ID')
      }

      const adapter = governancePlatformRegistry.get(platformCode)
      if (!adapter) return sendError(reply, 404, `未注册平台适配器: ${platformCode}`)

      const body = request.body || {}
      const nextStatus = body.authStatus || 'authorized'

      const outcome = await withRlsContext(request, async (client) => {
        const shopRes = await client.query(
          `SELECT id, platform_code, shop_name, auth_status, auth_token_info FROM dim_shop WHERE id = $1 AND platform_code = $2`,
          [shopId, platformCode],
        )
        if (shopRes.rows.length === 0) return { error: { code: 404, msg: '店铺不存在或不属于该平台' } }

        const beforeRow = shopRes.rows[0]
        const prevInfo = beforeRow.auth_token_info || {}

        const plainKey = body.appKey !== undefined ? body.appKey.trim() : decryptCredential(String(prevInfo.appKey || ''))
        const plainSecret = body.appSecret !== undefined ? body.appSecret.trim() : decryptCredential(String(prevInfo.appSecret || ''))
        const plainToken = body.accessToken !== undefined ? body.accessToken.trim() : decryptCredential(String(prevInfo.accessToken || ''))
        const plainRefresh = body.refreshToken !== undefined ? body.refreshToken.trim() : decryptCredential(String(prevInfo.refreshToken || ''))

        const hasMock = [plainKey, plainSecret, plainToken].some((v) => v.startsWith('mock_') || v.startsWith('demo_'))
        if (nextStatus === 'authorized' && (!plainKey || !plainSecret || !plainToken || hasMock)) {
          return { error: { code: 400, msg: '启用 authorized 状态必须提供非占位的真实 appKey、appSecret 与 accessToken' } }
        }

        const encryptedInfo = nextStatus === 'manual_only'
          ? {}
          : {
              ...prevInfo,
              appKey: plainKey,
              appSecret: encryptCredential(plainSecret),
              accessToken: encryptCredential(plainToken),
              ...(plainRefresh ? { refreshToken: encryptCredential(plainRefresh) } : {}),
              ...(body.gatewayBaseUrl !== undefined ? { gatewayBaseUrl: body.gatewayBaseUrl } : {}),
              ...(body.oauthBaseUrl !== undefined ? { oauthBaseUrl: body.oauthBaseUrl } : {}),
              updatedAt: new Date().toISOString(),
            }

        const updated = await client.query(
          `UPDATE dim_shop
              SET auth_status = $1,
                  auth_token_info = $2::jsonb,
                  updated_at = now()
            WHERE id = $3
          RETURNING id, platform_code, shop_name, auth_status`,
          [nextStatus, JSON.stringify(encryptedInfo), shopId],
        )

        await writeAuditLog(client, {
          request,
          action: 'platform.shop.credentials.update',
          resourceType: 'dim_shop',
          resourceId: String(shopId),
          beforeData: redactShopForAudit(beforeRow),
          afterData: {
            ...updated.rows[0],
            appKeyMasked: plainKey ? maskCredential(plainKey) : '',
            accessTokenMasked: plainToken ? maskCredential(plainToken) : '',
          },
        })
        return { error: null, plainKey, plainToken }
      })
      if (outcome.error) return sendError(reply, outcome.error.code, outcome.error.msg)

      return sendOk(reply, {
        shopId,
        platformCode,
        authStatus: nextStatus,
        appKeyMasked: outcome.plainKey ? maskCredential(outcome.plainKey) : '',
        accessTokenMasked: outcome.plainToken ? maskCredential(outcome.plainToken) : '',
      }, '店铺 API 凭证状态更新成功')
    } catch (err) {
      request.log.error({ err }, 'Failed to update shop credentials')
      return sendError(reply, 500, '更新店铺凭证失败')
    }
  })
}

