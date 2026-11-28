/**
 * assortment-sequencing.ts — 排品测算推荐算法与直播执行清单导出
 *
 * 核心能力：
 *   1. 基于毛利优先、GMV优先或清库存目标测算最优出场顺序；
 *   2. 分配建议讲解时长与讲解重点；
 *   3. 导出标准直播执行清单（CSV / 结构化数据）。
 */

export interface CandidateProduct {
  sku: string
  name: string
  unitPrice: number
  costPrice: number
  stock: number
  refundRate?: number
  category?: string
  priorityTag?: string
}

export interface SequencedProduct {
  rank: number
  sku: string
  name: string
  unitPrice: number
  costPrice: number
  marginRate: number
  stock: number
  refundRate: number
  suggestedDurationMin: number
  focusPoints: string
  priorityScore: number
  estimatedGmv: number
  estimatedMargin: number
}

export interface AssortmentRecommendationResult {
  goal: 'profit' | 'gmv' | 'clearance'
  totalDurationMin: number
  productCount: number
  summary: {
    totalEstimatedGmv: number
    totalEstimatedMargin: number
    averageMarginRate: number
  }
  sequence: SequencedProduct[]
}

export function recommendProductSequence(input: {
  goal?: 'profit' | 'gmv' | 'clearance'
  durationMinutes?: number
  products: CandidateProduct[]
}): AssortmentRecommendationResult {
  const goal = input.goal || 'profit'
  const totalDurationMin = Math.max(30, Number(input.durationMinutes) || 120)
  const products = Array.isArray(input.products) ? input.products : []

  if (products.length === 0) {
    return {
      goal,
      totalDurationMin,
      productCount: 0,
      summary: { totalEstimatedGmv: 0, totalEstimatedMargin: 0, averageMarginRate: 0 },
      sequence: [],
    }
  }

  const maxPrice = Math.max(...products.map((p) => Number(p.unitPrice) || 1), 1)
  const maxStock = Math.max(...products.map((p) => Number(p.stock) || 1), 1)

  // 计算每个商品的综合打分
  const scored = products.map((p) => {
    const price = Number(p.unitPrice) || 0
    const cost = Number(p.costPrice) || 0
    const stock = Number(p.stock) || 0
    const refundRate = Number(p.refundRate) || 0.15
    const marginRate = price > 0 ? Math.max(0, (price - cost) / price) : 0

    let score = 0
    let focusPoints = ''

    if (goal === 'profit') {
      // 利润优先：毛利率占 50%，有效转化（1-退款率）占 30%，有库存占 20%
      score = marginRate * 50 + (1 - refundRate) * 30 + (stock > 0 ? 20 : 0)
      focusPoints = '高毛利主推品：重点强调材质品质与独家价值，促成高净利转化'
    } else if (goal === 'gmv') {
      // GMV 优先：单价水平占 40%，低退款率占 30%，库存量占 30%
      score = (price / maxPrice) * 40 + (1 - refundRate) * 30 + (stock / maxStock) * 30
      focusPoints = '客单拉升品：强调品牌背书、组合套装优惠与限时满减'
    } else {
      // 清库存：库存量占 60%，毛利率占 20%，低单价快流转占 20%
      score = (stock / maxStock) * 60 + marginRate * 20 + (1 - price / maxPrice) * 20
      focusPoints = '清仓加速品：配合限时秒杀话术，福袋挂钩，快速消耗库存'
    }

    return {
      sku: p.sku,
      name: p.name,
      unitPrice: price,
      costPrice: cost,
      marginRate: Math.round(marginRate * 1000) / 10,
      stock,
      refundRate: Math.round(refundRate * 1000) / 10,
      score: Math.round(score * 10) / 10,
      focusPoints,
    }
  })

  // 按得分由高到低排序
  scored.sort((a, b) => b.score - a.score)

  // 分配讲解时长（每品最少 5 分钟，根据打分权重动态分摊）
  const totalScore = scored.reduce((acc, s) => acc + s.score, 0) || 1
  let allocatedMinutes = 0
  let totalEstimatedGmv = 0
  let totalEstimatedMargin = 0

  const sequence: SequencedProduct[] = scored.map((item, index) => {
    const rawMin = Math.round((item.score / totalScore) * totalDurationMin)
    const suggestedDurationMin = Math.max(5, Math.min(25, rawMin || 8))
    allocatedMinutes += suggestedDurationMin

    // 粗估单品讲解预计产出 GMV 与利润
    const estimatedGmv = Math.round(item.unitPrice * Math.min(item.stock, suggestedDurationMin * 3) * 100) / 100
    const estimatedMargin = Math.round(estimatedGmv * (item.marginRate / 100) * 100) / 100
    totalEstimatedGmv += estimatedGmv
    totalEstimatedMargin += estimatedMargin

    return {
      rank: index + 1,
      sku: item.sku,
      name: item.name,
      unitPrice: item.unitPrice,
      costPrice: item.costPrice,
      marginRate: item.marginRate,
      stock: item.stock,
      refundRate: item.refundRate,
      suggestedDurationMin,
      focusPoints: item.focusPoints,
      priorityScore: item.score,
      estimatedGmv,
      estimatedMargin,
    }
  })

  const averageMarginRate = totalEstimatedGmv > 0
    ? Math.round((totalEstimatedMargin / totalEstimatedGmv) * 1000) / 10
    : 0

  return {
    goal,
    totalDurationMin: allocatedMinutes,
    productCount: sequence.length,
    summary: {
      totalEstimatedGmv: Math.round(totalEstimatedGmv * 100) / 100,
      totalEstimatedMargin: Math.round(totalEstimatedMargin * 100) / 100,
      averageMarginRate,
    },
    sequence,
  }
}

export function exportChecklistCsv(sequence: SequencedProduct[]): string {
  const headers = ['出场顺序', '商品名称', 'SKU', '售价(元)', '成本(元)', '毛利率(%)', '库存', '退款率(%)', '建议讲解(分钟)', '讲解重点', '预估GMV', '预估毛利']
  const rows = sequence.map((p) => [
    p.rank,
    `"${(p.name || '').replace(/"/g, '""')}"`,
    p.sku,
    p.unitPrice,
    p.costPrice,
    `${p.marginRate}%`,
    p.stock,
    `${p.refundRate}%`,
    p.suggestedDurationMin,
    `"${(p.focusPoints || '').replace(/"/g, '""')}"`,
    p.estimatedGmv,
    p.estimatedMargin,
  ])
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

export function exportChecklistExcel(sequence: SequencedProduct[]): string {
  const headers = ['出场顺序', '商品名称', 'SKU', '售价(元)', '成本(元)', '毛利率', '库存', '退款率', '建议讲解(分钟)', '讲解重点', '预估GMV(元)', '预估毛利(元)']
  const rows = sequence.map((p) => [
    p.rank,
    p.name || '',
    p.sku,
    p.unitPrice,
    p.costPrice,
    `${p.marginRate}%`,
    p.stock,
    `${p.refundRate}%`,
    p.suggestedDurationMin,
    p.focusPoints || '',
    p.estimatedGmv,
    p.estimatedMargin,
  ])
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="直播执行排品清单">
  <Table>
   <Row>${headers.map((h) => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>
   ${rows.map((r) => `<Row>${r.map((v) => `<Cell><Data ss:Type="${typeof v === 'number' ? 'Number' : 'String'}">${String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`).join('')}</Row>`).join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`
}
