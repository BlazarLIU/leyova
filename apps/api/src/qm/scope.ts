export type ScopeType = 'user' | 'room' | 'role' | 'org'

export interface ScopeContext {
  scopeType: ScopeType
  scopeId: string
  userId: number
  roomScope: number[]
  role: string
}

export function isScopeAllowed(allowed: ScopeType[], scopeType: ScopeType): boolean {
  return allowed.includes(scopeType)
}

export function canAccessScope(userScopes: ScopeContext, target: ScopeContext): boolean {
  if (userScopes.scopeType === 'org') return true
  if (target.scopeType === 'user') return target.userId === userScopes.userId
  if (target.scopeType === 'room') return userScopes.roomScope.includes(Number(target.scopeId.replace(/\D+/g, '')))
  if (target.scopeType === 'role') return target.role === userScopes.role
  return false
}
