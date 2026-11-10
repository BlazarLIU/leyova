import React, { useState } from 'react'
import { Building2, ShieldCheck, ArrowRight, Lock, User } from 'lucide-react'

export const BrandLoginPage: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        window.location.href = '/brand-portal'
      } else {
        setError(json.message || '用户名或密码不正确')
      }
    } catch (err: any) {
      setError(err?.message || '网络请求异常，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8 space-y-6">
        {/* 顶部 Brand 图标与标题 */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">品牌方专属履约看板登入</h2>
          <p className="text-xs text-gray-500">
            签约代播品牌方受限视角 · 实时查验履约数据与对账单
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-600">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block text-gray-700 font-medium mb-1.5">品牌登录账号</label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="代播服务商为您开通的用户名"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1.5">安全密码</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-1.5"
          >
            {loading ? '正在验证身份...' : '安全登录履约看板'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            数据法律凭证只读保护
          </span>
          <a href="/login" className="hover:text-blue-600 transition-colors">
            切换至员工登录
          </a>
        </div>
      </div>
    </div>
  )
}

