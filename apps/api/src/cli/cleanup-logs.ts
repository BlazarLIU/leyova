import { readdirSync, renameSync, statSync, unlinkSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { env } from '../config/env.js'

// 日志根目录：优先 env.LOG_ROOT，否则为当前工作目录下的 logs/
const ROOT = resolve(env.LOG_ROOT || join(process.cwd(), 'logs'))
const LOG_DIR = ROOT
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const KEEP_COUNT = 5

const MANAGED_FILES = [
  'system.log', 'actions.log', 'php_errors.log',
  'access.log', 'debug.log', 'error.log',
]

interface FileStat {
  path: string
  size: number
  sizeFormatted: string
  modified: string
  backups: number
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  if (bytes <= 0) return '0 B'
  const pow = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, pow)).toFixed(2)} ${units[pow]}`
}

function timestamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}-${String(d.getMinutes()).padStart(2,'0')}-${String(d.getSeconds()).padStart(2,'0')}`
}

function cleanOldBackups(filePath: string): void {
  const parsed = parseFilePath(filePath)
  const pattern = join(parsed.dir, `${parsed.name}_*.${parsed.ext}`)
  
  let files: string[]
  try { files = readdirSync(parsed.dir).filter(f => f.startsWith(`${parsed.name}_`) && f.endsWith(`.${parsed.ext}`)).map(f => join(parsed.dir, f)) }
  catch { return }
  
  files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  
  const toDelete = files.slice(KEEP_COUNT)
  for (const old of toDelete) {
    try {
      unlinkSync(old)
      console.log(`  已删除旧备份: ${old}`)
    } catch (e) {
      console.error(`  无法删除: ${old} — ${(e as Error).message}`)
    }
  }
}

function parseFilePath(fullPath: string) {
  const parts = fullPath.replace(/\\/g, '/').split('/')
  const filename = parts.pop()!
  const dir = parts.join('/')
  const dotIdx = filename.lastIndexOf('.')
  return { dir, name: dotIdx > 0 ? filename.slice(0, dotIdx) : filename, ext: dotIdx > 0 ? filename.slice(dotIdx + 1) : '' }
}

function rotateFile(filePath: string): boolean {
  if (!existsSync(filePath)) return true
  
  const size = statSync(filePath).size
  if (size < MAX_SIZE) return true
  
  const backupPath = join(parseFilePath(filePath).dir, `${parseFilePath(filePath).name}_${timestamp()}.${parseFilePath(filePath).ext}`)
  
  try {
    renameSync(filePath, backupPath)
    console.log(`  滚写: ${filePath} -> ${backupPath}`)
    cleanOldBackups(filePath)
    return true
  } catch (e) {
    console.error(`  滚写失败: ${filePath} — ${(e as Error).message}`)
    return false
  }
}

function rotateAllFiles(): { processed: number; rotated: number; errors: string[] } {
  const result = { processed: 0, rotated: 0, errors: [] as string[] }
  
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true })
  }
  
  for (const logFile of MANAGED_FILES) {
    const fullPath = join(LOG_DIR, logFile)
    result.processed++
    
    if (rotateFile(fullPath)) {
      // Check if backup was created (file was actually rotated)
      const parsed = parseFilePath(fullPath)
      const backups = readdirSync(parsed.dir)
        .filter(f => f.startsWith(`${parsed.name}_`) && f.endsWith(`.${parsed.ext}`))
      if (backups.length > 0) result.rotated++
    } else {
      result.errors.push(`处理日志文件失败: ${fullPath}`)
    }
  }
  
  return result
}

function getStatistics(): FileStat[] {
  return MANAGED_FILES
    .map(f => join(LOG_DIR, f))
    .filter(existsSync)
    .map(fp => {
      const parsed = parseFilePath(fp)
      const s = statSync(fp)
      const backups = readdirSync(parsed.dir).filter(f => f.startsWith(`${parsed.name}_`) && f.endsWith(`.${parsed.ext}`))
      return {
        path: fp,
        size: s.size,
        sizeFormatted: formatBytes(s.size),
        modified: new Date(s.mtimeMs).toISOString().replace('T', ' ').slice(0, 19),
        backups: backups.length,
      }
    })
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args[0] === 'cleanup') {
    console.log(`[${new Date().toISOString()}] 开始日志清理任务...`)
    const results = rotateAllFiles()
    
    console.log(`\n处理完成:`)
    console.log(`  - 检查文件数: ${results.processed}`)
    console.log(`  - 滚写文件数: ${results.rotated}`)
    console.log(`  - 错误数: ${results.errors.length}`)
    
    if (results.errors.length > 0) {
      console.log('\n错误信息:')
      for (const err of results.errors) console.log(`  - ${err}`)
    }
    
    console.log('\n日志统计:')
    const stats = getStatistics()
    for (const s of stats) {
      console.log(`  - ${s.path.split('/').pop()}: ${s.sizeFormatted} (备份: ${s.backups}个)`)
    }
    
    return
  }
  
  // Default: print stats
  const stats = getStatistics()
  console.log('当前日志文件状态:')
  if (stats.length === 0) {
    console.log('  (无日志文件)')
  } else {
    for (const s of stats) {
      console.log(`  - ${s.path.split('/').pop()}: ${s.sizeFormatted} (${s.modified}, 备份: ${s.backups}个)`)
    }
  }
  
  console.log(`\n用法: npx tsx ${process.argv[1]} cleanup    — 执行日志滚写清理`)
}

main().catch(console.error)