import { getPool } from '../lib/db.js'

export async function writeAuditLog(params: {
  conversationId?: number
  actorUserId: number
  scopeType: string
  scopeId: string
  skillCode?: string
  toolName: string
  riskLevel: string
  inputPayload: unknown
  resultSummary: string
  approvalStatus?: string
  status: 'success' | 'failed' | 'rejected' | 'timeout'
  modelName?: string
}): Promise<void> {
  try {
    await getPool().query(
      `INSERT INTO ai_tool_logs
         (conversation_id, actor_user_id, scope_type, scope_id,
          skill_code, tool_name, risk_level, input_payload,
          result_summary, approval_status, status, model_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 'auto'), $11, $12)`,
      [
        params.conversationId ?? null,
        params.actorUserId,
        params.scopeType,
        params.scopeId,
        params.skillCode ?? null,
        params.toolName,
        params.riskLevel,
        JSON.stringify(params.inputPayload ?? {}),
        params.resultSummary,
        params.approvalStatus ?? 'auto',
        params.status,
        params.modelName ?? null,
      ]
    )
  } catch {
    // audit must be best-effort
  }
}
