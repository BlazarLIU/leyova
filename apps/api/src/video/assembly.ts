/**
 * video/assembly.ts — F.1 剪辑模板装配层（纯函数）
 *
 * 三层职责分离：
 *   模板层：DSL 校验 + 版本灰度选择
 *   装配层：槽位校验（缺必选槽拒绝）+ 镜头计划
 *   渲染层：质检门禁（时长/画幅/响度/字幕/Logo/违禁词/AI 标识/黑帧静音）
 *
 * 本文件不依赖数据库，便于单测；路由只负责取数与落库。
 */

export const SLOT_TYPES = [
  'text',
  'text_list',
  'image',
  'image_list',
  'video',
  'video_list',
  'media',
  'number',
  'json',
  'select',
] as const

export type SlotType = (typeof SLOT_TYPES)[number]

export const TEMPLATE_CATEGORIES = [
  'live_highlight',
  'product_seed',
  'talking_head',
  'image_text',
  'batch_mashup',
  'review_compare',
  'tutorial_steps',
  'report_teaser',
] as const

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]
export type TemplateType = 'selection' | 'assembly' | 'generation'

export interface TemplateSlot {
  key: string
  label?: string
  type: SlotType
  required?: boolean
  maxLength?: number
  countMin?: number
  countMax?: number
  options?: string[]
}

export interface TemplateDsl {
  template: string
  type: TemplateType
  aspect: string
  duration: { min: number; max: number }
  brand_kit?: string
  slots: TemplateSlot[]
  audio?: { voice?: string; bgm?: string; loudness?: number }
  subtitles?: { style?: string; safe_area?: boolean }
  rules: Record<string, string>
}

export class TemplateDslError extends Error {}

const ASPECT_RE = /^\d{1,2}:\d{1,2}$/

/** 把 DSL 里的 rules（数组或对象）统一成对象 */
export function normalizeRules(input: unknown): Record<string, string> {
  if (!input) return {}
  if (Array.isArray(input)) {
    const merged: Record<string, string> = {}
    for (const item of input) {
      if (item && typeof item === 'object') {
        for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
          merged[key] = String(value)
        }
      }
    }
    return merged
  }
  if (typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, value]) => [key, String(value)])
    )
  }
  return {}
}

/** 校验并规范化模板 DSL；非法直接抛错，避免脏模板进入版本表 */
export function parseTemplateDsl(input: unknown): TemplateDsl {
  if (!input || typeof input !== 'object') throw new TemplateDslError('模板 DSL 必须是对象')
  const raw = input as Record<string, any>

  const template = String(raw.template || '').trim()
  if (!template) throw new TemplateDslError('模板 DSL 缺少 template')
  const type = String(raw.type || 'assembly') as TemplateType
  if (!['selection', 'assembly', 'generation'].includes(type)) {
    throw new TemplateDslError('模板 type 必须是 selection / assembly / generation')
  }
  const aspect = String(raw.aspect || '9:16')
  if (!ASPECT_RE.test(aspect)) throw new TemplateDslError(`画幅格式不合法：${aspect}`)

  const min = Number(raw.duration?.min ?? raw.duration?.min_sec ?? 0)
  const max = Number(raw.duration?.max ?? raw.duration?.max_sec ?? 0)
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) {
    throw new TemplateDslError('duration.min/max 必须是正数且 max >= min')
  }

  if (!Array.isArray(raw.slots)) throw new TemplateDslError('模板 slots 必须是数组')
  const seen = new Set<string>()
  const slots: TemplateSlot[] = raw.slots.map((slot: any, index: number) => {
    const key = String(slot?.key || '').trim()
    if (!key) throw new TemplateDslError(`第 ${index + 1} 个槽位缺少 key`)
    if (seen.has(key)) throw new TemplateDslError(`槽位 key 重复：${key}`)
    seen.add(key)
    const type = String(slot?.type || 'text') as SlotType
    if (!SLOT_TYPES.includes(type)) throw new TemplateDslError(`槽位 ${key} 的 type 不合法：${type}`)
    const slotMin = slot?.countMin ?? slot?.count?.min
    const slotMax = slot?.countMax ?? slot?.count?.max
    const options = Array.isArray(slot?.options) ? slot.options.map(String) : undefined
    if (type === 'select' && (!options || options.length === 0)) {
      throw new TemplateDslError(`select 槽位 ${key} 必须提供 options`)
    }
    return {
      key,
      label: slot?.label ? String(slot.label) : undefined,
      type,
      required: Boolean(slot?.required),
      maxLength: slot?.maxLength != null ? Number(slot.maxLength) : undefined,
      countMin: slotMin != null ? Number(slotMin) : undefined,
      countMax: slotMax != null ? Number(slotMax) : undefined,
      options,
    }
  })

  return {
    template,
    type,
    aspect,
    duration: { min, max },
    brand_kit: raw.brand_kit != null ? String(raw.brand_kit) : undefined,
    slots,
    audio: raw.audio && typeof raw.audio === 'object' ? {
      voice: raw.audio.voice != null ? String(raw.audio.voice) : undefined,
      bgm: raw.audio.bgm != null ? String(raw.audio.bgm) : undefined,
      loudness: raw.audio.loudness != null ? Number(raw.audio.loudness) : undefined,
    } : undefined,
    subtitles: raw.subtitles && typeof raw.subtitles === 'object' ? {
      style: raw.subtitles.style != null ? String(raw.subtitles.style) : undefined,
      safe_area: raw.subtitles.safe_area !== false,
    } : undefined,
    rules: normalizeRules(raw.rules),
  }
}

export interface SlotValidationIssue {
  slot: string
  message: string
}

export interface SlotValidationResult {
  ok: boolean
  missing: string[]
  issues: SlotValidationIssue[]
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as object).length === 0
  return false
}

/**
 * 槽位校验：缺必选槽直接拒绝渲染（F.1 验收）。
 * 返回 missing（必选且为空）与 issues（类型/长度/数量不合法）两类信息。
 */
export function validateSlots(dsl: TemplateDsl, values: Record<string, unknown> | null | undefined): SlotValidationResult {
  const input = values && typeof values === 'object' ? values : {}
  const missing: string[] = []
  const issues: SlotValidationIssue[] = []

  for (const slot of dsl.slots) {
    const value = input[slot.key]
    if (isEmptyValue(value)) {
      if (slot.required) missing.push(slot.key)
      continue
    }
    switch (slot.type) {
      case 'text':
      case 'media':
        if (typeof value !== 'string') {
          issues.push({ slot: slot.key, message: '应为字符串' })
        } else if (slot.maxLength && value.length > slot.maxLength) {
          issues.push({ slot: slot.key, message: `长度超过 ${slot.maxLength}` })
        }
        break
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          issues.push({ slot: slot.key, message: '应为数字' })
        }
        break
      case 'json':
        if (typeof value !== 'object' || Array.isArray(value)) {
          issues.push({ slot: slot.key, message: '应为对象' })
        }
        break
      case 'select':
        if (typeof value !== 'string' || !slot.options?.includes(value)) {
          issues.push({ slot: slot.key, message: `取值必须是 ${slot.options?.join(' / ')}` })
        }
        break
      case 'text_list': {
        if (!Array.isArray(value)) {
          issues.push({ slot: slot.key, message: '应为字符串数组' })
          break
        }
        if (value.some((item) => typeof item !== 'string' || item.trim() === '')) {
          issues.push({ slot: slot.key, message: '数组元素必须是非空字符串' })
        }
        const [lo, hi] = [slot.countMin ?? 0, slot.countMax ?? Number.MAX_SAFE_INTEGER]
        if (value.length < lo || value.length > hi) {
          issues.push({ slot: slot.key, message: `数量需在 ${lo}–${hi} 之间` })
        }
        break
      }
      case 'image':
      case 'image_list':
      case 'video':
      case 'video_list': {
        const list = Array.isArray(value) ? value : [value]
        if (list.some((item) => typeof item !== 'string' || item.trim() === '')) {
          issues.push({ slot: slot.key, message: '素材必须是非空路径/URL 数组' })
        }
        if (slot.type.endsWith('_list') || slot.countMin || slot.countMax) {
          const [lo, hi] = [slot.countMin ?? (slot.type.endsWith('_list') ? 1 : 0), slot.countMax ?? Number.MAX_SAFE_INTEGER]
          if (list.length < lo || list.length > hi) {
            issues.push({ slot: slot.key, message: `素材数量需在 ${lo}–${hi} 之间` })
          }
        }
        break
      }
      default:
        break
    }
  }

  return { ok: missing.length === 0 && issues.length === 0, missing, issues }
}

/** 断言槽位合法，供装配入口直接调用 */
export function assertSlots(dsl: TemplateDsl, values: Record<string, unknown> | null | undefined): void {
  const result = validateSlots(dsl, values)
  if (result.missing.length > 0) {
    throw new Error(`缺少必选槽位：${result.missing.join(', ')}`)
  }
  if (result.issues.length > 0) {
    throw new Error(`槽位参数不合法：${result.issues.map((item) => `${item.slot} ${item.message}`).join('；')}`)
  }
}

export interface VersionLike {
  id?: string
  version: number
  status: string
  is_canary?: boolean
  isCanary?: boolean
}

/**
 * 版本灰度选择：
 *   - 只有 published 版本可选；
 *   - 存在 canary 且随机数命中 grayRatio 时走 canary，否则走最新稳定版；
 *   - 无稳定版时退回最新 published（含 canary）。
 */
export function selectTemplateVersion<T extends VersionLike>(
  versions: T[],
  grayRatio: number,
  random = Math.random()
): T | null {
  const published = versions.filter((item) => item.status === 'published')
  if (published.length === 0) return null
  const sorted = [...published].sort((a, b) => b.version - a.version)
  const stable = sorted.find((item) => !(item.is_canary ?? item.isCanary))
  const canary = sorted.find((item) => item.is_canary ?? item.isCanary)
  const ratio = Math.min(100, Math.max(0, Number(grayRatio) || 0))
  if (canary && stable) {
    return random * 100 < ratio ? canary : stable
  }
  return stable || canary || sorted[0]
}

export interface ShotPlanItem {
  seq: number
  shotType: 'hook' | 'selling_point' | 'proof' | 'cta' | 'card' | 'scene'
  title: string
  scriptText: string
  subtitleText: string
  durationMs: number
}

/**
 * 由槽位值生成镜头计划（装配层最小实现）：
 *   - hook → 开场；
 *   - 卖点/步骤/对比维度逐条成镜头；
 *   - cta → 收尾；
 *   - 其余槽位不单独成镜头。
 * 时长按槽位数量均分到模板时长上限，保证总时长落在 DSL 区间内。
 */
export function buildShotPlan(dsl: TemplateDsl, values: Record<string, unknown>): ShotPlanItem[] {
  const shots: Array<{ type: ShotPlanItem['shotType']; title: string; text: string }> = []
  const hook = typeof values.hook === 'string' && values.hook.trim() ? values.hook.trim() : ''
  if (hook) shots.push({ type: 'hook', title: '开场钩子', text: hook })

  const listKeys = ['selling_points', 'steps', 'compare_metrics', 'key_points']
  for (const key of listKeys) {
    const list = values[key]
    if (!Array.isArray(list)) continue
    list.filter((item) => typeof item === 'string' && item.trim()).forEach((item, index) => {
      shots.push({ type: 'selling_point', title: `${key} ${index + 1}`, text: String(item).trim() })
    })
  }

  const script = typeof values.script === 'string' ? values.script.trim() : ''
  if (script) {
    const segments = script.split(/[。！？\n]+/).map((item) => item.trim()).filter(Boolean)
    segments.slice(0, 6).forEach((segment, index) => {
      shots.push({ type: 'scene', title: `口播 ${index + 1}`, text: segment })
    })
  }

  const cta = typeof values.cta === 'string' && values.cta.trim() ? values.cta.trim() : ''
  if (cta) shots.push({ type: 'cta', title: '行动号召', text: cta })

  if (shots.length === 0) {
    shots.push({ type: 'scene', title: '主镜头', text: dsl.template })
  }

  const totalMs = Math.round(((dsl.duration.min + dsl.duration.max) / 2) * 1000)
  const perShot = Math.max(1000, Math.round(totalMs / shots.length))
  return shots.map((shot, index) => ({
    seq: index,
    shotType: shot.type,
    title: shot.title.slice(0, 200),
    scriptText: shot.text,
    subtitleText: shot.text.slice(0, 120),
    durationMs: perShot,
  }))
}

export interface QualityGateInput {
  dsl: TemplateDsl
  durationMs: number
  width: number
  height: number
  loudness?: number | null
  subtitleSegments?: Array<{ startMs: number; endMs: number; text: string }>
  hasBlackFrame?: boolean
  hasSilence?: boolean
  logoPresent?: boolean
  aiLabelPresent?: boolean
  generated?: boolean
  /** 模板是否配置了音频（BGM/配音）；false 时跳过响度与静音检测 */
  audioExpected?: boolean
  /** 模板/品牌套件是否配置了 Logo；false 时跳过 Logo 检测 */
  logoExpected?: boolean
  bannedHits?: Array<{ word: string; action?: string; severity?: string }>
}

export interface QualityCheck {
  key: string
  label: string
  passed: boolean
  detail: string
}

export interface QualityGateResult {
  passed: boolean
  checks: QualityCheck[]
  blockers: string[]
}

function parseAspect(aspect: string): { w: number; h: number } {
  const [w, h] = aspect.split(':').map((item) => Number(item))
  return { w: w || 9, h: h || 16 }
}

/**
 * 质检门禁：任一硬性项不过即 passed=false，渲染产物不得进入发布。
 * 与 F.1.5 对齐：时长、分辨率、帧率（由渲染侧保证）、响度、字幕时间轴、
 * 安全区、品牌 Logo、违禁词、AI 标识、黑帧/静音。
 */
export function runQualityGate(input: QualityGateInput): QualityGateResult {
  const checks: QualityCheck[] = []
  const push = (key: string, label: string, passed: boolean, detail: string) => {
    checks.push({ key, label, passed, detail })
  }

  const durationSec = input.durationMs / 1000
  const inRange = durationSec >= input.dsl.duration.min && durationSec <= input.dsl.duration.max
  push(
    'duration',
    '时长',
    inRange,
    `${durationSec.toFixed(1)}s，要求 ${input.dsl.duration.min}–${input.dsl.duration.max}s`,
  )

  const aspect = parseAspect(input.dsl.aspect)
  const expected = aspect.w / aspect.h
  const actual = input.height > 0 ? input.width / input.height : 0
  const ratioOk = actual > 0 && Math.abs(actual - expected) <= 0.02
  const resolutionOk = ratioOk && input.width >= 720 && input.height >= 720
  push(
    'resolution',
    '分辨率与画幅',
    resolutionOk,
    `${input.width}x${input.height}，要求 ${input.dsl.aspect} 且短边 ≥ 720`,
  )

  const targetLoudness = input.dsl.audio?.loudness ?? -14
  const loudness = input.loudness
  if (input.audioExpected === false) {
    push('loudness', '响度', true, '模板未配置音频，跳过响度检测')
  } else {
    const loudnessOk = loudness == null ? false : Math.abs(Number(loudness) - targetLoudness) <= 1.5
    push('loudness', '响度', loudnessOk, loudness == null ? '未上报响度（数据不足）' : `${loudness} LUFS，目标 ${targetLoudness}±1.5`)
  }

  const segments = input.subtitleSegments || []
  const timelineOk = segments.length > 0 && segments.every((seg) => seg.endMs > seg.startMs && seg.startMs >= 0)
  const ordered = segments.every((seg, index) => index === 0 || seg.startMs >= segments[index - 1].startMs)
  push('subtitle', '字幕时间轴', timelineOk && ordered, `${segments.length} 条时间轴${ordered ? '' : '（未按时间排序）'}`)

  if (input.dsl.subtitles?.safe_area) {
    const maxChars = 20
    const safeOk = segments.every((seg) => seg.text.length <= maxChars)
    push('safe_area', '字幕安全区', safeOk, `单行 ≤ ${maxChars} 字`)
  }

  const logoRule = input.dsl.rules.brand_logo
  if (logoRule && logoRule !== 'off' && logoRule !== 'none') {
    if (input.logoExpected === false) {
      push('brand_logo', '品牌 Logo', true, '未配置品牌 Logo，跳过')
    } else {
      push('brand_logo', '品牌 Logo', Boolean(input.logoPresent), logoRule)
    }
  }

  const banned = input.bannedHits || []
  const hardBanned = banned.filter((hit) => {
    const action = String(hit.action || '').toLowerCase()
    const severity = String(hit.severity || '').toLowerCase()
    return action === 'block' || severity === 'high' || severity === 'critical'
  })
  push(
    'banned_words',
    '违禁词',
    hardBanned.length === 0,
    hardBanned.length === 0 ? '未命中拦截级违禁词' : hardBanned.map((hit) => hit.word).join(' / '),
  )

  const aiRule = input.dsl.rules.ai_label
  const needsAiLabel = aiRule === 'always' || (aiRule === 'if_generated' && input.generated !== false)
  if (needsAiLabel) {
    push('ai_label', 'AI 生成标识', Boolean(input.aiLabelPresent), aiRule === 'always' ? '必须标识' : '生成内容需标识')
  }

  push('black_frame', '黑帧', input.hasBlackFrame !== true, input.hasBlackFrame ? '检测到黑帧' : '通过')
  if (input.audioExpected === false) {
    push('silence', '静音', true, '模板未配置音频，跳过静音检测')
  } else {
    push('silence', '静音', input.hasSilence !== true, input.hasSilence ? '检测到静音段' : '通过')
  }

  const blockers = checks.filter((check) => !check.passed).map((check) => check.label)
  return { passed: blockers.length === 0, checks, blockers }
}
