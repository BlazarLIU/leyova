import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { api } from '@/services/api'

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
      await api.post('/v1/auth/login', {
        username: formData.get('username'),
        password: formData.get('password'),
        rememberMe,
      })
      navigate('/overview/home')
    } catch (err: any) {
      setError(err.message || '网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-orbit-bg flex signin-page">
      {/* 登录页局部浅色模式：覆盖全局深色主题（仅作用于本页） */}
      <style>{`
        .signin-page, .signin-page * { --bg:#F8FAFC; --surface:#FFFFFF; --surface2:#F1F5F9; --surface3:#E8EDF3; --border:#E2E8F0; --border2:#CBD5E1; --text-primary:#0F172A; --text-secondary:#1E293B; --text-muted:#475569; --text-subtle:#94A3B8; --hover-bg:rgba(0,0,0,0.04); --hover-bg2:rgba(0,0,0,0.07); --hover-bg3:rgba(0,0,0,0.02); --glass-bg:rgba(0,0,0,0.02); --glass-border:rgba(0,0,0,0.08); }
        .signin-page .text-slate-100, .signin-page .text-slate-200 { color: var(--text-primary) !important; }
        .signin-page .text-slate-300 { color: var(--text-secondary) !important; }
        .signin-page .text-slate-400, .signin-page .text-slate-500 { color: var(--text-muted) !important; }
        .signin-page .text-slate-600, .signin-page .text-slate-700 { color: var(--text-subtle) !important; }
        .signin-page input::placeholder { color: var(--text-subtle); }
      `}</style>
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-orbit-primary/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-orbit-accent/8 blur-[100px] rounded-full" />
      </div>

      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-orbit-border relative">
        <div className="flex items-center gap-3">
          <img src="/orbit-icon.svg" alt="logo" className="h-10 w-auto object-contain" />
        </div>
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center">
            <div>
            <h2 className="text-3xl font-bold text-slate-100 mb-8 leading-tight">
              leyova 直播电商运营系统，{' '}
              <span className="text-gradient">一目了然</span>
            </h2>
            <div className="grid grid-cols-2 gap-4">
            {[
              { value: '实时', label: '数据监控' },
              { value: '智能', label: 'AI 分析' },
              { value: '多维', label: '数据看板' },
              { value: '高效', label: '运营提效' },
            ].map(stat => (
              <div key={stat.label} className="bg-orbit-surface/60 border border-orbit-border rounded-xl p-4">
                <p className="text-xl font-bold text-slate-100">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
          </div>
          </div>
          <div className="mt-10">
            <p className="text-slate-500 text-xs leading-relaxed">
              本系统以 Apache-2.0 许可证开源，请遵守所在组织的账号与数据使用规范。
            </p>
            <p className="text-slate-600 text-xs leading-relaxed mt-1.5">
              This software is released under the Apache-2.0 License. Please follow your organization's account and data usage policies.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <img src="/orbit-icon.svg" alt="logo" className="h-8 w-auto object-contain" />
          </div>

          <h1 className="text-2xl font-bold text-slate-100 mb-1">欢迎回来</h1>
          <p className="text-slate-500 text-sm mb-8">登录您的账户以继续</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-orbit-danger/10 border border-orbit-danger/20 text-sm text-red-400">
                {error}
              </div>
            )}
            <Input
              label="用户名"
              name="username"
              type="text"
              placeholder="请输入用户名"
              prefix={<Mail className="w-3.5 h-3.5" />}
              required
            />
            <Input
              label="密码"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              prefix={<Lock className="w-3.5 h-3.5" />}
              suffix={
                <button type="button" onClick={() => setShowPassword(v => !v)} className="text-slate-500 hover:text-slate-300 transition-colors">
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              }
              required
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="rounded border-orbit-border bg-orbit-surface2 text-orbit-primary w-3.5 h-3.5"
                />
                <span className="text-xs text-slate-500">记住我</span>
              </label>
              <Link to="/forgot-password" className="text-xs text-orbit-primary-light hover:text-orbit-accent transition-colors">
                忘记密码？
              </Link>
            </div>

            <Button type="submit" size="lg" className="w-full" loading={loading} icon={<ArrowRight className="w-4 h-4" />} iconPosition="right">
              登录
            </Button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-8">
            没有账号请联系管理员
          </p>
        </motion.div>
      </div>
    </div>
  )
}