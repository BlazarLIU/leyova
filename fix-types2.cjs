const fs = require('fs')
const A = String.fromCharCode(64) + '/'

// 1) 修正 platform-navigation.ts 的类型导入
const p1 = '/home/leyova/apps/web/src/data/platform-navigation.ts'
let s = fs.readFileSync(p1, 'utf8')
const badLine = "import type { NavSection } from 'at types'"
const goodLine = "import type { NavSection } from '" + A + "types'"
if (!s.includes(badLine)) throw new Error('bad import line not found')
s = s.replace(badLine, goodLine)
fs.writeFileSync(p1, s, 'utf8')
console.log('import fixed:', goodLine)

// 2) Sidebar.tsx 补 NavSection 类型导入
const p2 = '/home/leyova/apps/web/src/components/layout/Sidebar.tsx'
let t = fs.readFileSync(p2, 'utf8')
const oldT = "import type { NavItem, RoleInfo } from '" + A + "types'"
if (!t.includes(oldT)) throw new Error('sidebar type import missing')
t = t.replace(oldT, "import type { NavItem, NavSection, RoleInfo } from '" + A + "types'")

// 3) 给剩余未标注的 map/filter 参数补类型
t = t.replace(/\.filter\(\(item\)/g, '.filter((item: NavItem)')
t = t.replace(/\.map\(\(item\)/g, '.map((item: NavItem)')
t = t.replace(/\.filter\(\(child\)/g, '.filter((child: NavItem)')
t = t.replace(/\.map\(\(child\)/g, '.map((child: NavItem)')
t = t.replace(/\.filter\(\(item: any\)/g, '.filter((item: NavItem)')
t = t.replace(/\.map\(\(item: any\)/g, '.map((item: NavItem)')
t = t.replace(/\.filter\(\(child: any\)/g, '.filter((child: NavItem)')
t = t.replace(/\.map\(\(child: any\)/g, '.map((child: NavItem)')

fs.writeFileSync(p2, t, 'utf8')
console.log('sidebar patched')
