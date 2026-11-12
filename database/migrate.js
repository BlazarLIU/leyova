#!/usr/bin/env node

/**
 * database/migrate.js — Leyova 数据库一键全自动初始化与迁移执行器
 * 
 * 适用于：
 * 1. 开源新机器从零部署（自动跑 01_schema -> 02_seed -> 03_demo -> migrations/*）
 * 2. 存量数据库增量升级（自动检测 schema_migrations 补跑缺失版本）
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const require = createRequire(import.meta.url)
let pg
try {
  pg = require('pg')
} catch {
  pg = require(path.join(rootDir, 'apps/api/node_modules/pg'))
}

// 1. 读取环境变量
function loadEnv() {
  const envPath = path.join(rootDir, 'apps/api/.env')
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim()
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
        if (!process.env[key]) {
          process.env[key] = val
        }
      }
    }
  }
}

loadEnv()

const dbConfig = {
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${
      process.env.DB_HOST || '127.0.0.1'
    }:${process.env.DB_PORT || '55432'}/${process.env.DB_NAME || 'leyova'}`,
}

const pool = new pg.Pool(dbConfig)

async function run() {
  console.log('\n🚀 [Leyova Database Migration Runner]')
  console.log(`🔗 连接数据库: ${dbConfig.connectionString.replace(/:[^:@]*@/, ':****@')}`)

  const client = await pool.connect()
  try {
    // 2. 检查 schema_migrations 表是否存在
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version character varying(100) PRIMARY KEY,
        name character varying(255),
        applied_at timestamp with time zone DEFAULT now()
      );
    `)

    // 检查核心表是否存在（如 dim_shop 或 users）
    const checkCore = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('users', 'live_rooms', 'dim_shop');
    `)

    // 如果核心表都不存在，说明是空库，先执行基线 01, 02, 03
    if (checkCore.rows.length === 0) {
      console.log('📦 检测到全新空数据库，开始执行全量基线建表与种子数据...')

      const baselineFiles = ['01_schema.sql', '02_seed.sql', '03_demo_data.sql']
      for (const baseFile of baselineFiles) {
        const filePath = path.join(__dirname, baseFile)
        if (fs.existsSync(filePath)) {
          console.log(`  ⏳ 执行基线文件: ${baseFile}...`)
          const sql = fs.readFileSync(filePath, 'utf8')
          await client.query(sql)
          await client.query(`SELECT pg_catalog.set_config('search_path', 'public', false)`)
          console.log(`  ✅ ${baseFile} 执行完毕`)
        }
      }
    }

    // 3. 执行 migrations/ 下的增量脚本
    const migrationsDir = path.join(__dirname, 'migrations')
    if (fs.existsSync(migrationsDir)) {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort()

      const appliedRes = await client.query('SELECT version FROM public.schema_migrations')
      const appliedSet = new Set(appliedRes.rows.map((r) => r.version))

      let newlyApplied = 0
      for (const file of files) {
        const version = path.basename(file, '.sql')
        if (!appliedSet.has(version)) {
          console.log(`  🔄 应用增量迁移: ${file}...`)
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
          
          await client.query('BEGIN')
          try {
            await client.query(sql)
            await client.query(
              'INSERT INTO public.schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
              [version, version]
            )
            await client.query('COMMIT')
            console.log(`  ✅ 成功应用迁移: ${version}`)
            newlyApplied++
          } catch (mErr) {
            await client.query('ROLLBACK')
            console.error(`  ❌ 迁移失败 [${version}]:`, mErr.message)
            throw mErr
          }
        }
      }

      if (newlyApplied === 0) {
        console.log('✨ 数据库结构已是最新状态，无待应用的增量迁移。')
      } else {
        console.log(`🎉 成功执行 ${newlyApplied} 个增量迁移文件！`)
      }
    }

    console.log('🏁 [Leyova 数据库全量准备就绪！]\n')
  } catch (err) {
    console.error('\n❌ 数据库迁移过程发生异常:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
