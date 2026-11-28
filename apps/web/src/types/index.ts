export type Theme = 'dark' | 'light'

export interface NavItem {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  href?: string
  children?: NavSubItem[]
  module?: string
  /** 多个模块任意命中即放行（与 route-manifest 的 anyModules 对齐） */
  anyModules?: string[]
}

export interface NavSubItem {
  label: string
  href: string
  module?: string
  anyModules?: string[]
}

export interface NavSection {
  title: string
  items: NavItem[]
  defaultCollapsed?: boolean
}

export interface StatCardData {
  id: string
  label: string
  value: string
  change: number
  changeLabel: string
  icon: React.ComponentType<{ className?: string }>
  color: 'primary' | 'accent' | 'success' | 'warning'
  sparkData: { value: number }[]
}

export interface Transaction {
  id: string
  customer: string
  email: string
  avatar?: string
  initials: string
  date: string
  type: string
  amount: number
  status: 'completed' | 'pending' | 'failed' | 'refunded'
}

export interface Contact {
  id: string
  name: string
  email: string
  phone: string
  company: string
  role: string
  status: 'active' | 'inactive' | 'prospect'
  avatar?: string
  initials: string
  location: string
  lastActivity: string
  tags: string[]
  deals: number
  value: number
}

export interface Invoice {
  id: string
  number: string
  date: string
  dueDate: string
  description: string
  amount: number
  status: 'paid' | 'pending' | 'overdue' | 'draft'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface Conversation {
  id: string
  title: string
  lastMessage: string
  timestamp: string
  unread?: boolean
  ownerName?: string
}

export interface PipelineDeal {
  id: string
  title: string
  company: string
  contact: string
  value: number
  stage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'
  probability: number
  closeDate: string
  initials: string
}

// ─── 业务通用类型 ───
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  perPage: number
  lastPage: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

// ─── 场次管理 ───
export interface Session {
  id: string
  title: string
  anchor: string
  startTime: string
  endTime: string
  status: 'scheduled' | 'live' | 'ended' | 'cancelled'
  revenue: number
  viewers: number
  products: number
}

// ─── 主播 ───
export interface Anchor {
  id: string
  name: string
  avatar?: string
  status: 'active' | 'inactive' | 'training'
  followers: number
  avgViewers: number
  conversionRate: number
  revenue: number
  skills: string[]
}

// ─── 数据质量 ───
export interface DataQualityReport {
  id: string
  tableName: string
  totalRows: number
  errorRows: number
  errorRate: number
  lastChecked: string
  issues: string[]
}

// ─── BI 仪表盘指标 ───
export interface KpiMetric {
  label: string
  value: number
  change: number        // 百分比变化
  changeLabel: string   // "较上月" / "较上周"
  trend: 'up' | 'down' | 'flat'
}

// ─── 退款分析 ───
export interface RefundRecord {
  id: string
  orderId: string
  amount: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  anchor: string
}

// ─── 异常检测 ───
export interface AnomalyEvent {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  detectedAt: string
  status: 'open' | 'acknowledged' | 'resolved'
}

// ─── 系统配置 ───
export interface SystemConfig {
  key: string
  value: string
  description: string
  group: string
  updatedAt: string
}



// ─── 账号管理 ───
export interface UserAccount {
  id: number
  username: string
  realName: string
  role: string
  roleName: string
  roomIds?: number[]
  roomNames?: string[]
  status: number
  lastLogin: string | null
  createdAt: string
  modules?: string[]
}

export interface RoleInfo {
  code: string
  name: string
  description: string
  modules: string[]
}

export interface ModuleInfo {
  code: string
  name: string
  icon: string
  sort_order: number
  assigned_roles?: string[]
  /** 是否启用（模块热插拔） */
  is_enabled?: boolean
  /** 是否核心模块（核心模块不可关闭） */
  is_core?: boolean
}

export interface LiveRoom {
  id: number
  name: string
  platform: string
  status: string
  created_at: string
  updated_at?: string
}

// ─── 人员管理 ───
export interface PersonnelItem {
  id: number
  name: string
  type: 'anchor' | 'operator' | 'manager'
  employeeId?: string
  platform?: string
  status: number
  createdAt: string
}

// ─── 多平台与店铺 ───
export interface ShopInfo {
  id: number
  name: string
  status: string
  authStatus: string
}

export interface PlatformCapabilities {
  supportsLive: boolean
  supportsShelf: boolean
  supportsContent: boolean
  supportsAds: boolean
  supportsAutoSync: boolean
  supportsManualUpload: boolean
  availableMetrics: string[]
  supportedModules: string[]
}

export interface PlatformInfo {
  platform_code: string
  platform_name: string
  category: 'live' | 'shelf' | 'content'
  is_enabled: boolean
  sort_order: number
  icon?: string
  api_config?: Record<string, any>
  shops: ShopInfo[]
  isPermitted: boolean
  capabilities: PlatformCapabilities | null
}


