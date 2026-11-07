import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Plus, Trash2, RefreshCw } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface DictItem {
  id: number
  code: string
  name: string
  item_count: number
  status: string
  created_at?: string
}

/**
 * 字典管理页
 * 数据源：dict_items 表（原本零引用，本页接入真实读写）
 * 语义：每行是一个字典分类（code + name），item_count 记录条目数量
 */
export function DictPage() {
  const [items, setItems] = useState<DictItem[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [form, setForm] = useState({ code: '', name: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get<DictItem[]>('/system/dict')
      setItems(d || [])
    } catch (e: any) {
      setMsg(e?.message || '加载字典失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.code || !form.name) { setMsg('请填写编码与名称'); return }
    try {
      await api.post('/system/dict', form)
      setMsg('字典已添加')
      setForm({ code: '', name: '' })
      load()
    } catch (e: any) {
      setMsg(e?.message || '添加失败')
    }
  }

  const remove = async (id: number, name: string) => {
    if (!confirm(`确认删除字典「${name}」？`)) return
    try {
      await api.delete(`/system/dict/${id}`)
      setMsg('已删除')
      load()
    } catch (e: any) {
      setMsg(e?.message || '删除失败')
    }
  }

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <h1 className="text-2xl font-semibold text-slate-100">字典管理</h1>
        <p className="mt-1 text-sm text-slate-400">维护系统基础枚举分类（平台、渠道类型、类目等）</p>
      </motion.div>

      {msg && (
        <div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-300">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-xs text-cyan-500 hover:text-cyan-300">关闭</button>
        </div>
      )}

      <motion.div {...fadeIn}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Plus className="h-4 w-4" /> 新增字典分类</div>
          </CardHeader>
          <CardBody>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="编码，如 channel_type"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              />
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="名称，如 流量渠道类型"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              />
              <Button onClick={create}>添加</Button>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      <motion.div {...fadeIn}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> 字典分类列表
              <button onClick={load} className="ml-auto text-xs text-slate-500 hover:text-slate-300">
                <RefreshCw className="inline h-3 w-3" /> 刷新
              </button>
            </div>
          </CardHeader>
          <CardBody>
            {loading ? (
              <div className="py-10 text-center text-sm text-slate-500">加载中…</div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">暂无字典分类</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                      <th className="py-2 pr-3">编码</th>
                      <th className="py-2 pr-3">名称</th>
                      <th className="py-2 pr-3 text-right">条目数</th>
                      <th className="py-2 pr-3">状态</th>
                      <th className="py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} className="border-b border-slate-800/60 text-slate-300 hover:bg-slate-800/30">
                        <td className="py-2 pr-3 font-mono text-xs text-slate-400">{it.code}</td>
                        <td className="py-2 pr-3 text-slate-200">{it.name}</td>
                        <td className="py-2 pr-3 text-right font-mono">{it.item_count}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={it.status === '启用' ? 'success' : 'neutral'}>{it.status}</Badge>
                        </td>
                        <td className="py-2 text-right">
                          <Button variant="ghost" onClick={() => remove(it.id, it.name)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
}
