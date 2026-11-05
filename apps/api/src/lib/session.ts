// 废弃 - 已迁移至基于数据库的认证 (routes/auth.ts + guard.ts)
// 此文件保留仅为防止引用报错，所有功能均已失效

export interface SessionUser {
  id: string
  username: string
  realName: string
  role: string
}

const sessions = new Map<string, SessionUser>()

export function loginUser(_username: string, _password: string) {
  return null
}

export function logoutUser(_token?: string) {
  return false
}

export function getUserFromToken(_token?: string) {
  return null
}

export function getUsers(): SessionUser[] {
  return []
}
