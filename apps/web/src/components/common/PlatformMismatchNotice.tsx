import { motion } from 'framer-motion'
import { AlertCircle, ArrowRight, RefreshCw, Store } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { RouteCompatibility } from '@/utils/platformRoute'

interface PlatformMismatchNoticeProps {
  compatibility: RouteCompatibility
  currentPlatformName?: string
  onSwitchPlatform?: (platformCode: string) => void
  onGoToDashboard?: () => void
}

export function PlatformMismatchNotice({
  compatibility,
  currentPlatformName = '当前平台',
  onSwitchPlatform,
  onGoToDashboard,
}: PlatformMismatchNoticeProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 min-h-[60vh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-xl w-full"
      >
        <Card className="border-orbit-warning/30 bg-orbit-surface/90 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orbit-warning via-orbit-danger to-orbit-primary-dark" />
          <CardBody className="p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-orbit-warning/10 border border-orbit-warning/20 text-status-warning flex items-center justify-center mx-auto shadow-inner">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                当前功能与所选经营渠道不匹配
              </h2>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-md mx-auto">
                {compatibility.reason}
              </p>
            </div>

            <div className="rounded-xl bg-white/[0.03] border border-orbit-border/60 p-4 text-xs text-[var(--text-muted)] text-left space-y-1.5">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] font-medium">
                <Store className="w-4 h-4 text-orbit-primary-light" />
                <span>当前选中的渠道：<strong className="text-[var(--text-primary)]">{currentPlatformName}</strong></span>
              </div>
              <p className="text-[var(--text-muted)] pl-6">
                每个电商平台（直播/货架/内容）具备不同的业务核心链路，系统已按平台特性为您分流专属看板与工具。
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {onGoToDashboard && (
                <Button
                  onClick={onGoToDashboard}
                  className="w-full sm:w-auto"
                >
                  前往 {currentPlatformName} 经营看板
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              )}

              {compatibility.suggestedPlatform && onSwitchPlatform && (
                <Button
                  variant="secondary"
                  onClick={() => onSwitchPlatform(compatibility.suggestedPlatform!.code)}
                  className="w-full sm:w-auto text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  切回 {compatibility.suggestedPlatform.name} 查看
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
}

