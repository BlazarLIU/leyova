/**
 * ai/contract/errors.ts — AI 模块统一错误码与异常契约
 * 
 * 对齐 Plan §6.3 ⑤ 统一错误码，前端可据此展示精准可执行的指引。
 */

export enum AiErrorCode {
  METRIC_UNKNOWN = 'METRIC_UNKNOWN',     // 指标不在目录中
  CROSS_DOMAIN = 'CROSS_DOMAIN',         // 请求跨不同事实域且无法自动下推
  INSUFFICIENT = 'INSUFFICIENT',         // 样本量不足以进行回归预测或方差分析
  SCOPE_DENIED = 'SCOPE_DENIED',         // 角色权限不足以访问敏感指标（如投放消耗、ROI）
  UNVERIFIED = 'UNVERIFIED',             // 结论中的数值未能 100% 溯源至证据库
  LLM_UNAVAILABLE = 'LLM_UNAVAILABLE',   // 大模型不可用，系统自动回落规则模式
}

export const AI_ERROR_USER_MESSAGES: Record<AiErrorCode, (details?: string) => string> = {
  [AiErrorCode.METRIC_UNKNOWN]: (details) => 
    details ? `未识别指标「${details}」，请从标准指标目录中选择。` : '指标未收录在指标注册表中。',
  [AiErrorCode.CROSS_DOMAIN]: (details) => 
    details ? `「${details}」跨越了不同的数据事实域，已自动拆分为独立子查询。` : '跨事实域查询已安全隔离。',
  [AiErrorCode.INSUFFICIENT]: (details) => 
    details ? `数据样本量不足（${details}），已触发数据守卫阻断以防虚假外推。` : '历史样本过少，不足以生成高置信度预测。',
  [AiErrorCode.SCOPE_DENIED]: (details) => 
    details ? `当前角色无权查看「${details}」相关敏感经营数据。` : '当前角色无权访问该指标。',
  [AiErrorCode.UNVERIFIED]: (details) => 
    details ? `数值核验未通过（${details}），为防止幻觉，本结论已按契约拒答。` : '结论存在无法溯源的数值，已拒绝展示。',
  [AiErrorCode.LLM_UNAVAILABLE]: () => 
    '模型推理服务暂不可用，系统已无缝回退至确定性规则分析引擎。',
}

export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    public readonly details?: string,
    public readonly httpStatus: number = 400
  ) {
    const userMsg = AI_ERROR_USER_MESSAGES[code](details)
    super(`[${code}] ${userMsg}`)
    this.name = 'AiError'
  }
}
