export type ToolRisk = 'read_only' | 'write_with_approval' | 'admin_only' | 'forbidden'

export interface ToolPolicy {
  toolName: string
  riskLevel: ToolRisk
  minRole?: string
  requiresApproval?: boolean
}

export function requiresApproval(riskLevel: ToolRisk): boolean {
  return riskLevel === 'write_with_approval'
}

export function isForbidden(riskLevel: ToolRisk): boolean {
  return riskLevel === 'forbidden'
}
