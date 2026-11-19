import { useState, useEffect, useCallback } from 'react'
import { Link2, Plus, Trash2, RefreshCw } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

interface EntityAlias {
  id: number
  entity_type: string
  source_platform: string
  platform_name: string | null
  external_id: string
  external_name: string
  internal_id: string
  internal_code: string
  valid_from: string
  valid_to: string
}

interface FieldMappingRule {
  id: number
  mapping_code: string
  version: number
  source_platform: string
  dataset_type: string
  source_field: string
  canonical_field: string
  transform: string
  required: boolean
  approval_status: string
}

export function EntityAliasPanel() {
  const [aliases, setAliases] = useState<EntityAlias[]>([])
  const [mappings, setMappings] = useState<FieldMappingRule[]>([])
  const [loading, setLoading] = useState(false)
  const [aliasForm, setAliasForm] = useState({
    entityType: 'product',
    sourcePlatform: 'douyin',
    externalId: '',
    externalName: '',
    internalId: '',
    internalCode: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, m] = await Promise.all([
        api.get<EntityAlias[]>('/governance/entity-aliases'),
        api.get<FieldMappingRule[]>('/governance/field-mappings'),
      ])
      setAliases(Array.isArray(a) ? a : [])
      setMappings(Array.isArray(m) ? m : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveAlias = async () => {
    if (!aliasForm.externalId.trim() || !aliasForm.internalId.trim()) return
    await api.post('/governance/entity-aliases', {
      ...aliasForm,
      externalId: aliasForm.externalId.trim(),
      internalId: Number(aliasForm.internalId),
    })
    setAliasForm({ ...aliasForm, externalId: '', externalName: '', internalId: '', internalCode: '' })
    await load()
  }

  const removeAlias = async (id: number) => {
    await api.delete(`/governance/entity-aliases/${id}`)
    await load()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="跨平台实体 ID / SPU / 主播统一别名映射 (entity_aliases)"
          subtitle="将各平台异构商品/店铺/达人 ID 对齐到内部主数据唯一 ID，解决跨平台重算归因"
          actions={
            <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 刷新
            </Button>
          }
        />
        <CardBody className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
            <select value={aliasForm.entityType} onChange={(e) => setAliasForm({ ...aliasForm, entityType: e.target.value })} className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-[var(--text-secondary)]">
              <option value="product">product</option>
              <option value="shop">shop</option>
              <option value="anchor">anchor</option>
              <option value="kol">kol</option>
            </select>
            <select value={aliasForm.sourcePlatform} onChange={(e) => setAliasForm({ ...aliasForm, sourcePlatform: e.target.value })} className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-[var(--text-secondary)]">
              {['douyin', 'taobao', 'tmall', 'jd', 'pdd', 'kuaishou', 'xiaohongshu'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <input placeholder="外部平台 ID" value={aliasForm.externalId} onChange={(e) => setAliasForm({ ...aliasForm, externalId: e.target.value })} className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-[var(--text-secondary)]" />
            <input placeholder="外部名称(选填)" value={aliasForm.externalName} onChange={(e) => setAliasForm({ ...aliasForm, externalName: e.target.value })} className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-[var(--text-secondary)]" />
            <input type="number" placeholder="内部主数据 ID" value={aliasForm.internalId} onChange={(e) => setAliasForm({ ...aliasForm, internalId: e.target.value })} className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-[var(--text-secondary)]" />
            <Button size="sm" variant="primary" onClick={saveAlias}>
              <Plus className="w-3.5 h-3.5" /> 绑定映射
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-orbit-border text-[var(--text-muted)]">
                  <th className="text-left px-3 py-2">实体类型</th>
                  <th className="text-left px-3 py-2">来源平台</th>
                  <th className="text-left px-3 py-2">外部 ID / 名称</th>
                  <th className="text-left px-3 py-2">内部 ID / 编码</th>
                  <th className="text-right px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {aliases.map((a) => (
                  <tr key={a.id} className="border-b border-orbit-border/60">
                    <td className="px-3 py-2"><Badge variant="info">{a.entity_type}</Badge></td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{a.platform_name || a.source_platform}</td>
                    <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">{a.external_id} {a.external_name ? `(${a.external_name})` : ''}</td>
                    <td className="px-3 py-2 font-mono text-status-ai">#{a.internal_id} {a.internal_code}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeAlias(a.id)} className="text-[var(--text-muted)] hover:text-status-danger">
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
                {aliases.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-[var(--text-muted)]">暂无跨平台主体别名记录</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="字段映射治理规则 (field_mapping_rules)" subtitle="标准规范表字段与源表导入列血缘映射清单" />
        <CardBody className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-orbit-border text-[var(--text-muted)]">
                  <th className="text-left px-4 py-2">规则集 / 版本</th>
                  <th className="text-left px-4 py-2">平台 / 数据集</th>
                  <th className="text-left px-4 py-2">源字段</th>
                  <th className="text-left px-4 py-2">规范字段</th>
                  <th className="text-left px-4 py-2">审批状态</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id} className="border-b border-orbit-border/60">
                    <td className="px-4 py-2 font-mono text-[var(--text-secondary)]"><Link2 className="w-3 h-3 inline mr-1 text-status-ai" />{m.mapping_code} v{m.version}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)]">{m.source_platform} · {m.dataset_type}</td>
                    <td className="px-4 py-2 font-mono text-[var(--text-secondary)]">{m.source_field}</td>
                    <td className="px-4 py-2 font-mono text-status-success">{m.canonical_field}</td>
                    <td className="px-4 py-2"><Badge variant={m.approval_status === 'approved' ? 'success' : 'warning'}>{m.approval_status}</Badge></td>
                  </tr>
                ))}
                {mappings.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-[var(--text-muted)]">暂无配置规则（使用系统内置平台源映射字典）</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
