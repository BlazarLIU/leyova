import 'dotenv/config'
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

function parseAuth(req: IncomingMessage): { userId: number; role: string; scopeType: string; scopeId: string } | null {
  const userId = parseInt(req.headers['x-yon-user-id'] as string, 10)
  const role = (req.headers['x-yon-role'] as string) || 'viewer'
  const scopeType = (req.headers['x-yon-scope-type'] as string) || 'user'
  const scopeId = (req.headers['x-yon-scope-id'] as string) || `user:${userId}`
  if (!userId) return null
  return { userId, role, scopeType, scopeId }
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
    const auth = parseAuth(req)
    if (!auth) return sendJSON(res, 401, { error: 'Missing X-Yon-User-Id header' })

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

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[yon-mcp-server] listening on http://127.0.0.1:${PORT}`)
  console.log(`[yon-mcp-server] ${listTools().length} tools registered`)
})
