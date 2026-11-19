import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowUpRight } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { api } from '@/services/api'

const CAPABILITIES = [
  { code: '01', label: '经营大盘', desc: '全渠道 GMV · 净利' },
  { code: '02', label: '场次复盘', desc: '五段漏斗 · 归因' },
  { code: '03', label: '投放对账', desc: 'Net-ROI · 成本穿透' },
  { code: '04', label: '人效协同', desc: '排班 · 主播绩效' },
]

export function SignInPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const form = e.target as HTMLFormElement
      const formData = new FormData(form)
      const res: any = await api.post('/v1/auth/login', {
        username: formData.get('username'),
        password: formData.get('password'),
        rememberMe,
      })
      const u = res?.user
      if (u?.role === 'brand_viewer' || u?.userType === 'brand_viewer') {
        navigate('/brand-portal')
      } else {
        navigate('/')
      }
    } catch (err: any) {
      setError(err.message || '网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      {/* ── Left: Orange Red brand panel ─────────────────────────────────── */}
      <div className="relative hidden w-[52%] flex-col justify-between overflow-hidden bg-orbit-primary p-12 lg:flex brand-grain">
        {/* Swiss grid + soft tonal light */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.16] brand-grid" />
        <div className="pointer-events-none absolute -left-24 top-1/3 h-[420px] w-[420px] rounded-full bg-white/10 blur-[130px]" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-[320px] w-[320px] rounded-full bg-orbit-accent/25 blur-[120px]" />

        {/* Brand lockup */}
        <div className="relative z-10">
          <BrandLogo variant="full" size={30} inverted />
        </div>

        {/* Display headline */}
        <div className="relative z-10">
          <div className="mb-7 flex items-center gap-2">
            <span className="h-[2px] w-8 bg-white/70" />
            <span className="display-eyebrow text-white/70">Full-Channel Commerce OS</span>
          </div>

          <h1 className="display-xl text-[64px] text-white xl:text-[76px]">
            经营
            <br />
            不靠猜
            <span className="text-orbit-accent">.</span>
          </h1>

          <p className="mt-7 max-w-md text-[13.5px] leading-relaxed text-white/75">
            把抖音、快手、淘天、视频号、小红书的经营数据收敛到同一条口径上。
            用真实净利、场次归因与受控 AI，替代虚高的 GMV 报表。
          </p>

          {/* Capability ledger */}
          <div className="mt-10 grid max-w-lg grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-white/25 bg-[var(--hover-bg3)]5">
            {CAPABILITIES.map(c => (
              <div key={c.code} className="bg-orbit-primary p-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-bold tracking-[0.14em] text-orbit-accent">{c.code}</span>
                  <span className="text-[13.5px] font-bold text-white">{c.label}</span>
                </div>
                <p className="mt-1 text-[11px] text-white/65">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-end justify-between gap-6">
          <p className="max-w-xs text-[10.5px] leading-relaxed text-white/55">
            以 Apache-2.0 许可证开源。请遵守所在组织的账号与数据使用规范。
          </p>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-orbit-accent/50 bg-orbit-accent/15 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-orbit-accent" />
            AI READY
          </span>
        </div>
      </div>

      {/* ── Right: auth form ────────────────────────────────────────────── */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-12">
        <div className="pointer-events-none absolute inset-0 brand-grid opacity-30 dark:opacity-20" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-[360px]"
        >
          {/* Mobile brand lockup — switches automatically with the theme */}
          <div className="mb-10 flex items-center">
            <BrandLogo variant="full" size={26} className="lg:hidden" />
          </div>

          <div className="mb-8">
            <p className="display-eyebrow mb-3 text-[var(--text-subtle)]">Sign In</p>
            <h2 className="text-[30px] font-extrabold leading-none tracking-[-0.04em] text-[var(--text-primary)]">
              欢迎回来
            </h2>
            <p className="mt-2.5 text-[13px] text-[var(--text-muted)]">登录你的账号，继续今天的经营。</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="border-l-2 border-orbit-danger bg-orbit-danger/8 py-2.5 pl-3 text-[12.5px] text-orbit-danger">
                {error}
              </div>
            )}
            <Input
              label="用户名"
              name="username"
              type="text"
              placeholder="请输入用户名"
              prefix={<Mail className="h-3.5 w-3.5" />}
              required
            />
            <Input
              label="密码"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              prefix={<Lock className="h-3.5 w-3.5" />}
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="text-[var(--text-subtle)] transition-colors hover:text-[var(--text-primary)]"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              }
              required
            />

            <div className="flex items-center justify-between pt-1">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded-[3px] border-[var(--border)] accent-orbit-primary"
                />
                <span className="text-[11.5px] text-[var(--text-muted)]">记住我</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-[11.5px] font-semibold text-orbit-primary transition-colors hover:text-orbit-primary-dark dark:text-orbit-primary-light"
              >
                忘记密码？
              </Link>
            </div>

            <Button
              type="submit"
              size="xl"
              className="w-full"
              loading={loading}
              icon={<ArrowUpRight className="h-4 w-4" />}
              iconPosition="right"
            >
              登 录
            </Button>
          </form>

          <div className="mt-9 flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">
              Leyova Platform
            </span>
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>
          <p className="mt-4 text-center text-[11.5px] text-[var(--text-muted)]">
            没有账号？请联系组织管理员开通
          </p>
        </motion.div>
      </div>
    </div>
  )
}
