import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Compass,
  ListOrdered,
  Layers,
  Calculator,
  GitBranch,
  ShieldAlert,
  Users,
  TrendingUp,
  Gauge,
  PieChart,
  LineChart,
  CalendarClock,
  Flame,
  Zap,
  Award,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Camera,
  ShieldCheck,
  Briefcase,
  FileCheck,
  Scale,
  Video,
  LayoutGrid,
  Target,
  Sparkles,
  Tag,
  Star,
  Plus,
  X,
  Upload,
  FileVideo,
  ImageIcon,
  Paperclip,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { useModuleParams } from '@/hooks/useModuleParams'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } }

// ── 数据契约类型 ──
interface Overview {
  totalActive: number
  byLevel: Array<{ level: string; n: number }>
  newbieLast30d: number
  profiles: { withProfile: number; withoutProfile: number }
  byPlatform: Array<{ platform: string; n: number }>
  fans: { total: number; avg: number }
}

interface Attendance {
  range: { days: number }
  totals: { sessions: number; totalMinutes: number; absent: number; idleAnchors: number; avgSessionsPerAnchor: number }
  anchors: Array<{ id: number; name: string; level: string; sessions: number; total_minutes: number; avg_minutes: number; absent: number; gmv: string }>
}

interface Performance {
  evaluatedCount: number
  dimensions: { expression: number | null; interaction: number | null; conversion: number | null; professionalism: number | null; overall: number | null }
  gmvBands: { top: number; mid: number; low: number; none: number }
  capabilities?: Array<{
    anchor_id: number
    name: string
    expression: number
    interaction: number
    conversion: number
    professionalism: number
    overall: number
    evaluated_at: string
  }>
}

interface EffSummary {
  range: { days: number }
  kpi: { totalGmv: number; totalHours: number; totalSessions: number; activeAnchors: number }
  efficiency: { gmvPerHour: number; gmvPerSession: number; gmvPerAnchor: number; hoursPerSession: number }
  costRatio: { anchorCostRatio: number; netEffectiveGmv: number }
  tiers: Array<{ tier: string; anchorCount: number; gmv: number; hours: number; gmvPerHour: number; gmvShare: number }>
  trend: Array<{ week: string; gmv: number; hours: number; gmvPerHour: number; activeAnchors: number }>
}

interface EffAnchorRow {
  id: number
  name: string
  level: string
  status: number
  sessions: number
  hours: number
  gmv: number
  gmvPerHour: number
  returnRate: number
  returnAmount: number
  netGmv: number
  hourlyGmv: number
  avgConversionRate: number | null
  avgViewerCount: number | null
  attendanceRate: number | null
  utilizationRate: number | null
}

interface EffUtilization {
  range: { days: number }
  totals: { assignedSessions: number; actualSessions: number; utilization: number | null; attendanceRate: number | null }
  anchors: Array<{
    id: number
    name: string
    level: string
    assignedSessions: number
    actualSessions: number
    hours: number
    utilization: number | null
    attendanceRate: number | null
    leaveDays: number
    restDays: number
  }>
}

interface EffGrowth {
  rampCurve: Array<{ nth: number; anchorCount: number; avgGmv: number; avgHours: number; avgConversion: number | null }>
  tiers: {
    S: { gmvShare: number; anchorCount: number; avgGmvPerHour: number }
    A: { gmvShare: number; anchorCount: number; avgGmvPerHour: number }
    B: { gmvShare: number; anchorCount: number; avgGmvPerHour: number }
    C: { gmvShare: number; anchorCount: number; avgGmvPerHour: number }
  }
}

interface EffRisk {
  range: { days: number }
  riskCount: number
  declining: Array<{ id: number; name: string; level: string; prevGmv: number; currGmv: number; dropRate: number }>
  zeroOutput: Array<{ id: number; name: string; level: string; lastSessionDate: string | null }>
  highAbsence: Array<{ id: number; name: string; leaveDays: number; restDays: number }>
}

// 试镜与招聘真实候选人数据类型
interface RealCandidate {
  id: number
  name: string
  phone: string
  target_category: string
  experience_years: number
  expected_salary: number
  source: string
  stage: 'resume_screening' | 'audition_scheduled' | 'trial_streaming' | 'offer_extended' | 'onboarded' | 'eliminated'
  eliminated_reason?: string
  anchor_id?: number
  created_at: string
  audition_id?: number
  audition_date?: string
  interviewer?: string
  camera_presence_score?: number
  vocal_clarity_score?: number
  sales_pitch_score?: number
  script_adaptability_score?: number
  rhythm_control_score?: number
  total_score?: number
  trial_gmv?: number
  trial_orders?: number
  audition_result?: string
  audition_comments?: string
  // 新增字段
  interview_time?: string
  past_categories?: string[]
  attachment_urls?: Array<{ name: string; url: string; type: 'video' | 'image' | 'file' }>
}

interface RecruitmentFunnel {
  resume_screening: number
  audition_scheduled: number
  trial_streaming: number
  offer_extended: number
  onboarded: number
  eliminated: number
  total: number
}

// 合约与合规确权类型
interface ContractRecord {
  id: number
  anchorName: string
  level: string
  contractType: '独家全职' | '矩阵合作' | '战略合伙'
  startDate: string
  endDate: string
  remainingDays: number
  boundAccount: string
  accountOwner: string
  nonCompeteMonths: number
  liquidatedDamages: string
  complianceStatus: 'normal' | 'renewing' | 'alert' | 'cooling'
  privateDomainRisk: '正常' | '待核实'
}

// 人才画像与九宫格盘点档案类型
interface AnchorPersona {
  id: number
  name: string
  level: string
  category: string
  platform: string
  experienceMonths: number
  age: number
  peakGmvRecord: string
  preferredShift: string
  followersAudience: {
    femaleRatio: number
    topAgeGroup: string
    cityTier: string
  }
  tags: string[]
  radar: {
    expression: number
    interaction: number
    conversion: number
    professionalism: number
    resilience: number
    overall: number
  }
  nineBox: {
    perf: 'high' | 'med' | 'low' // 绩效维度
    pot: 'high' | 'med' | 'low'  // 潜能维度
    boxName: string              // 格子名称: 超级明星 / 中流砥柱 / 潜力黑马 ...
    boxType: 'star' | 'performer' | 'potential' | 'core' | 'risk'
    actionPlan: string
  }
  hrbpAdvice: string
}

const fmtNum = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('zh-CN'))
const fmtWan = (n: number | null | undefined) => (n == null ? '—' : `${(Number(n) / 10000).toFixed(1)} 万`)
const fmtPct = (n: number | null | undefined) => (n == null ? '—' : `${Number(n).toFixed(1)}%`)

export type TabKey =
  | 'compass'
  | 'ranking'
  | 'cell'
  | 'incentive'
  | 'talent_review'
  | 'pipeline'
  | 'recruitment'
  | 'compliance'
  | 'risk_radar'

interface TabItem {
  key: TabKey
  label: string
  icon: any
  desc: string
  badge?: string
}

/** 9 大业务维度的 HRBP 完整闭环工作台中枢 */
const TABS: TabItem[] = [
  { key: 'compass', label: '经营人效罗盘', icon: Compass, desc: '单位经济、小时人效、薪效比与大盘走势', badge: '核心' },
  { key: 'ranking', label: '人效产能全景榜', icon: ListOrdered, desc: '主播产能、客单转化与退货率 10 列明细' },
  { key: 'cell', label: '作战单元协同', icon: Layers, desc: '直播间铁三角团队产出与工时利用率' },
  { key: 'incentive', label: '全岗分润精算', icon: Calculator, desc: '铁三角全岗激励模型与损益平衡模拟' },
  { key: 'talent_review', label: '人才画像与盘点', icon: LayoutGrid, desc: '九宫格人才盘点、标杆胜任力与画像卡片', badge: '盘点' },
  { key: 'pipeline', label: '主播梯队与培育', icon: GitBranch, desc: 'S/A/B/C金字塔、成长爬坡与带教进度' },
  { key: 'recruitment', label: '试镜与招聘漏斗', icon: Camera, desc: '人才供给池、声画镜头打分与试播实测', badge: '供给' },
  { key: 'compliance', label: '资产合约与法务', icon: ShieldCheck, desc: '官方主号确权、独家协议、竞业限制与防飞单', badge: '风控' },
  { key: 'risk_radar', label: '人效风险与预警', icon: ShieldAlert, desc: '业绩断崖熔断、零产出排查与行动闭环', badge: '预警' },
]

export function HrbpWorkspacePage({ defaultTab = 'compass' }: { defaultTab?: TabKey }) {
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as TabKey) || defaultTab
  const [tab, setTab] = useState<TabKey>(initialTab)

  // 基础数据
  const [overview, setOverview] = useState<Overview | null>(null)
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [performance, setPerformance] = useState<Performance | null>(null)

  // 人效数据
  const [effSummary, setEffSummary] = useState<EffSummary | null>(null)
  const [effAnchors, setEffAnchors] = useState<EffAnchorRow[]>([])
  const [effUtil, setEffUtil] = useState<EffUtilization | null>(null)
  const [effGrowth, setEffGrowth] = useState<EffGrowth | null>(null)
  const [effRisk, setEffRisk] = useState<EffRisk | null>(null)

  // 交互控制
  const [days, setDays] = useState(30)
  const [effSort, setEffSort] = useState('gmv')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // ── 联通系统运维模块参数中枢 ──
  const { params: hrbpModuleParams, resolvedHrbp } = useModuleParams('hrbp')

  // ── 全岗分润激励模拟器参数 ──
  const [baseSalary, setBaseSalary] = useState(6000)
  const [tier1Rate, setTier1Rate] = useState(2.0)
  const [tier2Rate, setTier2Rate] = useState(4.0)
  const [tier3Rate, setTier3Rate] = useState(6.0)
  const [adBuyerRate, setAdBuyerRate] = useState(0.8)
  const [adBuyerRoiTarget, setAdBuyerRoiTarget] = useState(3.2)
  const [adBuyerRoiActual, setAdBuyerRoiActual] = useState(3.6)
  const [operatorProfitShare, setOperatorProfitShare] = useState(8.0)
  const [controllerPerSession, setControllerPerSession] = useState(150)
  const [controllerBonus, setControllerBonus] = useState(500)
  const [selectedInspectAnchorId, setSelectedInspectAnchorId] = useState<number | null>(null)

  useEffect(() => {
    if (resolvedHrbp) {
      setBaseSalary(resolvedHrbp.baseSalary)
      setAdBuyerRate(resolvedHrbp.adBuyerRate)
      setAdBuyerRoiTarget(resolvedHrbp.adBuyerTargetRoi)
      setOperatorProfitShare(resolvedHrbp.operatorProfitShare)
      setControllerPerSession(resolvedHrbp.controllerPerSession)
      setControllerBonus(resolvedHrbp.controllerBonus)
      if (resolvedHrbp.commissionTiers.length >= 3) {
        setTier1Rate(resolvedHrbp.commissionTiers[0].rate)
        setTier2Rate(resolvedHrbp.commissionTiers[1].rate)
        setTier3Rate(resolvedHrbp.commissionTiers[2].rate)
      }
    }
  }, [resolvedHrbp])

  // ── 真实试镜与招聘供给池（PostgreSQL 事实表驱动） ──
  const [recruitmentList, setRecruitmentList] = useState<RealCandidate[]>([])
  const [recruitmentFunnel, setRecruitmentFunnel] = useState<RecruitmentFunnel>({
    resume_screening: 0,
    audition_scheduled: 0,
    trial_streaming: 0,
    offer_extended: 0,
    onboarded: 0,
    eliminated: 0,
    total: 0,
  })
  const [, setRecruitmentLoading] = useState(false)

  // 录入应聘候选人弹窗
  const [showCreateCandidateModal, setShowCreateCandidateModal] = useState(false)
  const [newCandidateForm, setNewCandidateForm] = useState({
    name: '',
    phone: '',
    targetCategory: '美妆护肤',
    experienceYears: '2.0',
    expectedSalary: '12000',
    source: 'BOSS直聘',
    // 新增字段
    interviewTime: '',
    pastCategories: [] as string[],
  })
  // 附件（视频 + 图片）本地文件列表
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 声画试镜打分弹窗
  const [showAuditionModal, setShowAuditionModal] = useState(false)
  const [auditionCandidate, setAuditionCandidate] = useState<RealCandidate | null>(null)
  const [auditionForm, setAuditionForm] = useState({
    cameraPresenceScore: 8.5,
    vocalClarityScore: 8.5,
    salesPitchScore: 8.0,
    scriptAdaptabilityScore: 8.0,
    rhythmControlScore: 8.0,
    trialGmv: 6500,
    trialOrders: 28,
    result: 'pass',
    comments: '五维表现优秀，镜头表现力与互动节奏好',
  })

  const fetchRecruitment = async () => {
    setRecruitmentLoading(true)
    try {
      const res = await api.get<{ candidates: RealCandidate[]; funnel: RecruitmentFunnel }>('/api/v1/hrbp/recruitment/candidates')
      if (res) {
        setRecruitmentList(res.candidates || [])
        if (res.funnel) setRecruitmentFunnel(res.funnel)
      }
    } catch (e) {
      console.warn('Failed to load recruitment data', e)
    } finally {
      setRecruitmentLoading(false)
    }
  }

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCandidateForm.name || !newCandidateForm.targetCategory) return
    try {
      await api.post('/api/v1/hrbp/recruitment/candidates', {
        name: newCandidateForm.name,
        phone: newCandidateForm.phone,
        targetCategory: newCandidateForm.targetCategory,
        experienceYears: Number(newCandidateForm.experienceYears) || 0,
        expectedSalary: Number(newCandidateForm.expectedSalary) || 0,
        source: newCandidateForm.source,
        interviewTime: newCandidateForm.interviewTime || null,
        pastCategories: newCandidateForm.pastCategories,
        // attachmentFiles 以 FormData 方式上传（前端本地预览存入 state，后续可扩展为 multipart）
        attachmentCount: attachmentFiles.length,
        attachmentNames: attachmentFiles.map((f) => f.name),
      })
      setShowCreateCandidateModal(false)
      setNewCandidateForm({
        name: '',
        phone: '',
        targetCategory: '美妆护肤',
        experienceYears: '2.0',
        expectedSalary: '12000',
        source: 'BOSS直聘',
        interviewTime: '',
        pastCategories: [],
      })
      setAttachmentFiles([])
      fetchRecruitment()
    } catch (err: any) {
      alert(err.message || '录入候选人失败')
    }
  }

  const handleOpenAudition = (cand: RealCandidate) => {
    setAuditionCandidate(cand)
    setAuditionForm({
      cameraPresenceScore: cand.camera_presence_score || 8.5,
      vocalClarityScore: cand.vocal_clarity_score || 8.5,
      salesPitchScore: cand.sales_pitch_score || 8.0,
      scriptAdaptabilityScore: cand.script_adaptability_score || 8.0,
      rhythmControlScore: cand.rhythm_control_score || 8.0,
      trialGmv: cand.trial_gmv || 6500,
      trialOrders: cand.trial_orders || 28,
      result: cand.audition_result || 'pass',
      comments: cand.audition_comments || '镜头表现力自然，过品节奏熟练',
    })
    setShowAuditionModal(true)
  }

  const handleSaveAudition = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auditionCandidate) return
    try {
      await api.post('/api/v1/hrbp/recruitment/auditions', {
        candidateId: auditionCandidate.id,
        interviewer: '李HRBP',
        ...auditionForm,
      })
      setShowAuditionModal(false)
      fetchRecruitment()
    } catch (err: any) {
      alert(err.message || '保存试镜打分失败')
    }
  }

  const handleOnboardCandidate = async (cand: RealCandidate) => {
    if (!confirm(`确认办理候选人【${cand.name}】转正入职？\n系统将自动在主播管理库中为其建立正式主播档案。`)) return
    try {
      const res = await api.post<any>(`/api/v1/hrbp/recruitment/candidates/${cand.id}/onboard`, {
        level: 'B',
        platform: 'douyin',
      })
      alert(res?.message || `已成功为【${cand.name}】办理转正入职！`)
      fetchRecruitment()
    } catch (err: any) {
      alert(err.message || '办理转正失败')
    }
  }

  // ── 合约与合规确权台账状态 ──
  const [contracts, setContracts] = useState<ContractRecord[]>([
    {
      id: 201,
      anchorName: '苏墨然',
      level: 'S',
      contractType: '独家全职',
      startDate: '2025-01-01',
      endDate: '2026-12-31',
      remainingDays: 43,
      boundAccount: '@旗舰店官方正品',
      accountOwner: '杭州乐优网络科技有限公司 (企业主体)',
      nonCompeteMonths: 12,
      liquidatedDamages: '¥ 10,000,000 或前12月佣金5倍',
      complianceStatus: 'renewing',
      privateDomainRisk: '正常',
    },
    {
      id: 202,
      anchorName: '楚云裳',
      level: 'S',
      contractType: '战略合伙',
      startDate: '2024-06-01',
      endDate: '2027-05-31',
      remainingDays: 560,
      boundAccount: '@主理人轻奢选品',
      accountOwner: '杭州乐优网络科技有限公司 (企业主体)',
      nonCompeteMonths: 24,
      liquidatedDamages: '¥ 20,000,000',
      complianceStatus: 'normal',
      privateDomainRisk: '正常',
    },
    {
      id: 203,
      anchorName: '陆子昂',
      level: 'A',
      contractType: '独家全职',
      startDate: '2025-03-01',
      endDate: '2027-02-28',
      remainingDays: 467,
      boundAccount: '@潮牌穿搭研习所',
      accountOwner: '杭州乐优网络科技有限公司 (企业主体)',
      nonCompeteMonths: 12,
      liquidatedDamages: '¥ 3,000,000',
      complianceStatus: 'normal',
      privateDomainRisk: '正常',
    },
    {
      id: 204,
      anchorName: '张晓雯',
      level: 'B',
      contractType: '矩阵合作',
      startDate: '2025-08-01',
      endDate: '2026-07-31',
      remainingDays: 255,
      boundAccount: '@乐优美妆精选03',
      accountOwner: '杭州乐优网络科技有限公司 (企业主体)',
      nonCompeteMonths: 6,
      liquidatedDamages: '¥ 1,000,000',
      complianceStatus: 'normal',
      privateDomainRisk: '正常',
    },
  ])

  // ── 人才画像与九宫格档案库状态 ──
  const [selectedPersonaId, setSelectedPersonaId] = useState<number>(301)
  const [personaCategoryFilter, setPersonaCategoryFilter] = useState<string>('all')

  const [anchorPersonas] = useState<AnchorPersona[]>([
    {
      id: 301,
      name: '苏墨然',
      level: 'S',
      category: '美妆护肤',
      platform: '抖音',
      experienceMonths: 36,
      age: 28,
      peakGmvRecord: '¥ 3,850,000 / 单场',
      preferredShift: '黄金晚间档 (19:30 - 23:30)',
      followersAudience: { femaleRatio: 86, topAgeGroup: '25-35岁 (68%)', cityTier: '新一线与二线城市' },
      tags: ['成份党专家', '高客单爆发', '反转憋单', '抗压控场', '超高复购'],
      radar: { expression: 9.5, interaction: 9.2, conversion: 9.8, professionalism: 9.6, resilience: 9.4, overall: 9.5 },
      nineBox: {
        perf: 'high',
        pot: 'high',
        boxName: '超级明星 (Star)',
        boxType: 'star',
        actionPlan: '战略合伙留任、配专属独立作战单元、打造全域顶流IP',
      },
      hrbpAdvice: '大盘核心营收支柱，需重点关注嗓音疲劳与精力管理，防范竞对高薪挖猎，已启动续约谈判。',
    },
    {
      id: 302,
      name: '楚云裳',
      level: 'S',
      category: '服装',
      platform: '抖音直播',
      experienceMonths: 42,
      age: 30,
      peakGmvRecord: '¥ 5,200,000 / 单场',
      preferredShift: '黄金晚间档 (20:00 - 00:30)',
      followersAudience: { femaleRatio: 92, topAgeGroup: '30-45岁 (74%)', cityTier: '一线与新一线城市' },
      tags: ['穿搭气场', '上新控场', '高频逼单', '客单价>800', '品牌联名'],
      radar: { expression: 9.7, interaction: 9.0, conversion: 9.6, professionalism: 9.4, resilience: 9.2, overall: 9.4 },
      nineBox: {
        perf: 'high',
        pot: 'high',
        boxName: '超级明星 (Star)',
        boxType: 'star',
        actionPlan: '独家合资工作室分润、专属面料设计师配置、长期保全协议',
      },
      hrbpAdvice: '高客单轻奢转化天花板，对选品设计要求极高，HRBP 协同商品供应链保障高品质首发货盘。',
    },
    {
      id: 303,
      name: '陆子昂',
      level: 'A',
      category: '服装',
      platform: '抖音',
      experienceMonths: 24,
      age: 26,
      peakGmvRecord: '¥ 1,450,000 / 单场',
      preferredShift: '下午放量档 (14:00 - 18:00)',
      followersAudience: { femaleRatio: 35, topAgeGroup: '18-30岁 (70%)', cityTier: '二三线城市' },
      tags: ['高频过款', '潮人穿搭', '快速放价', '活力互动', '运动潮流'],
      radar: { expression: 8.8, interaction: 9.1, conversion: 8.6, professionalism: 8.2, resilience: 8.5, overall: 8.6 },
      nineBox: {
        perf: 'high',
        pot: 'med',
        boxName: '中流砥柱 (High Performer)',
        boxType: 'performer',
        actionPlan: '维持稳定高产排班、避免连续通宵疲劳、适度阶梯提成激励',
      },
      hrbpAdvice: '执行力强且心态稳健，过款节奏快，是服装矩阵的核心压舱石，后续可辅导其提升高单价成衣溢价力。',
    },
    {
      id: 304,
      name: '赵子晴',
      level: 'A',
      category: '美妆护肤',
      platform: '抖音',
      experienceMonths: 8,
      age: 24,
      peakGmvRecord: '¥ 680,000 / 单场',
      preferredShift: '晨间平销档 (06:30 - 10:00)',
      followersAudience: { femaleRatio: 80, topAgeGroup: '18-25岁 (62%)', cityTier: '新一线与高校年轻圈' },
      tags: ['高颜值上镜', '仿妆达人', '亲和感染', '高互动率', '成长期新星'],
      radar: { expression: 9.0, interaction: 9.3, conversion: 8.2, professionalism: 8.4, resilience: 8.6, overall: 8.7 },
      nineBox: {
        perf: 'med',
        pot: 'high',
        boxName: '潜力黑马 (High Potential)',
        boxType: 'potential',
        actionPlan: '金牌教练 1v1 话术陪跑、测试导入晚间黄金档、梯队继任储备',
      },
      hrbpAdvice: '成长速度惊人，粉丝粘性与停留时长突出，欠缺大促爆发压迫感，建议安排 5 场大促黄金档副播实战。',
    },
    {
      id: 305,
      name: '张晓雯',
      level: 'B',
      category: '鞋箱包',
      platform: '抖音',
      experienceMonths: 16,
      age: 25,
      peakGmvRecord: '¥ 580,000 / 单场',
      preferredShift: '下午放量档 (13:30 - 17:30)',
      followersAudience: { femaleRatio: 78, topAgeGroup: '25-40岁 (65%)', cityTier: '二三线城市' },
      tags: ['真皮女包', '五金细节', '百搭潮鞋', '大促逼单', '收纳演示'],
      radar: { expression: 8.2, interaction: 8.0, conversion: 8.1, professionalism: 8.5, resilience: 8.2, overall: 8.2 },
      nineBox: {
        perf: 'med',
        pot: 'med',
        boxName: '核心骨干 (Core Contributor)',
        boxType: 'core',
        actionPlan: '鞋箱包矩阵平销主力轮播、强化皮料质感与收纳展示、控制退货率',
      },
      hrbpAdvice: '出勤稳定且鞋包专业度高，尤其擅长真皮材质与五金工艺讲解，是鞋箱包垂直矩阵的稳定压舱石。',
    },
    {
      id: 306,
      name: '陈诗曼',
      category: '食品生鲜',
      level: 'C',
      platform: '快手',
      experienceMonths: 2,
      age: 22,
      peakGmvRecord: '¥ 180,000 / 单场',
      preferredShift: '上午平销档 (09:00 - 12:30)',
      followersAudience: { femaleRatio: 58, topAgeGroup: '全年龄段 / 家庭主妇 (55%)', cityTier: '全国' },
      tags: ['吃播食欲', '市井烟火', '高声量', '亲民'],
      radar: { expression: 8.4, interaction: 8.0, conversion: 6.8, professionalism: 7.0, resilience: 7.5, overall: 7.5 },
      nineBox: {
        perf: 'low',
        pot: 'high',
        boxName: '待发掘 (Enigma / Dilemma)',
        boxType: 'potential',
        actionPlan: '诊断排查（选品匹配/机制优化）、话术专项特训、给10场观察期',
      },
      hrbpAdvice: '镜头感与吃播感染力强但放价逼单转化率低，属典型「叫好不叫座」，需编导现场协助优化 SKU 机制。',
    },
    {
      id: 307,
      name: '周怡',
      level: 'C',
      category: '3C数码',
      platform: '视频号',
      experienceMonths: 6,
      age: 23,
      peakGmvRecord: '¥ 120,000 / 单场',
      preferredShift: '下午数码放量档 (14:00 - 17:30)',
      followersAudience: { femaleRatio: 40, topAgeGroup: '20-40岁数码爱好者 (65%)', cityTier: '二三线城市' },
      tags: ['硬核数码', '智能穿戴', '参数拆解', '直男种草'],
      radar: { expression: 7.2, interaction: 7.0, conversion: 6.8, professionalism: 7.5, resilience: 7.0, overall: 7.1 },
      nineBox: {
        perf: 'low',
        pot: 'med',
        boxName: '需要辅导 (Underperformer)',
        boxType: 'risk',
        actionPlan: '下达 15 天 PIP 业绩改进计划、强化痛点提炼、复盘不达标转助播',
      },
      hrbpAdvice: '数码产品技术指标讲解熟稔，对横向参数对比极快，后续可加强大促放价促单的临场压迫感。',
    },
    {
      id: 308,
      name: '徐晨',
      level: 'C',
      category: '鞋箱包',
      platform: '抖音',
      experienceMonths: 1,
      age: 21,
      peakGmvRecord: '¥ 20,000 / 单场',
      preferredShift: '凌晨替补档',
      followersAudience: { femaleRatio: 50, topAgeGroup: '未定型', cityTier: '未定型' },
      tags: ['未开播', '占编闲置', '待汰换'],
      radar: { expression: 6.0, interaction: 5.8, conversion: 5.5, professionalism: 5.8, resilience: 6.2, overall: 5.9 },
      nineBox: {
        perf: 'low',
        pot: 'low',
        boxName: '不达标汰换 (Risk / Action)',
        boxType: 'risk',
        actionPlan: '敏捷汰换解约、释放固定底薪编制、或转岗幕后中控',
      },
      hrbpAdvice: '试用期内 0 产出，缺乏镜头表达自信，已启动试用期不符合录用条件的合规解约流程。',
    },
  ])

  // 行动项处置记录
  const [handledActions, setHandledActions] = useState<Record<string, boolean>>({})

  const toggleActionHandled = (actionKey: string) => {
    setHandledActions((prev) => ({ ...prev, [actionKey]: !prev[actionKey] }))
  }

  // 合规状态流转
  const toggleContractStatus = (id: number) => {
    setContracts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, complianceStatus: c.complianceStatus === 'renewing' ? 'normal' : 'renewing' } : c))
    )
  }

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const [ov, at, pf, es, ea, eu, eg, er] = await Promise.all([
        api.get<Overview>('/hrbp/overview'),
        api.get<Attendance>(`/hrbp/attendance?days=${days}`),
        api.get<Performance>('/hrbp/performance'),
        api.get<EffSummary>(`/hrbp/efficiency/summary`),
        api.get<{ totalGmv: number; anchors: EffAnchorRow[] }>(`/hrbp/efficiency/anchors?days=${days}&sort=${effSort}`),
        api.get<EffUtilization>(`/hrbp/efficiency/utilization?days=${days}`),
        api.get<EffGrowth>('/hrbp/efficiency/growth'),
        api.get<EffRisk>(`/hrbp/efficiency/risk?days=${days}`),
      ])
      setOverview(ov)
      setAttendance(at)
      setPerformance(pf)
      setEffSummary(es)
      setEffAnchors(ea?.anchors || [])
      setEffUtil(eu)
      setEffGrowth(eg)
      setEffRisk(er)
      fetchRecruitment()
    } catch (e: any) {
      setErr(e?.message || '加载 HRBP 经营数据失败')
    } finally {
      setLoading(false)
    }
  }, [days, effSort])

  useEffect(() => {
    load()
  }, [load])

  // 筛选后的排行榜
  const filteredAnchors = useMemo(() => {
    if (!searchQuery.trim()) return effAnchors
    return effAnchors.filter(
      (a) =>
        a.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        a.level.toLowerCase().includes(searchQuery.trim().toLowerCase())
    )
  }, [effAnchors, searchQuery])

  // 筛选后的人才画像列表
  const filteredPersonas = useMemo(() => {
    return anchorPersonas.filter((p) => {
      const matchCat = personaCategoryFilter === 'all' || p.category.includes(personaCategoryFilter)
      const matchSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(searchQuery.trim().toLowerCase()))
      return matchCat && matchSearch
    })
  }, [anchorPersonas, personaCategoryFilter, searchQuery])

  // 当前选中的主播画像
  const activePersona = useMemo(() => {
    return anchorPersonas.find((p) => p.id === selectedPersonaId) || anchorPersonas[0]
  }, [anchorPersonas, selectedPersonaId])

  // ── 铁三角全岗激励精算模型推演 ──
  const commissionSim = useMemo(() => {
    const totalGmv = effSummary?.kpi.totalGmv || 0
    const anchorCount = effAnchors.length || 1
    const totalBaseSalary = anchorCount * baseSalary

    let totalCommission = 0
    let totalNetGmv = 0
    effAnchors.forEach((a) => {
      const netGmv = Math.max(0, a.gmv - (a.returnAmount || 0))
      totalNetGmv += netGmv

      // 1. 优先检查该主播是否在系统参数中配置了 L3 个人专属覆盖
      const override = hrbpModuleParams?.find(
        (p) => p.scope_type === 'entity' && p.scope_id === `anchor:${a.id}`
      )
      if (override && override.param_value) {
        const val = override.param_value
        if (val.commission_mode === 'flat') {
          totalCommission += (netGmv * (Number(val.rate) || 0)) / 100
        } else if (Array.isArray(val.tiers)) {
          let rem = netGmv / 10000
          let prev = 0
          for (const t of val.tiers) {
            const cap = t.max_gmv - prev
            const g = Math.min(rem, cap)
            if (g > 0) {
              totalCommission += (g * 10000 * (t.rate / 100))
              rem -= g
            }
            prev = t.max_gmv
            if (rem <= 0) break
          }
        }
      } else {
        // 2. 检查该主播的等级基准 (S / A / B / C)
        const tierRule = hrbpModuleParams?.find(
          (p) => p.scope_type === 'tier' && p.scope_id?.toUpperCase() === (a.level || 'A').toUpperCase()
        )
        if (tierRule && tierRule.param_value && Array.isArray(tierRule.param_value.tiers)) {
          let rem = netGmv / 10000
          let prev = 0
          for (const t of tierRule.param_value.tiers) {
            const cap = t.max_gmv - prev
            const g = Math.min(rem, cap)
            if (g > 0) {
              totalCommission += (g * 10000 * (t.rate / 100))
              rem -= g
            }
            prev = t.max_gmv
            if (rem <= 0) break
          }
        } else {
          // 3. 兜底通用阶梯
          let rate = tier1Rate
          if (a.gmv > 800000) rate = tier3Rate
          else if (a.gmv > 400000) rate = tier2Rate
          totalCommission += (netGmv * rate) / 100
        }
      }
    })

    const adSpendEst = totalNetGmv * 0.25
    const roiMultiplier = adBuyerRoiActual >= adBuyerRoiTarget ? 1.25 : 0.75
    const totalAdBuyerBonus = (adSpendEst * (adBuyerRate / 100)) * roiMultiplier

    const estNetProfit = totalNetGmv * 0.15
    const totalOperatorBonus = (estNetProfit * operatorProfitShare) / 100

    const totalSessions = effSummary?.kpi.totalSessions || 45
    const controllerCount = Math.max(2, Math.round(anchorCount * 0.4))
    const totalControllerBonus = totalSessions * controllerPerSession + controllerCount * controllerBonus

    const totalStaffCost = totalBaseSalary + totalCommission + totalAdBuyerBonus + totalOperatorBonus + totalControllerBonus
    const staffCostRatio = totalGmv > 0 ? (totalStaffCost / totalGmv) * 100 : 0

    return {
      totalBaseSalary,
      totalCommission,
      totalAdBuyerBonus,
      totalOperatorBonus,
      totalControllerBonus,
      totalStaffCost,
      staffCostRatio,
      avgAnchorPayout: anchorCount > 0 ? (totalBaseSalary + totalCommission) / anchorCount : 0,
      shares: {
        anchor: totalStaffCost > 0 ? ((totalBaseSalary + totalCommission) / totalStaffCost) * 100 : 55,
        operator: totalStaffCost > 0 ? (totalOperatorBonus / totalStaffCost) * 100 : 20,
        adBuyer: totalStaffCost > 0 ? (totalAdBuyerBonus / totalStaffCost) * 100 : 15,
        controller: totalStaffCost > 0 ? (totalControllerBonus / totalStaffCost) * 100 : 10,
      },
    }
  }, [
    effSummary,
    effAnchors,
    baseSalary,
    tier1Rate,
    tier2Rate,
    tier3Rate,
    adBuyerRate,
    adBuyerRoiTarget,
    adBuyerRoiActual,
    operatorProfitShare,
    controllerPerSession,
    controllerBonus,
    hrbpModuleParams,
  ])

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-[var(--text-muted)]">
        <div className="w-7 h-7 border-2 border-orbit-primary border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs">HRBP 经营人效中枢装载中...</span>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1680px] w-full mx-auto">
      {/* 头部大盘标题与控制栏 */}
      <motion.div {...fadeIn} className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-orbit-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orbit-primary/15 text-orbit-primary-light flex items-center justify-center font-bold">
              <Users className="w-5 h-5 text-orbit-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                HRBP 业务工作台
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-orbit-surface2 text-[var(--text-primary)] font-normal border border-orbit-border">
                  亿级直播电商组织经营中枢
                </span>
              </h1>
              <p className="text-xs text-[var(--text-muted)] dark:text-[var(--text-muted)] mt-0.5">
                全域人效罗盘 · 九宫格人才盘点 · 全息人才画像 · 铁三角作战协同 · 全岗分润精算 · 试镜漏斗 · 资产法务风控
              </p>
            </div>
          </div>
        </div>

        {/* 顶部核心经营状态指标胶囊 */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orbit-surface border border-orbit-border text-xs">
            <span className="text-[var(--text-muted)]">周期 GMV:</span>
            <span className="font-bold text-orbit-primary">{fmtWan(effSummary?.kpi.totalGmv)}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orbit-surface border border-orbit-border text-xs">
            <span className="text-[var(--text-muted)]">小时人效:</span>
            <span className="font-bold text-status-success dark:text-status-success">{fmtWan(effSummary?.efficiency.gmvPerHour)}/h</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orbit-surface border border-orbit-border text-xs">
            <span className="text-[var(--text-muted)]">全员薪效比:</span>
            <span className="font-bold text-[var(--text-primary)]">{commissionSim.staffCostRatio.toFixed(1)}%</span>
            <span className="text-[10px] text-status-success dark:text-status-success font-medium">(健康 6%~10%)</span>
          </div>

          {/* 时间范围筛选与刷新 */}
          <div className="flex items-center gap-1.5">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="text-xs bg-orbit-surface border border-orbit-border rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] font-medium"
            >
              <option value={7}>近 7 天</option>
              <option value={30}>近 30 天</option>
              <option value={90}>近 90 天</option>
            </select>
            <Button variant="secondary" onClick={load} className="text-xs h-8">
              <RefreshCw className="w-3.5 h-3.5" /> 刷新
            </Button>
          </div>
        </div>
      </motion.div>

      {err && (
        <div className="rounded-lg border border-orbit-danger/30 bg-orbit-danger/10 px-3 py-2 text-xs text-status-danger dark:text-status-danger flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {err}
        </div>
      )}

      {/* 9 大核心业务工作面 Tab 导航栏 */}
      <div className="flex gap-1 border-b border-orbit-border overflow-x-auto scrollbar-none pb-0.5">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-all duration-150 ${active
                ? 'border-orbit-primary text-orbit-primary bg-orbit-primary/5 rounded-t-lg font-bold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-normal ${active ? 'bg-orbit-primary text-white' : 'bg-orbit-surface2 text-[var(--text-muted)]'
                    }`}
                >
                  {t.badge}
                </span>
              )}
              {t.key === 'risk_radar' && (effRisk?.riskCount ?? 0) > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-orbit-danger/20 text-status-danger dark:text-status-danger text-[10px] font-bold">
                  {effRisk?.riskCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ═══════════ Tab 1：经营人效罗盘 ═══════════ */}
      {tab === 'compass' && (
        <div className="space-y-6">
          <motion.div {...fadeIn}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <CompassCard
                title="小时人效 (GMV/h)"
                value={fmtWan(effSummary?.efficiency.gmvPerHour)}
                benchmark="行业优选: ≥ 5.0 万/h"
                status={effSummary?.efficiency.gmvPerHour && effSummary.efficiency.gmvPerHour >= 50000 ? 'excellent' : 'normal'}
                hint="单位直播时间产能，衡量主播控场爆发力"
                icon={Gauge}
              />
              <CompassCard
                title="综合全员薪效比"
                value={`${commissionSim.staffCostRatio.toFixed(1)}%`}
                benchmark="健康区间: 6.0% ~ 10.0%"
                status={commissionSim.staffCostRatio <= 10.0 ? 'excellent' : 'warning'}
                hint="铁三角全员总薪酬 / 真实净结算 GMV"
                icon={Calculator}
              />
              <CompassCard
                title="人均有效净产出"
                value={fmtWan(effSummary?.efficiency.gmvPerAnchor)}
                benchmark="及格基准: ≥ 30 万/人/月"
                status="normal"
                hint="剔除退货后的在职主播月度均摊业绩"
                icon={TrendingUp}
              />
              <CompassCard
                title="全盘开播饱和度"
                value={`${effSummary?.kpi.totalHours ?? 0} h`}
                benchmark={`日均 ${((effSummary?.kpi.totalHours ?? 0) / (days || 30)).toFixed(1)} 小时`}
                status="normal"
                hint={`近 ${days} 天开播 ${effSummary?.kpi.totalSessions ?? 0} 场`}
                icon={CalendarClock}
              />
            </div>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <LineChart className="w-4 h-4 text-orbit-primary" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">近 12 周大盘人效与工时利用走势</span>
                </div>
                <Badge variant="neutral">周度监控</Badge>
              </CardHeader>
              <CardBody className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-orbit-surface2 border-b border-orbit-border">
                      <tr className="text-[var(--text-primary)] dark:text-[var(--text-muted)]">
                        <th className="text-left px-4 py-2.5 font-medium">统计周期</th>
                        <th className="text-right px-3 py-2.5 font-medium">当周 GMV</th>
                        <th className="text-right px-3 py-2.5 font-medium">累计工时</th>
                        <th className="text-right px-3 py-2.5 font-medium">小时人效</th>
                        <th className="text-right px-4 py-2.5 font-medium">在播主播</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orbit-border/40">
                      {(effSummary?.trend || []).map((t) => (
                        <tr key={t.week} className="hover:bg-orbit-surface2/50 transition-colors">
                          <td className="px-4 py-2 text-[var(--text-primary)] font-medium">{t.week}</td>
                          <td className="px-3 py-2 text-right text-[var(--text-primary)] font-mono font-medium">{fmtWan(t.gmv)}</td>
                          <td className="px-3 py-2 text-right text-[var(--text-muted)] font-mono">{t.hours} h</td>
                          <td className="px-3 py-2 text-right text-orbit-primary font-mono font-bold">{fmtWan(t.gmvPerHour)}/h</td>
                          <td className="px-4 py-2 text-right text-[var(--text-primary)] font-mono">{t.activeAnchors} 人</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-orbit-primary" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">梯队 GMV 产出贡献比</span>
                </div>
                <Badge variant="neutral">二八定律</Badge>
              </CardHeader>
              <CardBody className="space-y-4">
                {(effSummary?.tiers || []).map((tier) => (
                  <div key={tier.tier} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <LevelBadge level={tier.tier} />
                        <span className="text-[var(--text-primary)] font-medium">{tier.anchorCount} 名主播</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[var(--text-primary)] font-bold">{fmtWan(tier.gmv)}</span>
                        <span className="text-[11px] text-[var(--text-muted)] font-mono">({fmtPct(tier.gmvShare)})</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-orbit-surface2 overflow-hidden">
                      <div
                        className={`h-full ${tier.tier === 'S' ? 'bg-orbit-danger' : tier.tier === 'A' ? 'bg-orbit-warning' : tier.tier === 'B' ? 'bg-orbit-info' : 'bg-[var(--text-subtle)]'
                          }`}
                        style={{ width: `${Math.min(100, Math.max(0, tier.gmvShare || 0))}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] flex justify-between">
                      <span>小时人效: {fmtWan(tier.gmvPerHour)}/h</span>
                      <span>工时: {tier.hours} h</span>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>

          {/* 6 大核心岗位配置与人效矩阵 */}
          <Card>
            <CardHeader>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-orbit-primary" />
                  直播电商 6 大核心岗位编制与人效矩阵
                </span>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">HRBP 组织架构配比与岗位单位经济价值评估</p>
              </div>
              <Badge variant="info">全域人效模型</Badge>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-orbit-surface2 border-b border-orbit-border">
                    <tr className="text-[var(--text-primary)] dark:text-[var(--text-muted)]">
                      <th className="text-left px-4 py-2.5 font-medium">核心岗位</th>
                      <th className="text-left px-3 py-2.5 font-medium">编制配比</th>
                      <th className="text-left px-4 py-2.5 font-medium">核心职责与交付</th>
                      <th className="text-left px-4 py-2.5 font-medium">核心考评 KPI</th>
                      <th className="text-right px-4 py-2.5 font-medium">行业人均效能标杆</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orbit-border/40">
                    <tr className="hover:bg-orbit-surface2/50 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-[var(--text-primary)]">带货主播 (Anchor)</td>
                      <td className="px-3 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">1个直播间配 2~3人 (轮播)</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">承接流量爆发、憋单放价、商品背书、引导成交</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">小时人效、GPM、转粉率、低退货率</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-orbit-primary">≥ 5 万/h</td>
                    </tr>
                    <tr className="hover:bg-orbit-surface2/50 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-[var(--text-primary)]">千川投放手 (Media Buyer)</td>
                      <td className="px-3 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">1人管 2~3个直播间</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">操盘付费流量、出价抢量、人群定向放大自然流</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">综合 ROI、投流 GMV 贡献占比、引流成本</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-orbit-primary">综合 ROI ≥ 3.5</td>
                    </tr>
                    <tr className="hover:bg-orbit-surface2/50 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-[var(--text-primary)]">直播间操盘手 (Operator)</td>
                      <td className="px-3 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">1人统筹 1个主力直播间</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">全场控盘、排品节奏、喊麦控场、联动投流与主播</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">直播间全场净利润、开播履约率、增量达成</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-orbit-primary">净利润率 ≥ 12%</td>
                    </tr>
                    <tr className="hover:bg-orbit-surface2/50 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-[var(--text-primary)]">中控/场控 (Controller)</td>
                      <td className="px-3 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">1个直播间配 1~2人</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">改价上车、发优惠券、弹幕互动、音效氛围、防断播</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">零价格失误、弹幕敏感词响应、上架及时率</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-orbit-primary">失误率 0 次/月</td>
                    </tr>
                    <tr className="hover:bg-orbit-surface2/50 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-[var(--text-primary)]">助播 (Co-host)</td>
                      <td className="px-3 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">1个直播间配 1人 (随主播)</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">副咖搭腔、演示上身、补足话术间隙、促单逼单</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">配合默契度、促单转化增量、主咖疲劳替班</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-orbit-primary">留存率提升 15%</td>
                    </tr>
                    <tr className="hover:bg-orbit-surface2/50 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-[var(--text-primary)]">选品编导 (Merchandiser)</td>
                      <td className="px-3 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">1人服务 2~4个直播间</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">品类测款、破价机制谈判、排品梯队 (引流/承接/利润)</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">动销率、爆品成活率、商品毛利率、退货率控制</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-orbit-primary">动销率 ≥ 85%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* ═══════════ Tab 2：人效产能全景榜 ═══════════ */}
      {tab === 'ranking' && (
        <motion.div {...fadeIn} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-orbit-surface p-3 rounded-xl border border-orbit-border">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">排序依据:</span>
              <select
                value={effSort}
                onChange={(e) => setEffSort(e.target.value)}
                className="text-xs bg-orbit-surface2 border border-orbit-border rounded-lg px-2.5 py-1 text-[var(--text-primary)] font-medium"
              >
                <option value="gmv">总成交 GMV (降序)</option>
                <option value="hourly">小时人效 GMV/h (降序)</option>
                <option value="sessions">开播场次 (降序)</option>
                <option value="returns">退货率 (降序)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="搜索主播姓名或层级 (S/A/B/C)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-1.5 w-60 text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:border-orbit-primary"
              />
              <Badge variant="neutral">共 {filteredAnchors.length} 名主播</Badge>
            </div>
          </div>

          <Card>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-orbit-surface2 border-b border-orbit-border">
                    <tr className="text-[var(--text-primary)] dark:text-[var(--text-muted)]">
                      <th className="text-left px-4 py-3 font-medium">排名</th>
                      <th className="text-left px-4 py-3 font-medium">主播</th>
                      <th className="text-left px-3 py-3 font-medium">层级</th>
                      <th className="text-right px-3 py-3 font-medium">开播场次</th>
                      <th className="text-right px-3 py-3 font-medium">累计工时</th>
                      <th className="text-right px-4 py-3 font-medium">总成交 GMV</th>
                      <th className="text-right px-4 py-3 font-medium">小时人效</th>
                      <th className="text-right px-3 py-3 font-medium">退货率</th>
                      <th className="text-right px-3 py-3 font-medium">出勤率</th>
                      <th className="text-right px-4 py-3 font-medium">人效状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orbit-border/40">
                    {filteredAnchors.map((a, idx) => {
                      const isTop3 = idx < 3
                      const hasHighReturn = (a.returnRate || 0) > 40
                      return (
                        <tr key={a.id} className="hover:bg-orbit-surface2/50 transition-colors">
                          <td className="px-4 py-2.5 font-mono">
                            <span
                              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${isTop3
                                ? 'bg-orbit-warning/20 text-status-warning dark:text-status-warning border border-orbit-warning/30'
                                : 'text-[var(--text-muted)]'
                                }`}
                            >
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-semibold text-[var(--text-primary)]">{a.name}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <LevelBadge level={a.level} />
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-[var(--text-primary)]">{a.sessions} 场</td>
                          <td className="px-3 py-2.5 text-right font-mono text-[var(--text-primary)]">{a.hours} h</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-[var(--text-primary)]">{fmtWan(a.gmv)}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-orbit-primary">{fmtWan(a.gmvPerHour)}/h</td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            <span className={hasHighReturn ? 'text-status-danger dark:text-status-danger font-bold' : 'text-[var(--text-primary)]'}>
                              {fmtPct(a.returnRate)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-[var(--text-primary)]">{fmtPct(a.attendanceRate)}</td>
                          <td className="px-4 py-2.5 text-right">
                            {a.gmvPerHour >= 50000 ? (
                              <Badge variant="success">高产标杆</Badge>
                            ) : a.gmvPerHour >= 20000 ? (
                              <Badge variant="info">稳健主力</Badge>
                            ) : (
                              <Badge variant="warning">待辅导</Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* ═══════════ Tab 3：作战单元协同 ═══════════ */}
      {tab === 'cell' && (
        <motion.div {...fadeIn} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-orbit-border p-4 bg-orbit-surface">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-status-danger" />
                <span className="text-xs font-bold text-[var(--text-primary)]">主力旗舰作战单元（S级班组）</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                黄金档（19:00 - 24:00）主力攻坚。配 1名 S级主咖 + 1名 高能助播 + 1名 资深千川投手 + 1名 控场中控，专注核心爆款与冲刺 GMV。
              </p>
            </div>

            <div className="rounded-xl border border-orbit-border p-4 bg-orbit-surface">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-status-warning" />
                <span className="text-xs font-bold text-[var(--text-primary)]">分销矩阵作战单元（A/B级轮播）</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                平销下午档（13:00 - 18:00）。配 2名 A/B级主播轮流上镜 + 1名 矩阵投手 + 1名 中控，注重长尾自然流承接与长线转粉。
              </p>
            </div>

            <div className="rounded-xl border border-orbit-border p-4 bg-orbit-surface">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-status-success" />
                <span className="text-xs font-bold text-[var(--text-primary)]">新人自播孵化班组（B/C级练兵）</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                晨间平销档（6:00 - 9:00）练兵。前 5 场 Ramp-up 话术实战，编导现场监播陪跑，敏捷校验选品节奏。
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 text-orbit-primary" />
                  主播工时利用率与排班履约度
                </span>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">对比计划排班 vs 实际开播，评估团队履约可靠性</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="neutral">排班计划 {effUtil?.totals.assignedSessions ?? 0} 场</Badge>
                <Badge variant="info">实际开播 {effUtil?.totals.actualSessions ?? 0} 场</Badge>
                {attendance?.totals.absent ? <Badge variant="warning">异常缺勤 {attendance.totals.absent} 次</Badge> : null}
                {attendance?.totals.idleAnchors ? <Badge variant="neutral">待激活闲置 {attendance.totals.idleAnchors} 人</Badge> : null}
                <Badge variant={effUtil?.totals.utilization != null && effUtil.totals.utilization < 80 ? 'warning' : 'success'}>
                  大盘达成率 {fmtPct(effUtil?.totals.utilization)}
                </Badge>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-orbit-surface2 border-b border-orbit-border">
                    <tr className="text-[var(--text-primary)] dark:text-[var(--text-muted)]">
                      <th className="text-left px-4 py-2.5 font-medium">主播</th>
                      <th className="text-left px-3 py-2.5 font-medium">层级</th>
                      <th className="text-right px-3 py-2.5 font-medium">计划排班</th>
                      <th className="text-right px-3 py-2.5 font-medium">实际开播</th>
                      <th className="text-right px-3 py-2.5 font-medium">累计出勤(h)</th>
                      <th className="text-right px-3 py-2.5 font-medium">出勤率</th>
                      <th className="text-right px-3 py-2.5 font-medium">排休/请假</th>
                      <th className="text-right px-4 py-2.5 font-medium">工时利用率</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orbit-border/40">
                    {(effUtil?.anchors || []).map((a) => (
                      <tr key={a.id} className="hover:bg-orbit-surface2/50 transition-colors">
                        <td className="px-4 py-2 text-[var(--text-primary)] font-medium">{a.name}</td>
                        <td className="px-3 py-2">
                          <LevelBadge level={a.level} />
                        </td>
                        <td className="px-3 py-2 text-right text-[var(--text-muted)]">{a.assignedSessions} 场</td>
                        <td className="px-3 py-2 text-right text-[var(--text-primary)] font-medium">{a.actualSessions} 场</td>
                        <td className="px-3 py-2 text-right text-[var(--text-primary)]">{a.hours} h</td>
                        <td className="px-3 py-2 text-right font-medium text-[var(--text-primary)]">{fmtPct(a.attendanceRate)}</td>
                        <td className="px-3 py-2 text-right text-[var(--text-muted)]">
                          {a.restDays} 休 / {a.leaveDays} 假
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span
                            className={`font-bold ${a.utilization != null && a.utilization < 70
                              ? 'text-status-danger dark:text-status-danger'
                              : 'text-status-success dark:text-status-success'
                              }`}
                          >
                            {fmtPct(a.utilization)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* ═══════════ Tab 4：全岗分润精算 ═══════════ */}
      {tab === 'incentive' && (
        <motion.div {...fadeIn} className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-orbit-primary" />
                  直播间铁三角全岗激励精算与损益平衡模拟
                </span>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  基于「净成交 GMV (扣退货) × 岗位提成权重」倒推全员薪效比，测算主播、运营操盘手、千川投手、中控分配池
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-status-success bg-orbit-success/10 px-2 py-0.5 rounded-full border border-orbit-success/20 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  已联通系统模块参数
                </span>
                <Badge variant="info">全岗 P&amp;L 联动</Badge>
              </div>
            </CardHeader>
            <CardBody className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl border border-orbit-border bg-orbit-surface2/30">
                <div className="space-y-2 border-r border-orbit-border/40 pr-3">
                  <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-orbit-primary" /> 主播阶梯提成
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">底薪 (元/人/月)</label>
                    <input
                      type="number"
                      value={baseSalary}
                      onChange={(e) => setBaseSalary(Number(e.target.value))}
                      className="w-full text-xs bg-orbit-surface border border-orbit-border rounded-lg px-2 py-1 font-mono font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">&lt;40万(%)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={tier1Rate}
                        onChange={(e) => setTier1Rate(Number(e.target.value))}
                        className="w-full text-xs bg-orbit-surface border border-orbit-border rounded px-1.5 py-1 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">40-80万</label>
                      <input
                        type="number"
                        step="0.5"
                        value={tier2Rate}
                        onChange={(e) => setTier2Rate(Number(e.target.value))}
                        className="w-full text-xs bg-orbit-surface border border-orbit-border rounded px-1.5 py-1 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">&gt;80万</label>
                      <input
                        type="number"
                        step="0.5"
                        value={tier3Rate}
                        onChange={(e) => setTier3Rate(Number(e.target.value))}
                        className="w-full text-xs bg-orbit-surface border border-orbit-border rounded px-1.5 py-1 font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-r border-orbit-border/40 pr-3">
                  <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-status-warning" /> 千川投手激励
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">投流消耗提成率 (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={adBuyerRate}
                      onChange={(e) => setAdBuyerRate(Number(e.target.value))}
                      className="w-full text-xs bg-orbit-surface border border-orbit-border rounded-lg px-2 py-1 font-mono font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">目标 ROI</label>
                      <input
                        type="number"
                        step="0.1"
                        value={adBuyerRoiTarget}
                        onChange={(e) => setAdBuyerRoiTarget(Number(e.target.value))}
                        className="w-full text-xs bg-orbit-surface border border-orbit-border rounded px-1.5 py-1 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">实际 ROI</label>
                      <input
                        type="number"
                        step="0.1"
                        value={adBuyerRoiActual}
                        onChange={(e) => setAdBuyerRoiActual(Number(e.target.value))}
                        className="w-full text-xs bg-orbit-surface border border-orbit-border rounded px-1.5 py-1 font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-r border-orbit-border/40 pr-3">
                  <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-status-success" /> 操盘运营分红
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">净利润分红比例 (%)</label>
                    <input
                      type="number"
                      step="1"
                      value={operatorProfitShare}
                      onChange={(e) => setOperatorProfitShare(Number(e.target.value))}
                      className="w-full text-xs bg-orbit-surface border border-orbit-border rounded-lg px-2 py-1 font-mono font-bold"
                    />
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] pt-2 leading-relaxed">
                    全场真实经营毛利扣除投流与平台履约后的净利润分红，与直播间盈亏直接对赌绑定。
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-status-info" /> 中控/场控津贴
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">场次津贴 (元/场)</label>
                    <input
                      type="number"
                      value={controllerPerSession}
                      onChange={(e) => setControllerPerSession(Number(e.target.value))}
                      className="w-full text-xs bg-orbit-surface border border-orbit-border rounded-lg px-2 py-1 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">月度零失误安全奖 (元/人)</label>
                    <input
                      type="number"
                      value={controllerBonus}
                      onChange={(e) => setControllerBonus(Number(e.target.value))}
                      className="w-full text-xs bg-orbit-surface border border-orbit-border rounded-lg px-2 py-1 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat
                  label="预估总人工成本"
                  value={fmtWan(commissionSim.totalStaffCost)}
                  highlight
                  hint="全员薪酬综合包"
                />
                <Stat
                  label="全盘综合薪效比"
                  value={`${commissionSim.staffCostRatio.toFixed(2)}%`}
                  warn={commissionSim.staffCostRatio > 10}
                  hint={commissionSim.staffCostRatio <= 10 ? '处于 6%~10% 健康区间' : '超出 10% 亏损警报'}
                />
                <Stat
                  label="主播佣金与底薪包"
                  value={fmtWan(commissionSim.totalBaseSalary + commissionSim.totalCommission)}
                  hint={`占总成本 ${commissionSim.shares.anchor.toFixed(0)}%`}
                />
                <Stat
                  label="操盘手净利分红"
                  value={fmtWan(commissionSim.totalOperatorBonus)}
                  hint={`占总成本 ${commissionSim.shares.operator.toFixed(0)}%`}
                />
                <Stat
                  label="投手及中控提成"
                  value={fmtWan(commissionSim.totalAdBuyerBonus + commissionSim.totalControllerBonus)}
                  hint={`投流+中控协同池`}
                />
              </div>
            </CardBody>
          </Card>

          {/* 主播个体差异化提成透视 (不同人不同比例，已穿透系统运维参数中枢) */}
          <Card className="border-orbit-accent/30 bg-gradient-to-br from-orbit-surface to-orbit-surface2/60">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-orbit-accent" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  主播个体差异化提成透视 (不同人对应不同比例，已穿透系统参数中枢)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-status-success bg-orbit-success/10 px-2.5 py-0.5 rounded-full border border-orbit-success/20 font-medium">
                  三层覆盖引擎已连接
                </span>
                <a
                  href="/system/config"
                  className="text-xs text-orbit-primary-light hover:underline ml-2"
                >
                  去系统运维配置参数 →
                </a>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)]">选择要透视的主播:</span>
                <select
                  value={selectedInspectAnchorId ?? (effAnchors[0]?.id ?? '')}
                  onChange={(e) => setSelectedInspectAnchorId(Number(e.target.value))}
                  className="text-xs bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-1.5 text-[var(--text-secondary)] outline-none"
                >
                  {effAnchors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.level || 'A'}级) - GMV: ¥{Math.round(a.gmv / 10000)}万 ({a.sessions}场开播)
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const targetId = selectedInspectAnchorId ?? effAnchors[0]?.id
                const targetAnchor = effAnchors.find((a) => a.id === targetId) || effAnchors[0]
                if (!targetAnchor) return null

                const override = hrbpModuleParams?.find(
                  (p) => p.scope_type === 'entity' && p.scope_id === `anchor:${targetAnchor.id}`
                )
                const tierRule = hrbpModuleParams?.find(
                  (p) => p.scope_type === 'tier' && p.scope_id?.toUpperCase() === (targetAnchor.level || 'A').toUpperCase()
                )

                let ruleLevel = 'L1 全局通用默认'
                let salary = baseSalary
                let rateDesc = `<40万: ${tier1Rate}% / 40-80万: ${tier2Rate}% / >80万: ${tier3Rate}%`
                let commission = 0
                const netGmv = Math.max(0, targetAnchor.gmv - (targetAnchor.returnAmount || 0))

                if (override && override.param_value) {
                  ruleLevel = 'L3 个人专属对赌协议 (Override)'
                  const ov = override.param_value
                  salary = Number(ov.base_salary ?? salary)
                  if (ov.commission_mode === 'flat') {
                    rateDesc = `净 GMV 单一提成 ${ov.rate}%`
                    commission = (netGmv * (Number(ov.rate) || 0)) / 100
                  } else if (Array.isArray(ov.tiers)) {
                    rateDesc = ov.tiers.map((t: any) => `<${t.max_gmv > 10000 ? '超额' : t.max_gmv + '万'}:${t.rate}%`).join(' / ')
                    let rem = netGmv / 10000
                    let prev = 0
                    for (const t of ov.tiers) {
                      const cap = t.max_gmv - prev
                      const g = Math.min(rem, cap)
                      if (g > 0) {
                        commission += (g * 10000 * t.rate) / 100
                        rem -= g
                      }
                      prev = t.max_gmv
                      if (rem <= 0) break
                    }
                  }
                } else if (tierRule && tierRule.param_value) {
                  ruleLevel = `L2 ${tierRule.param_value.tier_name || targetAnchor.level + '级'}基准阶梯`
                  const tr = tierRule.param_value
                  salary = Number(tr.base_salary ?? salary)
                  if (Array.isArray(tr.tiers)) {
                    rateDesc = tr.tiers.map((t: any) => `<${t.max_gmv > 10000 ? '超额' : t.max_gmv + '万'}:${t.rate}%`).join(' / ')
                    let rem = netGmv / 10000
                    let prev = 0
                    for (const t of tr.tiers) {
                      const cap = t.max_gmv - prev
                      const g = Math.min(rem, cap)
                      if (g > 0) {
                        commission += (g * 10000 * t.rate) / 100
                        rem -= g
                      }
                      prev = t.max_gmv
                      if (rem <= 0) break
                    }
                  }
                } else {
                  let rate = tier1Rate
                  if (targetAnchor.gmv > 800000) rate = tier3Rate
                  else if (targetAnchor.gmv > 400000) rate = tier2Rate
                  commission = (netGmv * rate) / 100
                }

                const totalIncome = salary + commission
                const costRatio = targetAnchor.gmv > 0 ? (totalIncome / targetAnchor.gmv) * 100 : 0

                return (
                  <div className="p-4 rounded-xl bg-orbit-surface border border-orbit-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--text-secondary)] text-sm">{targetAnchor.name}</span>
                        <Badge variant="accent">{targetAnchor.level || 'A'}级主播</Badge>
                        <Badge variant="neutral">{targetAnchor.sessions}场开播</Badge>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30">
                        {ruleLevel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center py-2 bg-orbit-surface2/60 rounded-lg">
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] block">生效保底底薪</span>
                        <span className="text-sm font-mono font-bold text-[var(--text-secondary)]">¥{salary.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] block">净成交 GMV</span>
                        <span className="text-sm font-mono font-bold text-[var(--text-secondary)]">¥{Math.round(netGmv).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] block">提成测算金额</span>
                        <span className="text-sm font-mono font-bold text-orbit-primary-light">¥{Math.round(commission).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] block">预计个人总所得</span>
                        <span className="text-sm font-mono font-bold text-status-success">¥{Math.round(totalIncome).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1">
                      <span>适用提成费率: <strong className="text-[var(--text-secondary)] font-mono">{rateDesc}</strong></span>
                      <span>个人薪效比: <strong className="font-mono text-status-success">{costRatio.toFixed(2)}%</strong></span>
                    </div>
                  </div>
                )
              })()}
            </CardBody>
          </Card>

          {/* 五维胜任力与 GMV 贡献分档 */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orbit-primary" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">主播五维胜任力雷达均分</span>
                </div>
                <Badge variant="neutral">已评估 {performance?.evaluatedCount ?? 0} 人</Badge>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <Stat label="表达感染力" value={performance?.dimensions.expression ?? '—'} hint="语速与控场" />
                  <Stat label="互动敏捷度" value={performance?.dimensions.interaction ?? '—'} hint="弹幕与黑粉" />
                  <Stat label="促单转化力" value={performance?.dimensions.conversion ?? '—'} hint="憋单与放价" />
                  <Stat label="货品专业度" value={performance?.dimensions.professionalism ?? '—'} hint="材质与说服" />
                  <Stat label="综合评分" value={performance?.dimensions.overall ?? '—'} highlight hint="加权总成绩" />
                </div>
                <div className="text-[11px] text-[var(--text-muted)] bg-orbit-surface2/60 p-2.5 rounded-lg border border-orbit-border/60">
                  胜任力评分由操盘总监、HRBP 与系统平台雷达规则联合评估，直接作为主播 S/A/B/C 评级与时段调配依据。
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-orbit-primary" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">GMV 贡献分档与激励倾斜</span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">近 30 天产出分段</span>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-orbit-success/30 bg-orbit-success/5 p-3">
                    <div className="text-[11px] text-status-success dark:text-status-success font-semibold mb-1">头部主咖（前 1/3）</div>
                    <div className="text-xl font-bold text-status-success dark:text-status-success">{performance?.gmvBands.top ?? 0} 人</div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-1">享冲刺高阶分润，锁定黄金时段</div>
                  </div>

                  <div className="rounded-lg border border-orbit-info/30 bg-orbit-info/5 p-3">
                    <div className="text-[11px] text-status-info dark:text-status-info font-semibold mb-1">腰部中坚（中 1/3）</div>
                    <div className="text-xl font-bold text-status-info dark:text-status-info">{performance?.gmvBands.mid ?? 0} 人</div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-1">稳健轮播承接，重点辅导转化力</div>
                  </div>

                  <div className="rounded-lg border border-orbit-warning/30 bg-orbit-warning/5 p-3">
                    <div className="text-[11px] text-status-warning dark:text-status-warning font-semibold mb-1">尾部轮播（后 1/3）</div>
                    <div className="text-xl font-bold text-status-warning dark:text-status-warning">{performance?.gmvBands.low ?? 0} 人</div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-1">晨间/通宵承接，设 15 天观察期</div>
                  </div>

                  <div className="rounded-lg border border-orbit-danger/30 bg-orbit-danger/5 p-3">
                    <div className="text-[11px] text-status-danger dark:text-status-danger font-semibold mb-1">周期零产出</div>
                    <div className="text-xl font-bold text-status-danger dark:text-status-danger">{performance?.gmvBands.none ?? 0} 人</div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-1">触发 HRBP 谈话与排班淘汰程序</div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </motion.div>
      )}

      {/* ═══════════ Tab 5：人才画像与九宫格盘点（全新核心模块） ═══════════ */}
      {tab === 'talent_review' && (
        <motion.div {...fadeIn} className="space-y-6">
          {/* 5.1 盘点宏观概览与九宫格指标卡 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-orbit-danger/30 bg-orbit-danger/5 p-4">
              <div className="flex items-center justify-between text-xs text-status-danger dark:text-status-danger mb-1">
                <span className="font-bold flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-status-danger" /> 超级明星 (Star)
                </span>
                <span className="font-mono font-bold">2 人</span>
              </div>
              <div className="text-xl font-bold text-status-danger dark:text-status-danger">15.4%</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">高绩效 × 高潜力 · 重点合伙留任</div>
            </div>

            <div className="rounded-xl border border-orbit-info/30 bg-orbit-info/5 p-4">
              <div className="flex items-center justify-between text-xs text-status-info dark:text-status-info mb-1">
                <span className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-status-info" /> 潜力黑马 (High Potential)
                </span>
                <span className="font-mono font-bold">2 人</span>
              </div>
              <div className="text-xl font-bold text-status-info dark:text-status-info">18.2%</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">中低绩效 × 高潜力 · 金牌教练1v1</div>
            </div>

            <div className="rounded-xl border border-orbit-success/30 bg-orbit-success/5 p-4">
              <div className="flex items-center justify-between text-xs text-status-success dark:text-status-success mb-1">
                <span className="font-bold flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-status-success" /> 中坚骨干 (Core &amp; Performer)
                </span>
                <span className="font-mono font-bold">3 人</span>
              </div>
              <div className="text-xl font-bold text-status-success dark:text-status-success">54.5%</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">中高绩效 × 中潜力 · 矩阵压舱石</div>
            </div>

            <div className="rounded-xl border border-orbit-warning/30 bg-orbit-warning/5 p-4">
              <div className="flex items-center justify-between text-xs text-status-warning dark:text-status-warning mb-1">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-status-warning" /> 风险与汰换 (Risk &amp; PIP)
                </span>
                <span className="font-mono font-bold">2 人</span>
              </div>
              <div className="text-xl font-bold text-status-warning dark:text-status-warning">11.9%</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">低绩效 × 低中潜 · 15天改进或转岗</div>
            </div>
          </div>

          {/* 5.2 经典九宫格人才盘点矩阵 (9-Box Grid) */}
          <Card>
            <CardHeader>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <LayoutGrid className="w-4 h-4 text-orbit-primary" />
                  直播电商主播人才盘点九宫格矩阵 (9-Box Talent Matrix)
                </span>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  纵轴：近周期产出绩效（高/中/低 GMV） × 横轴：胜任力发展潜能（高/中/低 潜能雷达）
                </p>
              </div>
              <Badge variant="info">3×3 盘点导航</Badge>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* 九宫格容器 */}
              <div className="grid grid-cols-3 gap-3">
                {/* 第一行：高绩效 (High Performance) */}
                <div className="rounded-xl border border-orbit-info/40 bg-orbit-info/5 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-status-info dark:text-status-info">中流砥柱 (High Performer)</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">高绩 · 中潜</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">业务极其熟练的腰部骨干，稳定保量</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {filteredPersonas
                      .filter((p) => p.nineBox.perf === 'high' && p.nineBox.pot === 'med')
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPersonaId(p.id)}
                          className={`px-2 py-1 rounded text-xs font-medium border transition-all ${selectedPersonaId === p.id
                            ? 'bg-orbit-info text-white border-orbit-info shadow-sm'
                            : 'bg-orbit-surface border-orbit-border text-[var(--text-primary)] hover:border-orbit-info'
                            }`}
                        >
                          {p.name} ({p.level})
                        </button>
                      ))}
                  </div>
                </div>

                <div className="rounded-xl border border-orbit-danger/50 bg-orbit-danger/10 p-3.5 space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-8 h-8 bg-orbit-danger/10 rounded-bl-full flex items-start justify-end p-1">
                    <Star className="w-3.5 h-3.5 text-status-danger fill-orbit-danger" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-status-danger dark:text-status-danger">🌟 超级明星 (Star)</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">高绩 · 高潜</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">核心 S 级大咖，战略倾斜资源与顶流 IP 孵化</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {filteredPersonas
                      .filter((p) => p.nineBox.perf === 'high' && p.nineBox.pot === 'high')
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPersonaId(p.id)}
                          className={`px-2 py-1 rounded text-xs font-medium border transition-all ${selectedPersonaId === p.id
                            ? 'bg-orbit-danger text-white border-orbit-danger shadow-sm'
                            : 'bg-orbit-surface border-orbit-border text-[var(--text-primary)] hover:border-orbit-danger font-bold'
                            }`}
                        >
                          {p.name} ({p.level})
                        </button>
                      ))}
                  </div>
                </div>

                <div className="rounded-xl border border-orbit-success/40 bg-orbit-success/5 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-status-success dark:text-status-success">专业工匠 (Solid Pro)</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">高绩 · 熟练潜</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">稳定打法熟练工，规范控价防违规退货</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[11px] text-[var(--text-muted)] italic">暂无归入此格人员</span>
                  </div>
                </div>

                {/* 第二行：中绩效 (Medium Performance) */}
                <Card className="2/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-primary)]">核心中坚 (Core Contributor)</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">中绩 · 中潜</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">常规平销矩阵主力轮播，稳健贡献长尾流量</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {filteredPersonas
                      .filter((p) => p.nineBox.perf === 'med' && p.nineBox.pot === 'med')
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPersonaId(p.id)}
                          className={`px-2 py-1 rounded text-xs font-medium border transition-all ${selectedPersonaId === p.id
                            ? 'bg-[var(--text-primary)] text-[var(--surface)] border-[var(--border)] shadow-sm'
                            : 'bg-orbit-surface border-orbit-border text-[var(--text-secondary)] hover:border-orbit-border2'
                            }`}
                        >
                          {p.name} ({p.level})
                        </button>
                      ))}
                  </div>
                </Card>

                <div className="rounded-xl border border-orbit-info/40 bg-orbit-info/10 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-status-info dark:text-status-info">🚀 潜力黑马 (High Potential)</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">中绩 · 高潜</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">高潜能成长新星，重点配教练带教冲刺黄金档</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {filteredPersonas
                      .filter((p) => p.nineBox.perf === 'med' && p.nineBox.pot === 'high')
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPersonaId(p.id)}
                          className={`px-2 py-1 rounded text-xs font-medium border transition-all ${selectedPersonaId === p.id
                            ? 'bg-orbit-info text-white border-orbit-info shadow-sm'
                            : 'bg-orbit-surface border-orbit-border text-[var(--text-primary)] hover:border-orbit-info'
                            }`}
                        >
                          {p.name} ({p.level})
                        </button>
                      ))}
                  </div>
                </div>

                <Card className="2/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-primary)]">合格执行 (Effective)</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">中绩 · 低潜</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">常规话术脚本执行，按标准排班打卡</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[11px] text-[var(--text-muted)] italic">暂无归入此格人员</span>
                  </div>
                </Card>

                {/* 第三行：低绩效 (Low Performance) */}
                <div className="rounded-xl border border-orbit-warning/40 bg-orbit-warning/5 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-status-warning dark:text-status-warning">📉 需要辅导 (Underperformer)</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">低绩 · 中潜</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">下达 15 天 PIP 改进计划，质检排查话术短板</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {filteredPersonas
                      .filter((p) => p.nineBox.perf === 'low' && p.nineBox.pot === 'med')
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPersonaId(p.id)}
                          className={`px-2 py-1 rounded text-xs font-medium border transition-all ${selectedPersonaId === p.id
                            ? 'bg-orbit-warning text-white border-orbit-warning shadow-sm'
                            : 'bg-orbit-surface border-orbit-border text-[var(--text-primary)] hover:border-orbit-warning'
                            }`}
                        >
                          {p.name} ({p.level})
                        </button>
                      ))}
                  </div>
                </div>

                <div className="rounded-xl border border-orbit-primary/40 bg-orbit-primary/5 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-orbit-primary dark:text-orbit-primary">❓ 待发掘 (Enigma)</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">低绩 · 高潜</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">新人高潜但未出单，排查货盘机制是否匹配</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {filteredPersonas
                      .filter((p) => p.nineBox.perf === 'low' && p.nineBox.pot === 'high')
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPersonaId(p.id)}
                          className={`px-2 py-1 rounded text-xs font-medium border transition-all ${selectedPersonaId === p.id
                            ? 'bg-orbit-primary text-white border-orbit-primary-dark shadow-sm'
                            : 'bg-orbit-surface border-orbit-border text-[var(--text-primary)] hover:border-orbit-primary/40'
                            }`}
                        >
                          {p.name} ({p.level})
                        </button>
                      ))}
                  </div>
                </div>

                <div className="rounded-xl border border-orbit-danger/40 bg-orbit-danger/5 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-status-danger dark:text-status-danger">⚠️ 不达标汰换 (Risk)</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">低绩 · 低潜</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">长期占编零产出，敏捷汰换解约或转岗助播</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {filteredPersonas
                      .filter((p) => p.nineBox.perf === 'low' && p.nineBox.pot === 'low')
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPersonaId(p.id)}
                          className={`px-2 py-1 rounded text-xs font-medium border transition-all ${selectedPersonaId === p.id
                            ? 'bg-orbit-danger text-white border-orbit-danger shadow-sm'
                            : 'bg-orbit-surface border-orbit-border text-[var(--text-primary)] hover:border-orbit-danger'
                            }`}
                        >
                          {p.name} ({p.level})
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* 5.3 选定主播的全息画像详情卡片 */}
          <Card>
            <CardHeader>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-orbit-primary" />
                  主播全息人才画像档案 · {activePersona.name}
                  <LevelBadge level={activePersona.level} />
                </span>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  主攻 {activePersona.category} · {activePersona.platform} 平台 · {activePersona.experienceMonths} 个月经验
                </p>
              </div>
              <Badge variant={activePersona.nineBox.boxType === 'star' ? 'success' : activePersona.nineBox.boxType === 'potential' ? 'info' : 'warning'}>
                九宫格定位: {activePersona.nineBox.boxName}
              </Badge>
            </CardHeader>
            <CardBody className="space-y-5">
              {/* 画像核心属性与粉丝契合度 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="年龄 / 工龄" value={`${activePersona.age} 岁 / ${activePersona.experienceMonths} 个月`} hint="从业成熟度" />
                <Stat label="最高单场带货记录" value={activePersona.peakGmvRecord} highlight hint="历史峰值破发力" />
                <Stat label="最佳开播时段推荐" value={activePersona.preferredShift} hint="生物钟与转化率峰值" />
                <Stat label="粉丝女性占比" value={`${activePersona.followersAudience.femaleRatio}%`} hint={`主要人群: ${activePersona.followersAudience.topAgeGroup}`} />
              </div>

              {/* 核心特质标签墙 */}
              <div>
                <div className="text-xs font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-orbit-primary" />
                  主播特质与风格标签墙 (Talent Style Tags)
                </div>
                <div className="flex flex-wrap gap-2">
                  {activePersona.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                    >
                      <Sparkles className="w-3 h-3 text-orbit-primary" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* 五维胜任力雷达条形打分 */}
              <div>
                <div className="text-xs font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-orbit-primary" />
                  五维胜任力深度模型打分 (综合分: {activePersona.radar.overall} / 10.0)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-2.5 rounded-lg border border-orbit-border/60 bg-orbit-surface">
                    <div className="text-[11px] text-[var(--text-muted)]">表达感染力</div>
                    <div className="text-base font-bold text-[var(--text-primary)] mt-0.5">{activePersona.radar.expression}</div>
                    <div className="h-1 bg-orbit-surface2 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-orbit-primary" style={{ width: `${activePersona.radar.expression * 10}%` }} />
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-orbit-border/60 bg-orbit-surface">
                    <div className="text-[11px] text-[var(--text-muted)]">互动敏捷度</div>
                    <div className="text-base font-bold text-[var(--text-primary)] mt-0.5">{activePersona.radar.interaction}</div>
                    <div className="h-1 bg-orbit-surface2 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-orbit-primary" style={{ width: `${activePersona.radar.interaction * 10}%` }} />
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-orbit-border/60 bg-orbit-surface">
                    <div className="text-[11px] text-[var(--text-muted)]">促单转化力</div>
                    <div className="text-base font-bold text-[var(--text-primary)] mt-0.5">{activePersona.radar.conversion}</div>
                    <div className="h-1 bg-orbit-surface2 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-orbit-primary" style={{ width: `${activePersona.radar.conversion * 10}%` }} />
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-orbit-border/60 bg-orbit-surface">
                    <div className="text-[11px] text-[var(--text-muted)]">货品专业度</div>
                    <div className="text-base font-bold text-[var(--text-primary)] mt-0.5">{activePersona.radar.professionalism}</div>
                    <div className="h-1 bg-orbit-surface2 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-orbit-primary" style={{ width: `${activePersona.radar.professionalism * 10}%` }} />
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-orbit-border/60 bg-orbit-surface">
                    <div className="text-[11px] text-[var(--text-muted)]">抗压控场力</div>
                    <div className="text-base font-bold text-[var(--text-primary)] mt-0.5">{activePersona.radar.resilience}</div>
                    <div className="h-1 bg-orbit-surface2 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-orbit-primary" style={{ width: `${activePersona.radar.resilience * 10}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* HRBP 专属发展计划与继任策略建议 */}
              <div className="p-3.5 rounded-xl border border-orbit-primary/30 bg-orbit-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-orbit-primary flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4" /> HRBP 梯队决策与发展建议：
                  </div>
                  <div className="text-xs text-[var(--text-primary)] mt-1 leading-relaxed">
                    {activePersona.hrbpAdvice}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
                    建议行动方案: {activePersona.nineBox.actionPlan}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="secondary" className="text-xs h-7 px-2.5">
                    导出画像档案
                  </Button>
                  <Button variant="primary" className="text-xs h-7 px-2.5">
                    调整九宫格定位
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* 5.4 行业 4 大类目主播胜任力画像标杆对照 */}
          <Card>
            <CardHeader>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-orbit-primary" />
                  直播电商 5 大主流品类主播画像与胜任力标杆定义
                </span>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">HRBP 针对不同直播间货盘选拔、培训与评估主播的行业基准</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant={personaCategoryFilter === 'all' ? 'primary' : 'secondary'}
                  className="text-xs h-7 px-2.5"
                  onClick={() => setPersonaCategoryFilter('all')}
                >
                  全部品类
                </Button>
                <Button
                  variant={personaCategoryFilter === '美妆护肤' ? 'primary' : 'secondary'}
                  className="text-xs h-7 px-2.5"
                  onClick={() => setPersonaCategoryFilter('美妆护肤')}
                >
                  美妆护肤
                </Button>
                <Button
                  variant={personaCategoryFilter === '服装' ? 'primary' : 'secondary'}
                  className="text-xs h-7 px-2.5"
                  onClick={() => setPersonaCategoryFilter('服装')}
                >
                  服装
                </Button>
                <Button
                  variant={personaCategoryFilter === '食品生鲜' ? 'primary' : 'secondary'}
                  className="text-xs h-7 px-2.5"
                  onClick={() => setPersonaCategoryFilter('食品生鲜')}
                >
                  食品生鲜
                </Button>
                <Button
                  variant={personaCategoryFilter === '3C数码' ? 'primary' : 'secondary'}
                  className="text-xs h-7 px-2.5"
                  onClick={() => setPersonaCategoryFilter('3C数码')}
                >
                  3C数码
                </Button>
                <Button
                  variant={personaCategoryFilter === '鞋箱包' ? 'primary' : 'secondary'}
                  className="text-xs h-7 px-2.5"
                  onClick={() => setPersonaCategoryFilter('鞋箱包')}
                >
                  鞋箱包
                </Button>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-orbit-surface2 border-b border-orbit-border">
                    <tr className="text-[var(--text-primary)] dark:text-[var(--text-muted)]">
                      <th className="text-left px-4 py-2.5 font-medium">直播品类</th>
                      <th className="text-left px-4 py-2.5 font-medium">核心能力权重</th>
                      <th className="text-left px-4 py-2.5 font-medium">外貌与形象特征</th>
                      <th className="text-left px-4 py-2.5 font-medium">话术风格与节奏</th>
                      <th className="text-right px-4 py-2.5 font-medium">标杆小时人效标准</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orbit-border/40">
                    <tr className="hover:bg-orbit-surface2/50 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-[var(--text-primary)]">美妆护肤 (Beauty)</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">专业度 30% + 表达 25% + 转化 25%</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">皮肤白皙通透、五官亲和、镜头耐看</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">成份党背书、反转憋单、痛点放大与机制破价</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-orbit-primary">≥ 6.0 万/h</td>
                    </tr>
                    <tr className="hover:bg-orbit-surface2/50 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-[var(--text-primary)]">服装 (Apparel)</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">表达 30% + 转化 30% + 抗压 20%</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">身材比例优越、衣架子上身气质佳</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">高频过款逼单、库存紧迫感煽动、换装节奏敏捷</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-orbit-primary">≥ 5.5 万/h</td>
                    </tr>
                    <tr className="hover:bg-orbit-surface2/50 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-[var(--text-primary)]">食品生鲜 (Food)</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">互动 30% + 表达 25% + 转化 25%</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">亲切邻家有食欲、笑容治愈、吃播诱人</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">沉浸式诱惑吃播、市井烟火共情、大规格买赠喊麦</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-orbit-primary">≥ 3.5 万/h</td>
                    </tr>
                    <tr className="hover:bg-orbit-surface2/50 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-[var(--text-primary)]">3C数码 (Digital)</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">专业度 35% + 表达 25% + 转化 20%</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">干练理性、极客气质、手部动作清晰</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">参数横向硬核对比、场景化功能演示、逻辑严密说服</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-orbit-primary">≥ 4.5 万/h</td>
                    </tr>
                    <tr className="hover:bg-orbit-surface2/50 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-[var(--text-primary)]">鞋箱包 (Shoes &amp; Bags)</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">专业度 30% + 表达 25% + 转化 25%</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">体态挺拔、手部特写镜头感好、搭配协调</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] dark:text-[var(--text-muted)]">皮料材质/五金细节特写、多场景收纳演示、大牌同源机制放量</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-orbit-primary">≥ 5.0 万/h</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* ═══════════ Tab 6：主播梯队与培育 ═══════════ */}
      {tab === 'pipeline' && (
        <motion.div {...fadeIn} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-orbit-primary" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">主播人才供应链金字塔</span>
              </div>
              <Badge variant="info">在岗主播 {overview?.totalActive ?? 0} 名</Badge>
            </CardHeader>
            <CardBody className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="在岗活跃主播" value={fmtNum(overview?.totalActive)} hint="状态 status=1 正常排班" />
              <Stat label="近 30 天新人" value={fmtNum(overview?.newbieLast30d)} hint="入职孵化期内" highlight />
              <Stat
                label="已建档 / 未建档"
                value={`${overview?.profiles.withProfile ?? 0} / ${overview?.profiles.withoutProfile ?? 0}`}
                hint="档案完整度"
                warn={(overview?.profiles.withoutProfile ?? 0) > 0}
              />
              <Stat label="全盘粉丝池覆盖" value={fmtWan(overview?.fans.total)} hint={`主播人均 ${fmtNum(overview?.fans.avg)} 粉`} />
            </CardBody>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orbit-primary" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">新人前 10 场成长爬坡曲线 (Ramp Curve)</span>
                </div>
                <Badge variant="neutral">按开播场次递增</Badge>
              </CardHeader>
              <CardBody className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-orbit-surface2 border-b border-orbit-border">
                      <tr className="text-[var(--text-primary)] dark:text-[var(--text-muted)]">
                        <th className="text-left px-4 py-2.5 font-medium">开播序号</th>
                        <th className="text-right px-3 py-2.5 font-medium">样本量</th>
                        <th className="text-right px-4 py-2.5 font-medium">场均净 GMV 表现</th>
                        <th className="text-right px-4 py-2.5 font-medium">阶段评估</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orbit-border/40">
                      {(effGrowth?.rampCurve || []).map((r) => (
                        <tr key={r.nth} className="hover:bg-orbit-surface2/50 transition-colors">
                          <td className="px-4 py-2 text-[var(--text-primary)] font-medium">第 {r.nth} 场</td>
                          <td className="px-3 py-2 text-right text-[var(--text-muted)]">{r.anchorCount} 人</td>
                          <td className="px-4 py-2 text-right text-orbit-primary font-bold">¥ {fmtNum(r.avgGmv)}</td>
                          <td className="px-4 py-2 text-right">
                            {r.nth <= 3 ? (
                              <span className="text-status-warning dark:text-status-warning font-medium">试水期</span>
                            ) : r.nth <= 7 ? (
                              <span className="text-status-info dark:text-status-info font-medium">放量期</span>
                            ) : (
                              <span className="text-status-success dark:text-status-success font-medium">定型期</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </div>
        </motion.div>
      )}

      {/* ═══════════ Tab 7：试镜与招聘供给漏斗（真实数据闭环） ═══════════ */}
      {tab === 'recruitment' && (
        <motion.div {...fadeIn} className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-orbit-primary" />
                  主播引才试镜漏斗 (Audition &amp; Talent Funnel)
                </span>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">每周供给池吞吐分析：从线索投递、声画试镜、15分钟试播到转正入库</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="primary" onClick={() => setShowCreateCandidateModal(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  录入应聘候选人
                </Button>
                <Badge variant="info">实时事实流转</Badge>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                <div className="p-3 rounded-lg border border-orbit-border bg-orbit-surface2/40 text-center">
                  <div className="text-[11px] text-[var(--text-muted)] mb-0.5">1. 渠道线索初筛</div>
                  <div className="text-xl font-bold text-[var(--text-primary)]">{recruitmentFunnel.resume_screening} 人</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">待初评</div>
                </div>
                <div className="p-3 rounded-lg border border-orbit-border bg-orbit-surface2/40 text-center">
                  <div className="text-[11px] text-[var(--text-muted)] mb-0.5">2. 试镜邀约</div>
                  <div className="text-xl font-bold text-[var(--text-primary)]">{recruitmentFunnel.audition_scheduled} 人</div>
                  <div className="text-[10px] text-status-info dark:text-status-info mt-0.5">声画实测</div>
                </div>
                <div className="p-3 rounded-lg border border-orbit-border bg-orbit-surface2/40 text-center">
                  <div className="text-[11px] text-[var(--text-muted)] mb-0.5">3. 15min试播实测</div>
                  <div className="text-xl font-bold text-orbit-primary">{recruitmentFunnel.trial_streaming} 人</div>
                  <div className="text-[10px] text-orbit-primary mt-0.5">带货实操</div>
                </div>
                <div className="p-3 rounded-lg border border-orbit-border bg-orbit-surface2/40 text-center">
                  <div className="text-[11px] text-[var(--text-muted)] mb-0.5">4. 发放意向Offer</div>
                  <div className="text-xl font-bold text-status-warning dark:text-status-warning">{recruitmentFunnel.offer_extended} 人</div>
                  <div className="text-[10px] text-status-warning mt-0.5">待办入职</div>
                </div>
                <div className="p-3 rounded-lg border border-orbit-success/30 bg-orbit-success/5 text-center">
                  <div className="text-[11px] text-status-success dark:text-status-success font-semibold mb-0.5">5. 办理转正入库</div>
                  <div className="text-xl font-bold text-status-success dark:text-status-success">{recruitmentFunnel.onboarded} 人</div>
                  <div className="text-[10px] text-status-success mt-0.5">正式主播档案</div>
                </div>
                <div className="p-3 rounded-lg border border-orbit-border bg-orbit-surface2/40 text-center">
                  <div className="text-[11px] text-[var(--text-muted)] mb-0.5">淘汰止损</div>
                  <div className="text-xl font-bold text-[var(--text-muted)]">{recruitmentFunnel.eliminated} 人</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">未达及格线</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-2">
                <div className="p-2.5 rounded-lg border border-orbit-border/60 bg-orbit-surface">
                  <div className="text-[var(--text-muted)] font-medium">BOSS直聘 &amp; 猎聘平台</div>
                  <div className="font-bold text-[var(--text-primary)] mt-1">
                    {recruitmentList.filter(c => c.source.includes('BOSS') || c.source.includes('猎头')).length} 人在库 · 转化高
                  </div>
                  <div className="text-[10px] text-status-success dark:text-status-success mt-0.5">主打成熟带货主咖 · 即插即用</div>
                </div>
                <div className="p-2.5 rounded-lg border border-orbit-border/60 bg-orbit-surface">
                  <div className="text-[var(--text-muted)] font-medium">内部主播/运营转介绍</div>
                  <div className="font-bold text-[var(--text-primary)] mt-1">
                    {recruitmentList.filter(c => c.source.includes('转介')).length} 人在库 · 稳定性高
                  </div>
                  <div className="text-[10px] text-status-success dark:text-status-success mt-0.5">团队默契度佳 · 离职率低</div>
                </div>
                <div className="p-2.5 rounded-lg border border-orbit-border/60 bg-orbit-surface">
                  <div className="text-[var(--text-muted)] font-medium">抖音/快手平台私信挖猎</div>
                  <div className="font-bold text-[var(--text-primary)] mt-1">
                    {recruitmentList.filter(c => c.source.includes('自荐') || c.source.includes('私信')).length} 人在库 · 气场强
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">镜头感强 · 需对齐合规协议</div>
                </div>
                <div className="p-2.5 rounded-lg border border-orbit-border/60 bg-orbit-surface">
                  <div className="text-[var(--text-muted)] font-medium">播音主持/艺校校园招聘</div>
                  <div className="font-bold text-[var(--text-primary)] mt-1">
                    {recruitmentList.filter(c => c.source.includes('校')).length} 人在库 · 梯队储备
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">底薪成本优 · 配套 5 场实战带教</div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-orbit-primary" />
                  主播镜头试镜打分与试播实测档案库 (真实数据源)
                </span>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">五维打分卡（颜值上镜、声线穿透、产品背书、逼单促单、节奏把控）与 15分钟带货实测，支持一键转正入库</p>
              </div>
              <Badge variant="neutral">候选池 {recruitmentList.length} 人</Badge>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-orbit-surface2 border-b border-orbit-border">
                    <tr className="text-[var(--text-primary)] dark:text-[var(--text-muted)]">
                      <th className="text-left px-4 py-2.5 font-medium">候选人姓名</th>
                      <th className="text-left px-3 py-2.5 font-medium">主攻类目 / 渠道</th>
                      <th className="text-left px-3 py-2.5 font-medium">经验 / 期望月薪</th>
                      <th className="text-center px-4 py-2.5 font-medium">五维试镜声画打分</th>
                      <th className="text-right px-4 py-2.5 font-medium">15min 试播实测</th>
                      <th className="text-left px-4 py-2.5 font-medium">HRBP 综合考评评语</th>
                      <th className="text-right px-4 py-2.5 font-medium">推进状态 / 操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orbit-border/40">
                    {recruitmentList.length > 0 ? (
                      recruitmentList.map((c) => (
                        <tr key={c.id} className="hover:bg-orbit-surface2/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-[var(--text-primary)]">{c.name}</div>
                            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{c.phone || '未留电话'}</div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-orbit-primary/10 text-orbit-primary font-medium text-[11px]">
                              {c.target_category}
                            </span>
                            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{c.source}</div>
                          </td>
                          <td className="px-3 py-3 font-mono text-[var(--text-primary)]">
                            <div>{c.experience_years} 年经验</div>
                            <div className="text-[11px] text-[var(--text-muted)] font-medium">¥ {fmtNum(c.expected_salary)}/月</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {c.total_score ? (
                              <>
                                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-orbit-surface2 border border-orbit-border font-mono font-bold text-orbit-primary">
                                  综合 {c.total_score} 分
                                </div>
                                <div className="text-[10px] text-[var(--text-muted)] mt-1 flex justify-center gap-1.5">
                                  <span>上镜 {c.camera_presence_score}</span>
                                  <span>声线 {c.vocal_clarity_score}</span>
                                  <span>促单 {c.sales_pitch_score}</span>
                                </div>
                              </>
                            ) : (
                              <span className="text-[var(--text-muted)] text-[11px]">待安排试镜</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {c.trial_gmv ? (
                              <>
                                <div className="font-mono font-bold text-status-success dark:text-status-success">¥ {fmtNum(c.trial_gmv)}</div>
                                <div className="text-[10px] text-[var(--text-muted)]">
                                  转化 {c.trial_orders || 0} 单 · 15min测试
                                </div>
                              </>
                            ) : (
                              <span className="text-[var(--text-muted)] text-[11px]">未实测</span>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-xs text-[var(--text-primary)] text-[11px] leading-relaxed">
                            {c.audition_comments || (c.stage === 'eliminated' ? c.eliminated_reason || '考评不合格' : '暂无评语记录')}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {c.stage === 'onboarded' ? (
                              <Badge variant="success">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> 已转正 (已入主播库)
                              </Badge>
                            ) : c.stage === 'eliminated' ? (
                              <Badge variant="neutral">已淘汰</Badge>
                            ) : c.stage === 'offer_extended' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Badge variant="warning">已发意向 Offer</Badge>
                                <Button
                                  variant="primary"
                                  className="text-[10px] h-6 px-2"
                                  onClick={() => handleOnboardCandidate(c)}
                                >
                                  一键转正入库
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="secondary"
                                  className="text-[10px] h-6 px-2"
                                  onClick={() => handleOpenAudition(c)}
                                >
                                  试镜打分
                                </Button>
                                {(c.total_score || c.trial_gmv) && (
                                  <Button
                                    variant="primary"
                                    className="text-[10px] h-6 px-2"
                                    onClick={() => handleOnboardCandidate(c)}
                                  >
                                    转正
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-[var(--text-muted)]">
                          暂无候选人记录，点击右上角录入应聘候选人
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {/* 录入应聘候选人弹窗 */}
          {showCreateCandidateModal && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-orbit-surface border border-orbit-border rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-2 border-b border-orbit-border">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-orbit-primary" />
                    录入主播应聘候选人
                  </h3>
                  <button onClick={() => setShowCreateCandidateModal(false)} className="text-[var(--text-muted)] hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateCandidate} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1 font-medium">候选人姓名 *</label>
                    <input
                      required
                      type="text"
                      placeholder="例如：张雪萌"
                      value={newCandidateForm.name}
                      onChange={(e) => setNewCandidateForm({ ...newCandidateForm, name: e.target.value })}
                      className="w-full bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-orbit-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[var(--text-secondary)] mb-1 font-medium">联系电话</label>
                      <input
                        type="text"
                        placeholder="手机号码"
                        value={newCandidateForm.phone}
                        onChange={(e) => setNewCandidateForm({ ...newCandidateForm, phone: e.target.value })}
                        className="w-full bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-orbit-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[var(--text-secondary)] mb-1 font-medium">应聘品类 *</label>
                      <select
                        required
                        value={newCandidateForm.targetCategory}
                        onChange={(e) => setNewCandidateForm({ ...newCandidateForm, targetCategory: e.target.value })}
                        className="w-full bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-orbit-primary"
                      >
                        {['美妆护肤', '服装', '食品生鲜', '3C数码', '鞋箱包'].map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ── 新增字段 1：面试时间（年月日时分） ── */}
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1 font-medium">
                      面试时间
                      <span className="text-[var(--text-muted)] font-normal ml-1">（年月日时分）</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={newCandidateForm.interviewTime}
                      onChange={(e) => setNewCandidateForm({ ...newCandidateForm, interviewTime: e.target.value })}
                      className="w-full bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-orbit-primary font-mono"
                    />
                  </div>

                  {/* ── 新增字段 2：过往品类（多选 Checkbox 组） ── */}
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-2 font-medium">
                      过往带货品类
                      <span className="text-[var(--text-muted)] font-normal ml-1">（可多选）</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['美妆护肤', '服装', '食品生鲜', '3C数码', '鞋箱包', '珠宝配饰', '家居家纺', '运动户外', '宠物用品', '母婴用品'].map((cat) => {
                        const checked = newCandidateForm.pastCategories.includes(cat)
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              const updated = checked
                                ? newCandidateForm.pastCategories.filter((c) => c !== cat)
                                : [...newCandidateForm.pastCategories, cat]
                              setNewCandidateForm({ ...newCandidateForm, pastCategories: updated })
                            }}
                            className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${checked
                              ? 'bg-orbit-primary/20 border-orbit-primary/60 text-orbit-primary-light font-medium'
                              : 'bg-orbit-surface2 border-orbit-border text-[var(--text-muted)] hover:border-orbit-border2'
                              }`}
                          >
                            {checked && <span className="mr-0.5">✓</span>}
                            {cat}
                          </button>
                        )
                      })}
                    </div>
                    {newCandidateForm.pastCategories.length > 0 && (
                      <p className="mt-1.5 text-[11px] text-orbit-primary-light">
                        已选：{newCandidateForm.pastCategories.join('、')}
                      </p>
                    )}
                  </div>

                  {/* ── 新增字段 3：档案附件（视频 + 图片 上传） ── */}
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1.5 font-medium">
                      候选人档案
                      <span className="text-[var(--text-muted)] font-normal ml-1">（支持视频、图片，最多 10 个文件）</span>
                    </label>
                    {/* 隐藏的原生文件选择器 */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="video/*,image/*,.mp4,.mov,.avi,.webm,.jpg,.jpeg,.png,.gif,.webp"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || [])
                        const merged = [...attachmentFiles, ...files].slice(0, 10)
                        setAttachmentFiles(merged)
                        // 清空 input 以支持重复上传同一文件
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                    />
                    {/* 拖拽/点击上传区域 */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-orbit-border hover:border-orbit-primary/50 rounded-xl p-4 text-center cursor-pointer transition-colors group bg-orbit-surface2"
                    >
                      <Upload className="w-5 h-5 text-[var(--text-muted)] group-hover:text-orbit-primary-light mx-auto mb-1.5" />
                      <p className="text-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]">
                        点击选择或拖拽上传视频、图片
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        支持 MP4、MOV、AVI、JPG、PNG、GIF 等格式，单文件不超过 500MB
                      </p>
                    </div>
                    {/* 已选文件预览列表 */}
                    {attachmentFiles.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {attachmentFiles.map((file, idx) => {
                          const isVideo = file.type.startsWith('video/')
                          const isImage = file.type.startsWith('image/')
                          const sizeLabel = file.size > 1024 * 1024
                            ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                            : `${(file.size / 1024).toFixed(0)} KB`
                          return (
                            <div key={idx} className="flex items-center gap-2 bg-orbit-surface border border-orbit-border rounded-lg px-3 py-1.5">
                              {isVideo ? (
                                <FileVideo className="w-3.5 h-3.5 text-orbit-info shrink-0" />
                              ) : isImage ? (
                                <ImageIcon className="w-3.5 h-3.5 text-status-success shrink-0" />
                              ) : (
                                <Paperclip className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                              )}
                              <span className="text-[11px] text-[var(--text-secondary)] flex-1 truncate">{file.name}</span>
                              <span className="text-[10px] text-[var(--text-muted)] shrink-0">{sizeLabel}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setAttachmentFiles(attachmentFiles.filter((_, i) => i !== idx))
                                }}
                                className="text-[var(--text-muted)] hover:text-status-danger shrink-0"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )
                        })}
                        <p className="text-[10px] text-[var(--text-muted)]">
                          共 {attachmentFiles.length} 个文件（上限 10 个）
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[var(--text-secondary)] mb-1 font-medium">带货经验 (年)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={newCandidateForm.experienceYears}
                        onChange={(e) => setNewCandidateForm({ ...newCandidateForm, experienceYears: e.target.value })}
                        className="w-full bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-orbit-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[var(--text-secondary)] mb-1 font-medium">期望月薪 (元)</label>
                      <input
                        type="number"
                        step="1000"
                        value={newCandidateForm.expectedSalary}
                        onChange={(e) => setNewCandidateForm({ ...newCandidateForm, expectedSalary: e.target.value })}
                        className="w-full bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-orbit-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1 font-medium">招聘渠道</label>
                    <select
                      value={newCandidateForm.source}
                      onChange={(e) => setNewCandidateForm({ ...newCandidateForm, source: e.target.value })}
                      className="w-full bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-orbit-primary"
                    >
                      {['BOSS直聘', '猎头推荐', '内部转介', '校园招聘', '抖音自荐'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-orbit-border">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateCandidateModal(false)}>
                      取消
                    </Button>
                    <Button type="submit" variant="primary" size="sm">
                      确认录入
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* 声画镜头试镜打分与15分钟试播成绩弹窗 */}
          {showAuditionModal && auditionCandidate && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-orbit-surface border border-orbit-border rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-orbit-border">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-orbit-primary" />
                    声画试镜打分与15min试播实测 · 【{auditionCandidate.name}】
                  </h3>
                  <button onClick={() => setShowAuditionModal(false)} className="text-[var(--text-muted)] hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveAudition} className="space-y-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-orbit-surface2/60 border border-orbit-border">
                    <div className="font-semibold text-[var(--text-secondary)] mb-2">五维声画雷达打分 (0 ~ 10分)：</div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[var(--text-muted)] block mb-0.5">颜值上镜表现 (25%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={auditionForm.cameraPresenceScore}
                          onChange={(e) => setAuditionForm({ ...auditionForm, cameraPresenceScore: Number(e.target.value) })}
                          className="w-full bg-orbit-surface border border-orbit-border rounded px-2.5 py-1 text-[var(--text-primary)]"
                        />
                      </div>
                      <div>
                        <label className="text-[var(--text-muted)] block mb-0.5">声线穿透控场 (20%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={auditionForm.vocalClarityScore}
                          onChange={(e) => setAuditionForm({ ...auditionForm, vocalClarityScore: Number(e.target.value) })}
                          className="w-full bg-orbit-surface border border-orbit-border rounded px-2.5 py-1 text-[var(--text-primary)]"
                        />
                      </div>
                      <div>
                        <label className="text-[var(--text-muted)] block mb-0.5">带货话术逼单 (25%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={auditionForm.salesPitchScore}
                          onChange={(e) => setAuditionForm({ ...auditionForm, salesPitchScore: Number(e.target.value) })}
                          className="w-full bg-orbit-surface border border-orbit-border rounded px-2.5 py-1 text-[var(--text-primary)]"
                        />
                      </div>
                      <div>
                        <label className="text-[var(--text-muted)] block mb-0.5">脚本变通临场 (15%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={auditionForm.scriptAdaptabilityScore}
                          onChange={(e) => setAuditionForm({ ...auditionForm, scriptAdaptabilityScore: Number(e.target.value) })}
                          className="w-full bg-orbit-surface border border-orbit-border rounded px-2.5 py-1 text-[var(--text-primary)]"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[var(--text-muted)] block mb-0.5">节奏把控与过品动线 (15%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={auditionForm.rhythmControlScore}
                          onChange={(e) => setAuditionForm({ ...auditionForm, rhythmControlScore: Number(e.target.value) })}
                          className="w-full bg-orbit-surface border border-orbit-border rounded px-2.5 py-1 text-[var(--text-primary)]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-orbit-surface2/60 border border-orbit-border">
                    <div className="font-semibold text-[var(--text-secondary)] mb-2">15分钟实战试播测试产出：</div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[var(--text-muted)] block mb-0.5">实测带货 GMV (元)</label>
                        <input
                          type="number"
                          step="100"
                          value={auditionForm.trialGmv}
                          onChange={(e) => setAuditionForm({ ...auditionForm, trialGmv: Number(e.target.value) })}
                          className="w-full bg-orbit-surface border border-orbit-border rounded px-2.5 py-1 text-[var(--text-primary)]"
                        />
                      </div>
                      <div>
                        <label className="text-[var(--text-muted)] block mb-0.5">实测成交订单量</label>
                        <input
                          type="number"
                          value={auditionForm.trialOrders}
                          onChange={(e) => setAuditionForm({ ...auditionForm, trialOrders: Number(e.target.value) })}
                          className="w-full bg-orbit-surface border border-orbit-border rounded px-2.5 py-1 text-[var(--text-primary)]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[var(--text-secondary)] mb-1 font-medium">评定结果</label>
                      <select
                        value={auditionForm.result}
                        onChange={(e) => setAuditionForm({ ...auditionForm, result: e.target.value })}
                        className="w-full bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 text-[var(--text-primary)]"
                      >
                        <option value="pass">通过试镜 (建议发Offer)</option>
                        <option value="pending">待定观望 (需复测)</option>
                        <option value="fail">淘汰不录用</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--text-secondary)] mb-1 font-medium">考评说明评语</label>
                      <input
                        type="text"
                        placeholder="例如：控场佳、逼单熟练"
                        value={auditionForm.comments}
                        onChange={(e) => setAuditionForm({ ...auditionForm, comments: e.target.value })}
                        className="w-full bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 text-[var(--text-primary)]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-orbit-border">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowAuditionModal(false)}>
                      取消
                    </Button>
                    <Button type="submit" variant="primary" size="sm">
                      保存打分并更新流转
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ═══════════ Tab 8：资产合约与法务风控 ═══════════ */}
      {tab === 'compliance' && (
        <motion.div {...fadeIn} className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-orbit-border p-4 bg-orbit-surface">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
                <span>核心主播独家签约率</span>
                <ShieldCheck className="w-4 h-4 text-status-success" />
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">100.0%</div>
              <div className="text-[10px] text-status-success dark:text-status-success mt-1">全员排他协议已签署生效</div>
            </div>

            <div className="rounded-xl border border-orbit-border p-4 bg-orbit-surface">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
                <span>矩阵官方主号确权率</span>
                <FileCheck className="w-4 h-4 text-orbit-primary" />
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">100.0%</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">企业法人主体实名认证绑定</div>
            </div>

            <div className="rounded-xl border border-orbit-border p-4 bg-orbit-surface">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
                <span>竞业限制与保密期签署率</span>
                <Scale className="w-4 h-4 text-status-info" />
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">96.4%</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">离职在册监控 4 人（按月补偿）</div>
            </div>

            <div className="rounded-xl border border-orbit-border p-4 bg-orbit-surface">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
                <span>直播间违规风控综合分</span>
                <CheckCircle2 className="w-4 h-4 text-status-success" />
              </div>
              <div className="text-xl font-bold text-status-success dark:text-status-success">98.6 分</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">平台信用绿灯 · 零重大违规封号</div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-orbit-primary" />
                  主播独家合约、账号资产确权与竞业到期预警台账
                </span>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">防账号流失、防私下导流、防带走粉丝社群与竞对违规挖猎</p>
              </div>
              <Badge variant="neutral">法务存证档案</Badge>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-orbit-surface2 border-b border-orbit-border">
                    <tr className="text-[var(--text-primary)] dark:text-[var(--text-muted)]">
                      <th className="text-left px-4 py-2.5 font-medium">签约主播</th>
                      <th className="text-left px-3 py-2.5 font-medium">签约性质</th>
                      <th className="text-left px-4 py-2.5 font-medium">合约起止期限</th>
                      <th className="text-left px-3 py-2.5 font-medium">合同剩余天数</th>
                      <th className="text-left px-4 py-2.5 font-medium">绑定直播账号与主体归属</th>
                      <th className="text-left px-3 py-2.5 font-medium">竞业限制期</th>
                      <th className="text-left px-4 py-2.5 font-medium">违约赔偿金条款</th>
                      <th className="text-right px-4 py-2.5 font-medium">履约状态 / 操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orbit-border/40">
                    {contracts.map((c) => {
                      const isExpiringSoon = c.remainingDays < 90
                      return (
                        <tr key={c.id} className="hover:bg-orbit-surface2/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                              {c.anchorName}
                              <LevelBadge level={c.level} />
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant={c.contractType === '独家全职' ? 'info' : 'neutral'}>{c.contractType}</Badge>
                          </td>
                          <td className="px-4 py-3 text-[var(--text-primary)] font-mono text-[11px]">
                            {c.startDate} ~ {c.endDate}
                          </td>
                          <td className="px-3 py-3 font-mono">
                            <span
                              className={`font-bold ${isExpiringSoon ? 'text-status-warning dark:text-status-warning' : 'text-[var(--text-primary)]'
                                }`}
                            >
                              {c.remainingDays} 天
                            </span>
                            {isExpiringSoon && (
                              <span className="block text-[9px] text-status-warning dark:text-status-warning font-medium">
                                临期到期预警
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-[var(--text-primary)]">{c.boundAccount}</div>
                            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{c.accountOwner}</div>
                          </td>
                          <td className="px-3 py-3 text-[var(--text-primary)] font-mono">{c.nonCompeteMonths} 个月</td>
                          <td className="px-4 py-3 text-[var(--text-primary)] text-[11px] font-mono">
                            {c.liquidatedDamages}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {c.complianceStatus === 'renewing' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Badge variant="warning">续约洽谈中</Badge>
                                <Button
                                  variant="secondary"
                                  className="text-[10px] h-6 px-2"
                                  onClick={() => toggleContractStatus(c.id)}
                                >
                                  标记完成
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <Badge variant="success">正常履约</Badge>
                                <Button
                                  variant="secondary"
                                  className="text-[10px] h-6 px-2"
                                  onClick={() => toggleContractStatus(c.id)}
                                >
                                  发起续约
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-orbit-success/30 bg-orbit-success/5 p-4">
              <div className="text-xs font-bold text-status-success dark:text-status-success flex items-center gap-1.5 mb-1.5">
                <CheckCircle2 className="w-4 h-4 text-status-success" /> 私域引流与微信飞单抽检
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                本月直播音视频实时质检与弹幕违规词扫描 0 起违规，严禁主播私下引导粉丝添加个人微信或分流第三方成交。
              </p>
            </div>

            <div className="rounded-xl border border-orbit-info/30 bg-orbit-info/5 p-4">
              <div className="text-xs font-bold text-status-info dark:text-status-info flex items-center gap-1.5 mb-1.5">
                <FileCheck className="w-4 h-4 text-status-info" /> 品牌寄样与贵重样品盘点核销
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                在库样品 142 件，主播已退库 140 件，剩余 2 件轻奢样衣已登记待归还，杜绝主播私留样品资产。
              </p>
            </div>

            <div className="rounded-xl border border-orbit-warning/30 bg-orbit-warning/5 p-4">
              <div className="text-xs font-bold text-status-warning dark:text-status-warning flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-status-warning" /> 竞业补偿金合规发放闭环
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                本月离职竞业在册人员（4人）已全额对公发放竞业限制补偿金（按原月薪 30% 约定），保全企业核心商密法律效力。
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══════════ Tab 9：人效风险与疲劳预警闭环 ═══════════ */}
      {tab === 'risk_radar' && (
        <motion.div {...fadeIn} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-orbit-danger/30 bg-orbit-danger/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-status-danger dark:text-status-danger flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-status-danger" /> 业绩连续下滑 ≥ 20%
                </span>
                <span className="text-lg font-bold text-status-danger dark:text-status-danger">
                  {(effRisk?.declining || []).length} 人
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                主播最近场次 GMV 对比前期下滑超 20%，疑似状态低迷、选品不配或有离职单飞异动。
              </p>
            </div>

            <div className="rounded-xl border border-orbit-warning/30 bg-orbit-warning/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-status-warning dark:text-status-warning flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-status-warning" /> 周期内零产出/未开播
                </span>
                <span className="text-lg font-bold text-status-warning dark:text-status-warning">
                  {(effRisk?.zeroOutput || []).length} 人
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                签约但在当前周期内 0 场次产出，长期占编占用固定保底，建议敏捷汰换或换岗。
              </p>
            </div>

            <div className="rounded-xl border border-orbit-info/30 bg-orbit-info/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-status-info dark:text-status-info flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 text-status-info" /> 高频异常请假/缺勤 (≥3天)
                </span>
                <span className="text-lg font-bold text-status-info dark:text-status-info">
                  {(effRisk?.highAbsence || []).length} 人
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                请假/病假达到 3 天以上，严重影响排班完整度，需排查健康状态与替补备播。
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-orbit-primary" />
                  人效异常待处置闭环清单（
                  {(effRisk?.declining || []).length + (effRisk?.zeroOutput || []).length + (effRisk?.highAbsence || []).length} 项）
                </span>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">HRBP 联动现场运营主管、选品与排班实施协同干预</p>
              </div>
              <Badge variant="warning">待办处置中</Badge>
            </CardHeader>
            <CardBody className="space-y-3">
              {(effRisk?.declining || []).map((d) => {
                const actionKey = `declining_${d.id}`
                const isHandled = handledActions[actionKey]
                return (
                  <div
                    key={d.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-orbit-border bg-orbit-surface gap-2"
                  >
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <span>{d.name}</span>
                        <LevelBadge level={d.level} />
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-orbit-danger/10 text-status-danger dark:text-status-danger font-medium">
                          下滑 {fmtPct(d.dropRate)}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-1">
                        前期 GMV: {fmtWan(d.prevGmv)} → 当前 GMV: {fmtWan(d.currGmv)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant={isHandled ? 'secondary' : 'primary'}
                        className="text-xs h-7 px-2.5"
                        onClick={() => toggleActionHandled(actionKey)}
                      >
                        {isHandled ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-status-success" /> 已登记约谈
                          </>
                        ) : (
                          '发起约谈与复盘陪跑'
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}

              {(effRisk?.zeroOutput || []).map((z) => {
                const actionKey = `zero_${z.id}`
                const isHandled = handledActions[actionKey]
                return (
                  <div
                    key={z.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-orbit-border bg-orbit-surface gap-2"
                  >
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <span>{z.name}</span>
                        <LevelBadge level={z.level} />
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-orbit-warning/10 text-status-warning dark:text-status-warning font-medium">
                          周期零产出
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-1">
                        末次开播: {z.lastSessionDate || '从未开播'} · 占用固定底薪编制
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant={isHandled ? 'secondary' : 'primary'}
                        className="text-xs h-7 px-2.5"
                        onClick={() => toggleActionHandled(actionKey)}
                      >
                        {isHandled ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-status-success" /> 已下达汰换指令
                          </>
                        ) : (
                          '敏捷试用转岗/解约'
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}

              {(effRisk?.highAbsence || []).map((h) => {
                const actionKey = `absence_${h.name}`
                const isHandled = handledActions[actionKey]
                return (
                  <div
                    key={h.name}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-orbit-border bg-orbit-surface gap-2"
                  >
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <span>{h.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-orbit-info/10 text-status-info dark:text-status-info font-medium">
                          缺勤/病假 {h.leaveDays} 天
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-1">
                        排休 {h.restDays} 天 · 请假率超标影响班组排期
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant={isHandled ? 'secondary' : 'primary'}
                        className="text-xs h-7 px-2.5"
                        onClick={() => toggleActionHandled(actionKey)}
                      >
                        {isHandled ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-status-success" /> 已调配替补
                          </>
                        ) : (
                          '协调副播紧急替补'
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}

              {(effRisk?.riskCount ?? 0) === 0 && (
                <div className="py-8 text-center text-[var(--text-muted)] text-xs flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-status-success" />
                  <span>当前周期暂无人效异常或严重风险，组织运转稳健</span>
                </div>
              )}
            </CardBody>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

// ── 辅助小组件 ──

function CompassCard({
  title,
  value,
  benchmark,
  status,
  hint,
  icon: Icon,
}: {
  title: string
  value: React.ReactNode
  benchmark: string
  status: 'excellent' | 'normal' | 'warning'
  hint: string
  icon: any
}) {
  return (
    <div className="rounded-xl border border-orbit-border p-4 bg-orbit-surface space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)] font-medium">{title}</span>
        <div
          className={`w-6 h-6 rounded-lg flex items-center justify-center ${status === 'excellent'
            ? 'bg-orbit-success/15 text-status-success dark:text-status-success'
            : status === 'warning'
              ? 'bg-orbit-warning/15 text-status-warning dark:text-status-warning'
              : 'bg-orbit-primary/10 text-orbit-primary'
            }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="text-xl font-bold text-[var(--text-primary)]">{value}</div>
      <div className="text-[10px] text-[var(--text-muted)] border-t border-orbit-border/40 pt-1.5 flex items-center justify-between">
        <span>{hint}</span>
        <span className="font-medium text-[var(--text-primary)] dark:text-[var(--text-muted)]">{benchmark}</span>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  warn,
  highlight,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  warn?: boolean
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${warn
        ? 'border-orbit-warning/40 bg-orbit-warning/5'
        : highlight
          ? 'border-orbit-primary/40 bg-orbit-primary/5'
          : 'border-orbit-border/60 bg-orbit-surface'
        }`}
    >
      <div className="text-[11px] text-[var(--text-muted)] font-medium">{label}</div>
      <div
        className={`text-lg font-bold mt-0.5 ${warn ? 'text-status-warning dark:text-status-warning' : highlight ? 'text-orbit-primary' : 'text-[var(--text-primary)]'
          }`}
      >
        {value}
      </div>
      {hint && <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{hint}</div>}
    </div>
  )
}

function LevelBadge({ level }: { level: string }) {
  const color =
    level === 'S'
      ? 'text-status-danger dark:text-status-danger border-orbit-danger/40 bg-orbit-danger/10'
      : level === 'A'
        ? 'text-status-warning dark:text-status-warning border-orbit-warning/40 bg-orbit-warning/10'
        : level === 'B'
          ? 'text-status-info dark:text-status-info border-orbit-info/40 bg-orbit-info/10'
          : 'text-[var(--text-primary)] dark:text-[var(--text-muted)] border-orbit-border/60 bg-orbit-surface2'
  return <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${color}`}>{level}</span>
}

export default HrbpWorkspacePage
