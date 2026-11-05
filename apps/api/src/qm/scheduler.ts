export interface ScheduledAiJob {
  name: string
  cron: string | string[]
  scopeType: 'org'
  action: 'daily_briefing' | 'anomaly_patrol' | 'review_drafts'
}

export const SCHEDULED_AI_JOBS: ScheduledAiJob[] = [
  { name: 'daily_briefing', cron: '15 1 * * *', scopeType: 'org', action: 'daily_briefing' },
  // 08:00–02:00 段每 4.5h 一次（08:00 不巡，02:00 最后）→ 12:30 / 17:00 / 21:30 / 02:00
  { name: 'anomaly_patrol', cron: ['30 12 * * *', '0 17 * * *', '30 21 * * *', '0 2 * * *'], scopeType: 'org', action: 'anomaly_patrol' },
  { name: 'review_drafts', cron: '30 2 * * *', scopeType: 'org', action: 'review_drafts' },
]
