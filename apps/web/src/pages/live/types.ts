// ─── 个人达成 ───
export interface AttendanceDay {
  duration: number
  count: number
  nightShift: boolean
}

export interface AttendancePerson {
  id: number
  name: string
  role: 'anchor' | 'operator'
  status: number
}

export interface AnchorStat {
  id: number
  name: string
  totalDuration: number
  totalGmv: number
  totalGsv: number
  avgGsv: number
  totalReturn: number
  nightShiftCount: number
}

export interface OperatorStat {
  id: number
  name: string
  streamCount: number
  totalGmv: number
  totalGsv: number
  avgGsv: number
  nightShiftCount: number
}

export interface AttendanceResponse {
  year: number
  month: number
  daysInMonth: number
  dates: { date: string; day: number; weekday: string; isWeekend: boolean }[]
  anchors: AttendancePerson[]
  operators: AttendancePerson[]
  attendanceData: Record<string, Record<string, AttendanceDay>>
  anchorStats: AnchorStat[]
  operatorStats: OperatorStat[]
}

export interface DateInfo {
  date: string
  day: number
  weekday: string
  isWeekend: boolean
}

// ─── 直播登记 ───
export interface LiveRegistrationForm {
  date: string
  anchorId: number
  roomId: number
  operatorId: number
  startTime: string
  endTime: string
  duration: number
  gmv: number
  returnAmount: number
  gsv: number
  remark: string
  adPlatform?: string
  adType?: string
  adCost?: number
  adGsv?: number
  adStatus?: number
}

export interface LiveRegFormData {
  anchors: { id: number; name: string }[]
  rooms: { id: number; name: string }[]
  operators: { id: number; name: string }[]
  userRole: string
  userRoomIds?: number[]
}