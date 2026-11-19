/**
 * useModuleParams.ts — 全系统模块参数统一管理与三层解析 Hook
 *
 * 架构规范：
 * 1. L3 (Entity Override): 针对特定人员（如张小雅 anchor:1）或特定直播间的专属对赌覆盖
 * 2. L2 (Tier/Role/Category Baseline): 岗位角色、主播等级（S/A/B/C）、5大品类基准
 * 3. L1 (Global Default): 模块全局兜底默认参数
 *
 * 继承公式：EffectiveParam = L3_Override ?? L2_Baseline ?? L1_GlobalDefault
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/services/api'

export interface ModuleParamItem {
  id: number
  module_code: string
  param_key: string
  param_name: string
  param_type: 'number' | 'percentage' | 'json' | 'string' | 'boolean'
  scope_type: 'global' | 'tier' | 'category' | 'role' | 'entity'
  scope_id: string
  param_value: any
  unit?: string
  description?: string
  updated_by?: string
  updated_at?: string
}

export interface CommissionTierItem {
  max_gmv: number // 万元，如 40, 80, 999999
  rate: number    // 百分比，如 1.5, 3.0, 5.0
}

export interface CategoryBenchmarkItem {
  category: string
  max_return_rate: number
  target_margin: number
  desc?: string
}

export interface ResolvedHrbpParams {
  baseSalary: number
  commissionTiers: CommissionTierItem[]
  commissionMode: 'tiered' | 'flat'
  flatRate?: number
  adBuyerRate: number
  adBuyerTargetRoi: number
  operatorProfitShare: number
  controllerPerSession: number
  controllerBonus: number
  laborEfficiencyAlert: number
  categoryBenchmarks: CategoryBenchmarkItem[]
  effectiveSource: 'override' | 'tier' | 'global'
  matchedRuleName?: string
}

export function useModuleParams(
  moduleCode: string = 'hrbp',
  context?: {
    entityId?: string // e.g. 'anchor:1'
    tier?: string     // e.g. 'S', 'A', 'B', 'C'
    role?: string     // e.g. 'anchor', 'operator', 'ad_buyer', 'controller'
    category?: string // e.g. '美妆护肤', '服装'
  }
) {
  const [params, setParams] = useState<ModuleParamItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchParams = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.get<ModuleParamItem[]>(`/system/module-parameters?module=${moduleCode}`)
      if (Array.isArray(data)) {
        setParams(data)
      }
    } catch (err: any) {
      setError(err?.message || '获取模块参数失败')
    } finally {
      setLoading(false)
    }
  }, [moduleCode])

  useEffect(() => {
    fetchParams()
  }, [fetchParams])

  // 三层解析引擎
  const resolveParam = useCallback(
    (paramKey: string) => {
      if (!params || params.length === 0) return null

      // 1. 查找 L3 (Entity Override)
      if (context?.entityId) {
        const override = params.find(
          (p) => p.param_key === paramKey && p.scope_type === 'entity' && p.scope_id === context.entityId
        )
        if (override) {
          return { value: override.param_value, source: 'override' as const, item: override }
        }
      }

      // 2. 查找 L2 (Tier Baseline)
      if (context?.tier) {
        const tierItem = params.find(
          (p) => p.param_key === paramKey && p.scope_type === 'tier' && p.scope_id === context.tier
        )
        if (tierItem) {
          return { value: tierItem.param_value, source: 'tier' as const, item: tierItem }
        }
      }

      // 3. 查找 L2 (Category Baseline)
      if (context?.category) {
        const catItem = params.find(
          (p) => p.param_key === paramKey && p.scope_type === 'category' && p.scope_id === context.category
        )
        if (catItem) {
          return { value: catItem.param_value, source: 'category' as const, item: catItem }
        }
      }

      // 4. 查找 L2 (Role Baseline)
      if (context?.role) {
        const roleItem = params.find(
          (p) => p.param_key === paramKey && p.scope_type === 'role' && p.scope_id === context.role
        )
        if (roleItem) {
          return { value: roleItem.param_value, source: 'role' as const, item: roleItem }
        }
      }

      // 5. 查找 L1 (Global Default)
      const globalItem = params.find(
        (p) => p.param_key === paramKey && p.scope_type === 'global'
      )
      if (globalItem) {
        return { value: globalItem.param_value, source: 'global' as const, item: globalItem }
      }

      return null
    },
    [params, context]
  )

  // 专门解析 HRBP 模块业务复合结构
  const resolvedHrbp = useMemo<ResolvedHrbpParams>(() => {
    // 默认兜底参数
    let baseSalary = 8000
    let commissionTiers: CommissionTierItem[] = [
      { max_gmv: 40, rate: 1.5 },
      { max_gmv: 80, rate: 3.0 },
      { max_gmv: 999999, rate: 5.0 },
    ]
    let commissionMode: 'tiered' | 'flat' = 'tiered'
    let flatRate = 3.0
    let effectiveSource: 'override' | 'tier' | 'global' = 'global'
    let matchedRuleName = '全局默认通用阶梯'

    // 1. 检查是否有个人专属覆盖 (如张小雅 anchor:1)
    if (context?.entityId) {
      const override = params.find(
        (p) => p.scope_type === 'entity' && p.scope_id === context.entityId
      )
      if (override && override.param_value) {
        effectiveSource = 'override'
        matchedRuleName = override.param_name || '个人专属对赌协议'
        const val = override.param_value
        if (val.base_salary != null) baseSalary = Number(val.base_salary)
        if (val.rate != null) flatRate = Number(val.rate)
        if (val.commission_mode) commissionMode = val.commission_mode
        if (val.tiers && Array.isArray(val.tiers)) commissionTiers = val.tiers
      }
    }

    // 2. 若无个人覆盖，检查是否有该主播等级的基准阶梯 (如 S / A / B / C)
    if (effectiveSource !== 'override' && context?.tier) {
      const tierRule = params.find(
        (p) => p.scope_type === 'tier' && p.scope_id === context.tier
      )
      if (tierRule && tierRule.param_value) {
        effectiveSource = 'tier'
        matchedRuleName = tierRule.param_name || `${context.tier}级主播阶梯`
        const val = tierRule.param_value
        if (val.base_salary != null) baseSalary = Number(val.base_salary)
        if (val.tiers && Array.isArray(val.tiers)) commissionTiers = val.tiers
      }
    }

    // 3. 全局默认阶梯
    if (effectiveSource === 'global') {
      const gRule = params.find(
        (p) => p.param_key === 'anchor_commission_global' && p.scope_type === 'global'
      )
      if (gRule && gRule.param_value) {
        const val = gRule.param_value
        if (val.base_salary != null) baseSalary = Number(val.base_salary)
        if (val.tiers && Array.isArray(val.tiers)) commissionTiers = val.tiers
      }
    }

    // 4. 解析全岗分润参数
    const adBuyerParam = params.find((p) => p.param_key === 'ad_buyer_incentive')?.param_value || {}
    const operatorProfit = Number(params.find((p) => p.param_key === 'operator_profit_share')?.param_value ?? 8.0)
    const controllerParam = params.find((p) => p.param_key === 'controller_allowance')?.param_value || {}
    const laborAlert = Number(params.find((p) => p.param_key === 'labor_efficiency_alert')?.param_value ?? 10.0)

    // 5. 解析 5 大品类退货率与毛利基准
    const catBenchmarks: CategoryBenchmarkItem[] =
      params.find((p) => p.param_key === 'category_benchmarks')?.param_value || [
        { category: '美妆护肤', max_return_rate: 25.0, target_margin: 45.0 },
        { category: '服装', max_return_rate: 60.0, target_margin: 55.0 },
        { category: '食品生鲜', max_return_rate: 20.0, target_margin: 30.0 },
        { category: '3C数码', max_return_rate: 15.0, target_margin: 18.0 },
        { category: '鞋箱包', max_return_rate: 35.0, target_margin: 40.0 },
      ]

    return {
      baseSalary,
      commissionTiers,
      commissionMode,
      flatRate,
      adBuyerRate: Number(adBuyerParam.rate ?? 1.2),
      adBuyerTargetRoi: Number(adBuyerParam.target_roi ?? 3.2),
      operatorProfitShare: operatorProfit,
      controllerPerSession: Number(controllerParam.per_session ?? 150),
      controllerBonus: Number(controllerParam.bonus ?? 1000),
      laborEfficiencyAlert: laborAlert,
      categoryBenchmarks: catBenchmarks,
      effectiveSource,
      matchedRuleName,
    }
  }, [params, context])

  // 批量更新或添加参数
  const updateParameters = useCallback(
    async (items: Partial<ModuleParamItem>[]) => {
      const res = await api.put<{ message: string; updated: number; items: ModuleParamItem[] }>(
        '/system/module-parameters',
        items
      )
      await fetchParams()
      return res
    },
    [fetchParams]
  )

  // 删除参数 (例如取消个人覆盖以恢复继承)
  const deleteParameter = useCallback(
    async (id: number) => {
      const res = await api.delete<{ message: string }>(`/system/module-parameters/${id}`)
      await fetchParams()
      return res
    },
    [fetchParams]
  )

  return {
    params,
    loading,
    error,
    refetch: fetchParams,
    resolveParam,
    resolvedHrbp,
    updateParameters,
    deleteParameter,
  }
}
