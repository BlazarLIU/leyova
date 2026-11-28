import { Construction, AlertTriangle } from 'lucide-react'
import { EmbeddedCopilot } from '@/components/ai/EmbeddedCopilot'

export function AiOpsCampaignsPage() {
  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
              工作面 3 · 投放协同
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">投流 Agent + 异常熔断</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            投放协同与熔断中心
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            三种 ROI 必须分列（支付 ROI / 结算 ROI / 综合营销 ROI）。结算未成熟禁盲目加预算，单次预算调整 ≤±30%。
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-orbit-ink/40 backdrop-blur-xl p-10 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-orbit-warning/10 border border-orbit-warning/30 flex items-center justify-center">
          <Construction className="w-6 h-6 text-status-warning" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">投放计划列表建设中</h2>
        <p className="text-sm text-[var(--text-muted)] max-w-xl leading-relaxed">
          当前后端仅开放运营方案（campaign-plan）的模板与生成/审批接口，尚无投放计划列表与 ROI 结算字段的聚合接口。
          为避免展示模拟投放数据，本页先以空态呈现，接口就绪后接入真实支付 ROI / 结算 ROI。
        </p>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] pt-1">
          <AlertTriangle className="w-4 h-4 text-status-warning" />
          <span>预算调整 ±30% 熔断规则待随投放接口一并落地</span>
        </div>
      </div>

      <EmbeddedCopilot page="ads" contextLabel="投放计划与 ROI 熔断" date={new Date().toISOString().slice(0, 10)} />
    </div>
  )
}
