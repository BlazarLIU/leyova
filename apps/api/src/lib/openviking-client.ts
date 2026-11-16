/**
 * OpenViking client — real implementation.
 *
 * Uses the OpenViking Server HTTP API (default port 1933).
 * Docs: https://docs.openviking.ai/en/api/01-overview
 *
 * Key endpoints used:
 * - POST /api/v1/search/search (mode="context") — assembled memory retrieval
 * - POST /api/v1/content/write — write memory content
 * - POST /api/v1/sessions — create session
 * - POST /api/v1/sessions/{id}/messages — add message to session
 * - POST /api/v1/sessions/{id}/commit — archive session and extract memory
 */

import { env } from '../config/env.js'
import type { AiScopeContext } from './ai-types.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OvSearchResult {
  entries: Array<{
    uri: string
    category: string
    score: number
    detail: string
    text: string
    origin: string
  }>
  rendered: string
  digest: string
  stats: Record<string, unknown>
}

interface OvSession {
  session_id: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isEnabled(): boolean {
  return !!env.OPENVIKING_API_BASE && !!env.OPENVIKING_API_KEY
}

function headers(scope?: AiScopeContext): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.OPENVIKING_API_KEY}`,
  }
  if (scope) {
    h['X-OpenViking-Account'] = scope.openvikingAccount || 'leyova'
    h['X-OpenViking-User'] = scope.openvikingUser || `leyova_${scope.userId}`
  }
  return h
}

async function ovFetch<T>(
  path: string,
  body: Record<string, unknown>,
  scope?: AiScopeContext
): Promise<T | null> {
  if (!isEnabled()) return null

  const res = await fetch(`${env.OPENVIKING_API_BASE}${path}`, {
    method: 'POST',
    headers: headers(scope),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.warn(`[openviking] ${path} returned ${res.status}: ${text.slice(0, 200)}`)
    return null
  }

  const data = await res.json() as { status: string; result?: T; error?: { message: string } }
  if (data.status !== 'ok' || !data.result) {
    console.warn(`[openviking] ${path} error:`, data.error?.message)
    return null
  }
  return data.result
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search agent memory / context using the context-assembly face.
 *
 * Returns a ready-to-inject context block string, or null if
 * OpenViking is not configured or returned no results.
 */
export async function searchMemory(
  query: string,
  scope: AiScopeContext
): Promise<string | null> {
  const result = await ovFetch<OvSearchResult>(
    '/api/v1/search/search',
    {
      query,
      mode: 'context',
      max_tokens: 1600,
      purpose: 'chat',
      context_type: ['memory'],
    },
    scope
  )

  if (!result) return null
  if (result.rendered && result.rendered.trim()) return result.rendered
  if (result.entries && result.entries.length > 0) {
    return result.entries
      .map((e) => `[${e.category}] ${e.text}`)
      .join('\n\n')
  }
  return null
}

/**
 * Write a memory entry to OpenViking.
 *
 * Uses the content write API to persist text under the user's memory
 * namespace, creating the file if it doesn't exist.
 */
export async function writeMemory(
  content: string,
  scope: AiScopeContext,
  category = 'events'
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  const user = scope.openvikingUser || `leyova_${scope.userId}`
  const uri = `viking://user/${user}/memories/${category}/${today}/${Date.now()}.md`

  await ovFetch(
    '/api/v1/content/write',
    {
      uri,
      content,
      mode: 'create',
      wait: false,
    },
    scope
  )
}

/**
 * Create an OpenViking session for a conversation.
 */
export async function createSession(
  scope: AiScopeContext,
  title?: string
): Promise<string | null> {
  const result = await ovFetch<OvSession>(
    '/api/v1/sessions',
    {
      title: title || `leyova-conv-${scope.userId}`,
      config: {},
    },
    scope
  )
  return result?.session_id ?? null
}

/**
 * Add a message to an OpenViking session.
 */
export async function addSessionMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  scope: AiScopeContext
): Promise<void> {
  await ovFetch(
    `/api/v1/sessions/${sessionId}/messages`,
    { role, content },
    scope
  )
}

/**
 * Commit a session to extract and persist memory.
 */
export async function commitSession(
  sessionId: string,
  scope: AiScopeContext
): Promise<void> {
  await ovFetch(
    `/api/v1/sessions/${sessionId}/commit`,
    {},
    scope
  )
}

/**
 * Check OpenViking health.
 */
export async function checkHealth(): Promise<boolean> {
  if (!isEnabled()) return false
  try {
    const res = await fetch(`${env.OPENVIKING_API_BASE}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}
