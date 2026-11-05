import { z } from 'zod'
import type { Pool } from 'pg'

export type RiskLevel = 'read_only' | 'write_with_approval' | 'admin_only' | 'forbidden'

export interface ToolContext {
  userId: number
  role: string
  scopeType: string
  scopeId: string
  pool: Pool
}

export interface ToolDefinition<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string
  description: string
  inputSchema: S
  riskLevel: RiskLevel
  requiredPermission?: string
  execute: (params: z.infer<S>, ctx: ToolContext) => Promise<unknown>
}
