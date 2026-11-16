import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { api } from '@/services/api'
import { PersonnelSection } from './PersonnelSection'

/** 运营人员管理独立页（对应 system_personnel_ops 模块，支持 HRBP / Admin / Super Admin） */
export function PersonnelPage() {
  const [userRole, setUserRole] = useState('super_admin')
  const [anchors, setAnchors] = useState<any[]>([])
  const [operators, setOperators] = useState<any[]>([])
  const [managers, setManagers] = useState<any[]>([])

  useEffect(() => {
    api.get<any>('/auth/me').then((res) => { if (res?.user?.role) setUserRole(res.user.role) }).catch(() => {})
    api.get<any[]>('/personnel/anchors').then(setAnchors).catch(() => {})
    api.get<any[]>('/personnel/operators').then(setOperators).catch(() => {})
    api.get<any[]>('/personnel/managers').then(setManagers).catch(() => {})
  }, [])

  const handleDataChange = (tab: 'anchor' | 'operator' | 'manager', data: any[]) => {
    if (tab === 'anchor') setAnchors(data)
    else if (tab === 'operator') setOperators(data)
    else setManagers(data)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-100">运营人员管理</h1>
          <p className="text-sm text-slate-400">维护主播、中控与运营人员档案及等级配置</p>
        </div>
      </div>

      <PersonnelSection
        userRole={userRole}
        anchors={anchors}
        operators={operators}
        managers={managers}
        onDataChange={handleDataChange}
      />
    </div>
  )
}

