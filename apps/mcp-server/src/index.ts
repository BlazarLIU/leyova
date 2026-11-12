import 'dotenv/config'
import crypto from 'node:crypto'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'

import './tools/live.js'
import './tools/anchor.js'
import './tools/product.js'
import './tools/review.js'
import './tools/bi.js'
import './tools/task.js'

import { listTools, executeTool, getToolSchemas } from './registry.js'
import { pool } from './db.js'
import type { ToolContext } from './types.js'

const PORT = parseInt(process.env.MCP_PORT || '9101', 10)

function sendJSON(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) })
  res.end(json)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb)
}

async function parseAuth(
  req: IncomingMessage
): Promise<{ userId: number; role: string; scopeType: string; scopeId: string } | { error: string; status: number }> {
  const configuredToken = process.env.LEYOVA_MCP_TOKEN || ''
  if (process.env.NODE_ENV === 'production' && !configuredToken) {
    return { status: 500, error: 'LEYOVA_MCP_TOKEN not configured' }
  }
  if (configuredToken) {
    const authHeader = String(req.headers.authorization || '')
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token || !timingSafeEqualStr(token, configuredToken)) {
      return { status: 401, error: 'Unauthorized' }
    }
  }

  const userId = parseInt(req.headers['x-leyova-user-id'] as string, 10)
  if (!Number.isInteger(userId) || userId <= 0) {
    return { status: 401, error: 'Missing or invalid X-Leyova-User-Id header' }
  }

  const sigHeader = String(req.headers['x-leyova-user-sig'] || '')
  const hmacSecret = process.env.LEYOVA_MCP_SIGNING_SECRET || configuredToken
  if ((process.env.LEYOVA_MCP_REQUIRE_SIG === 'true' || sigHeader) && hmacSecret) {
    const expected = crypto.createHmac('sha256', hmacSecret).update(`leyova-mcp-uid:${userId}`).digest('hex')
    if (!sigHeader || !timingSafeEqualStr(sigHeader.trim().toLowerCase(), expected)) {
      return { status: 403, error: 'Invalid or missing X-Leyova-User-Sig' }
    }
  }

  const { rows } = await pool.query<{ role: string }>('SELECT role FROM users WHERE id = $1 AND status = 1 LIMIT 1', [userId])
  if (rows.length === 0) {
    return { status: 401, error: 'Unknown or disabled user' }
  }

  const scopeType = (req.headers['x-leyova-scope-type'] as string) || 'user'
  const scopeId = (req.headers['x-leyova-scope-id'] as string) || `user:${userId}`
  return { userId, role: rows[0].role, scopeType, scopeId }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '', `http://localhost:${PORT}`)
  const path = url.pathname

  if (req.method === 'GET' && path === '/health') {
    return sendJSON(res, 200, { status: 'ok', tools: listTools().length })
  }

  if (req.method === 'GET' && path === '/tools') {
    return sendJSON(res, 200, { tools: getToolSchemas() })
  }

  if (req.method === 'POST' && path === '/tools/call') {
    const auth = await parseAuth(req)
    if ('error' in auth) return sendJSON(res, auth.status, { error: auth.error })

    const raw = await readBody(req)
    let body: { tool?: string; params?: unknown }
    try {
      body = JSON.parse(raw)
    } catch {
      return sendJSON(res, 400, { error: 'Invalid JSON body' })
    }

    const { tool, params } = body
    if (!tool) return sendJSON(res, 400, { error: 'Missing "tool" field' })

    const ctx: ToolContext = {
      userId: auth.userId,
      role: auth.role,
      scopeType: auth.scopeType,
      scopeId: auth.scopeId,
      pool,
    }

    const result = await executeTool(tool, params || {}, ctx)
    return sendJSON(res, result.ok ? 200 : 422, result)
  }

  return sendJSON(res, 404, { error: 'Not found' })
})

const HOST = process.env.MCP_HOST || '127.0.0.1'

server.listen(PORT, HOST, () => {
  console.log(`[leyova-mcp-server] listening on http://${HOST}:${PORT}`)
  console.log(`[leyova-mcp-server] ${listTools().length} tools registered`)
})
