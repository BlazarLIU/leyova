/**
 * knowledge/banned-words.ts — 违禁词 DFA/ACF 引擎
 *
 * 违禁词不能只靠向量检索，必须走确定性规则：
 *   1. 构建 Aho-Corasick 自动机（等价于 DFA 多模式匹配），一次扫描找出全部命中；
 *   2. 归一化处理（全角转半角、去空格与常见分隔符、小写），防绕过；
 *   3. 规则带平台、生效期、动作（block/warn/rewrite）与版本。
 */

export interface BannedWordRule {
  id: string
  word: string
  normalized: string
  category: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  action: 'block' | 'warn' | 'rewrite'
  platform: string
  wordVersion: number
}

export interface BannedMatch {
  word: string
  category: string
  severity: string
  action: string
  start: number
  end: number
  excerpt: string
}

export interface ScanResult {
  blocked: boolean
  matched: BannedMatch[]
  scannedLength: number
}

/** 归一化：全角 → 半角，去空白与常见绕过符号，小写 */
export function normalizeForScan(text: string): string {
  return String(text ?? '')
    .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\s\u200b\u200c\u200d\u3000·•*\-_|/\\.,，。!！?？~～`'"“”‘’()（）\[\]【】<>《》%]/g, '')
    .toLowerCase()
}

interface AcNode {
  next: Map<string, AcNode>
  fail: AcNode | null
  outputs: BannedWordRule[]
}

function createNode(): AcNode {
  return { next: new Map(), fail: null, outputs: [] }
}

/**
 * Aho-Corasick 自动机：构建 O(总词长)，匹配 O(文本长 + 命中数)。
 * 对大小固定的违禁词库（千级）足以在毫秒级完成整段文案扫描。
 */
export class BannedWordAutomaton {
  private root: AcNode = createNode()
  private ruleCount = 0

  constructor(rules: BannedWordRule[]) {
    for (const rule of rules) {
      const normalized = normalizeForScan(rule.normalized || rule.word)
      if (!normalized) continue
      let node = this.root
      for (const char of normalized) {
        let child = node.next.get(char)
        if (!child) {
          child = createNode()
          node.next.set(char, child)
        }
        node = child
      }
      node.outputs.push({ ...rule, normalized })
      this.ruleCount += 1
    }
    this.buildFailureLinks()
  }

  get size(): number {
    return this.ruleCount
  }

  private buildFailureLinks(): void {
    const queue: AcNode[] = []
    for (const child of this.root.next.values()) {
      child.fail = this.root
      queue.push(child)
    }
    while (queue.length > 0) {
      const node = queue.shift()!
      for (const [char, child] of node.next.entries()) {
        let fail = node.fail
        while (fail && !fail.next.has(char)) fail = fail.fail
        child.fail = fail?.next.get(char) || this.root
        if (child.fail === child) child.fail = this.root
        child.outputs = child.outputs.concat(child.fail.outputs)
        queue.push(child)
      }
    }
  }

  /** 在归一化文本上扫描；返回的 start/end 对应归一化坐标 */
  private matchNormalized(normalized: string): Array<{ rule: BannedWordRule; end: number }> {
    const hits: Array<{ rule: BannedWordRule; end: number }> = []
    let node = this.root
    for (let i = 0; i < normalized.length; i += 1) {
      const char = normalized[i]
      while (node && !node.next.has(char)) node = node.fail as AcNode
      node = node?.next.get(char) || this.root
      for (const rule of node.outputs) {
        hits.push({ rule, end: i + 1 })
      }
    }
    return hits
  }

  /** 扫描原文，返回结构化命中与是否需阻断 */
  scan(raw: string, options: { platform?: string } = {}): ScanResult {
    const norm = normalizeForScan(raw)
    const hits = this.matchNormalized(norm)
    const seen = new Set<string>()
    const matched: BannedMatch[] = []

    for (const hit of hits) {
      const platform = hit.rule.platform || 'all'
      if (options.platform && options.platform !== 'all' && platform !== 'all' && platform !== options.platform) continue
      const key = `${hit.rule.normalized}:${hit.end}`
      if (seen.has(key)) continue
      seen.add(key)
      const start = Math.max(0, hit.end - hit.rule.normalized.length)
      matched.push({
        word: hit.rule.word,
        category: hit.rule.category,
        severity: hit.rule.severity,
        action: hit.rule.action,
        start,
        end: hit.end,
        excerpt: norm.slice(Math.max(0, start - 10), Math.min(norm.length, hit.end + 10)),
      })
    }

    matched.sort((a, b) => a.start - b.start)
    return {
      blocked: matched.some((m) => m.action === 'block'),
      matched,
      scannedLength: norm.length,
    }
  }

  /** 按动作改写：block 用占位符替换，warn 保留原文 */
  rewrite(raw: string, options: { platform?: string } = {}): { text: string; result: ScanResult } {
    const result = this.scan(raw, options)
    if (!result.matched.length) return { text: raw, result }
    // 归一化坐标无法直接映射回原文，按词面做安全替换
    let text = String(raw)
    for (const match of result.matched) {
      if (match.action === 'block' || match.action === 'rewrite') {
        text = text.split(match.word).join('*'.repeat(Math.max(2, match.word.length)))
      }
    }
    return { text, result }
  }
}

/** 从规则列表构建自动机（空列表也返回可用实例） */
export function buildAutomaton(rules: BannedWordRule[]): BannedWordAutomaton {
  return new BannedWordAutomaton(rules)
}

/** 内置兜底词库：平台规则未同步时也能拦住明显违规 */
export const DEFAULT_BANNED_RULES: BannedWordRule[] = [
  ['顶级', 'absolute', 'high'],
  ['全网第一', 'absolute', 'critical'],
  ['国家级', 'absolute', 'critical'],
  ['最高级', 'absolute', 'high'],
  ['最佳', 'absolute', 'medium'],
  ['第一品牌', 'absolute', 'critical'],
  ['永久', 'absolute', 'medium'],
  ['100%', 'absolute', 'high'],
  ['根治', 'medical', 'critical'],
  ['药到病除', 'medical', 'critical'],
  ['治疗', 'medical', 'high'],
  ['抗癌', 'medical', 'critical'],
  ['无副作用', 'medical', 'high'],
  ['稳赚', 'financial', 'high'],
  ['保本', 'financial', 'high'],
  ['零风险', 'financial', 'high'],
  ['刷单', 'platform', 'critical'],
  ['返现', 'platform', 'medium'],
  ['最便宜', 'absolute', 'high'],
].map(([word, category, severity], index) => ({
  id: `default-${index + 1}`,
  word,
  normalized: word,
  category,
  severity: severity as BannedWordRule['severity'],
  action: 'block' as const,
  platform: 'all',
  wordVersion: 1,
}))