/**
 * ingestion-service.ts — 双轨数据接入中枢服务 (Ingestion Service)
 * 
 * 严格遵循《数据接入规范 V1.0》：
 * 1. 客户类型 1 (API 直连): 调用平台官方适配器，API 原始报文落库 raw_records；
 * 2. 客户类型 2 (手动上传): 受控文件预检、哈希去重、防注入、原始行无损落库 raw_records；
 * 3. 原始数据不可变：原始文件和原始行一律留痕，绝不覆盖；
 * 4. 自动串联后续清洗与独立质量校验流程。
 */

import type { Pool } from 'pg'
import * as XLSX from 'xlsx'
import { computeSha256, decryptCredential, sanitizeCsvCell } from '../security.js'
import { governancePlatformRegistry, isRealCredentials, type PlatformCredentials } from '../adapters/index.js'
import { CleanerService } from '../cleaning/cleaner-service.js'
import { ValidationService } from '../validation/validation-service.js'

export interface ApiSyncOptions {
  platformCode: string
  shopId: number
  datasetType?: 'orders' | 'refunds'
  sinceTime?: string
  userId?: number
}

export interface FileUploadOptions {
  platformCode: string
  shopId: number
  datasetType?: 'orders' | 'refunds'
  fileBuffer: Buffer
  originalFilename: string
  mimeType?: string
  userId?: number
}

export class IngestionService {
  private cleanerService: CleanerService
  private validationService: ValidationService

  constructor(private pool: Pool) {
    this.cleanerService = new CleanerService(pool)
    this.validationService = new ValidationService(pool)
  }

  /**
   * 客户类型 1: 官方 OpenAPI 触发接入与清洗校验全流水线
   */
  async ingestFromApi(options: ApiSyncOptions) {
    const { platformCode, shopId, datasetType = 'orders', sinceTime, userId } = options
    const adapter = governancePlatformRegistry.get(platformCode)
    if (!adapter) {
      throw new Error(`未支持的平台代码: ${platformCode}`)
    }

    const client = await this.pool.connect()
    try {
      // 1. 读取店铺凭证
      const shopRes = await client.query(
        `SELECT id, shop_name, platform_code, auth_status, auth_token_info
         FROM dim_shop WHERE id = $1`,
        [shopId]
      )
      if (shopRes.rows.length === 0) {
        throw new Error(`店铺不存在: ${shopId}`)
      }
      const shop = shopRes.rows[0]

      // 修复 P0-1 & P0-2：若店铺为手动导入模式或未授权，严禁生成伪造数据污染生产数据库
      if (shop.auth_status === 'manual_only' || shop.auth_status === 'unauthorized') {
        return {
          success: true,
          batchId: null,
          message: `店铺 [${shop.shop_name}] 处于 ${shop.auth_status} 状态，跳过外部 API 自动拉取`,
          recordsCount: 0,
        }
      }

      const tokenInfo = shop.auth_token_info || {}
      const credentials: PlatformCredentials = {
        appKey: decryptCredential(String(tokenInfo.appKey || '')),
        appSecret: decryptCredential(String(tokenInfo.appSecret || '')),
        accessToken: decryptCredential(String(tokenInfo.accessToken || '')),
        refreshToken: tokenInfo.refreshToken ? decryptCredential(String(tokenInfo.refreshToken)) : undefined,
        shopId,
        platformCode,
        authStatus: shop.auth_status,
        gatewayBaseUrl: tokenInfo.gatewayBaseUrl,
        oauthBaseUrl: tokenInfo.oauthBaseUrl,
        extra: tokenInfo.extra,
      }

      if (!isRealCredentials(credentials)) {
        return {
          success: true,
          batchId: null,
          message: `店铺 [${shop.shop_name}] 尚未配置有效的官方生产 API AccessToken，跳过自动拉取，杜绝假数据污染`,
          recordsCount: 0,
        }
      }

      // 2. 调用平台适配器拉取数据
      const fetchResult =
        datasetType === 'refunds'
          ? await adapter.fetchRefunds(credentials, { sinceTime })
          : await adapter.fetchOrders(credentials, { sinceTime })

      if (!fetchResult.success) {
        return {
          success: false,
          batchId: null,
          message: fetchResult.error || '开放平台 API 拉取失败',
          recordsCount: 0,
        }
      }
      if (fetchResult.records.length === 0) {
        return {
          success: true,
          batchId: null,
          message: '未拉取到新数据或店铺处于手动模式',
          recordsCount: 0,
        }
      }

      // 3. 创建 import_batches 记录
      const batchNo = `API_${platformCode.toUpperCase()}_${Date.now()}`
      const batchRes = await client.query(
        `INSERT INTO import_batches
           (batch_no, source_platform, store_id, dataset_type, source_channel, status, total_raw_rows, created_by)
         VALUES ($1, $2, $3, $4, 'api', 'PROCESSING', $5, $6)
         RETURNING id`,
        [batchNo, platformCode, shopId, datasetType, fetchResult.records.length, userId || null]
      )
      const batchId = Number(batchRes.rows[0].id)

      // 4. 将 API 原始报文落入 raw_records (按月物理分区)
      const bizDate = fetchResult.records[0].bizDate || new Date().toISOString().slice(0, 10)
      for (let i = 0; i < fetchResult.records.length; i++) {
        const record = fetchResult.records[i] as any
        const rawJson = fetchResult.rawResponses?.[i] || record
        const payloadHash = computeSha256(JSON.stringify(rawJson))
        const bizKey = `${platformCode}:${shopId}:${record.sourceRefundId || record.sourceOrderId}`

        await client.query(
          `INSERT INTO raw_records
             (batch_id, biz_date, sheet_name, row_no, raw_payload, payload_hash, source_business_key)
           VALUES ($1, $2, 'API_SYNC', $3, $4, $5, $6)`,
          [batchId, bizDate, i + 1, JSON.stringify(rawJson), payloadHash, bizKey]
        )
      }

      // 5. 触发清洗引擎
      const cleanResult = await this.cleanerService.cleanBatch(batchId)

      // 6. 触发独立质量校验引擎
      const validationResult = await this.validationService.validateCleaningRun(cleanResult.runId)

      return {
        success: true,
        batchId,
        batchNo,
        recordsCount: fetchResult.records.length,
        cleanResult,
        validationResult,
      }
    } finally {
      client.release()
    }
  }

  /**
   * 客户类型 2: 手动上传报表文件触发接入与清洗校验全流水线
   */
  async ingestFromFile(options: FileUploadOptions) {
    const { platformCode, shopId, datasetType = 'orders', fileBuffer, originalFilename, mimeType, userId } = options
    const client = await this.pool.connect()

    try {
      // 1. 计算文件 SHA-256 哈希
      const fileHash = computeSha256(fileBuffer)

      // 2. 检测文件是否完全重复上传
      const dupRes = await client.query(
        `SELECT b.id, b.batch_no, b.status, b.created_at
         FROM import_batches b
         WHERE b.file_hash = $1 AND b.source_platform = $2 AND b.store_id = $3
         LIMIT 1`,
        [fileHash, platformCode, shopId]
      )

      if (dupRes.rows.length > 0) {
        const dup = dupRes.rows[0]
        return {
          success: false,
          isDuplicateFile: true,
          existingBatchId: Number(dup.id),
          existingBatchNo: dup.batch_no,
          message: `该文件已于 ${new Date(dup.created_at).toLocaleString('zh-CN')} 上传过 (批次号: ${dup.batch_no})，请勿重复上传！`,
        }
      }

      // 3. 解析 Excel/CSV 文件为原始行 (防宏与防公式注入)
      const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, raw: false })
      const firstSheetName = workbook.SheetNames[0] || 'Sheet1'
      const worksheet = workbook.Sheets[firstSheetName]
      const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: null })

      if (rawRows.length === 0) {
        throw new Error('上传的文件为空，无有效数据行')
      }

      // 4. 创建 import_batches 批次
      const batchNo = `MANUAL_${platformCode.toUpperCase()}_${Date.now()}`
      const batchRes = await client.query(
        `INSERT INTO import_batches
           (batch_no, source_platform, store_id, dataset_type, source_channel, status, file_hash, total_raw_rows, created_by)
         VALUES ($1, $2, $3, $4, 'manual_file', 'PROCESSING', $5, $6, $7)
         RETURNING id`,
        [batchNo, platformCode, shopId, datasetType, fileHash, rawRows.length, userId || null]
      )
      const batchId = Number(batchRes.rows[0].id)

      // 5. 保存 import_files 元数据
      const storagePath = `uploads/raw_files/${platformCode}/${batchNo}_${originalFilename}`
      await client.query(
        `INSERT INTO import_files (batch_id, storage_path, original_filename, file_size_bytes, mime_type, sha256)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [batchId, storagePath, originalFilename, fileBuffer.length, mimeType || 'application/octet-stream', fileHash]
      )

      // 6. 逐行插入 raw_records (防公式注入转义，计算行哈希)
      const today = new Date().toISOString().slice(0, 10)
      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i]
        // 防 CSV 注入转义
        const sanitizedRow: Record<string, any> = {}
        for (const [k, v] of Object.entries(row)) {
          sanitizedRow[k] = sanitizeCsvCell(v)
        }

        const payloadHash = computeSha256(JSON.stringify(sanitizedRow))
        // 尝试从行中提取日期作为分区键
        const rawDate = row['日期'] || row['付款时间'] || row['创建时间'] || row['biz_date']
        const bizDate = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : today

        await client.query(
          `INSERT INTO raw_records
             (batch_id, biz_date, sheet_name, row_no, raw_payload, payload_hash, source_business_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            batchId,
            bizDate,
            firstSheetName,
            i + 1,
            JSON.stringify(sanitizedRow),
            payloadHash,
            row['平台订单号'] || row['订单号'] || row['订单编号'] || null,
          ]
        )
      }

      // 7. 串联触发清洗引擎
      const cleanResult = await this.cleanerService.cleanBatch(batchId)

      // 8. 串联触发独立质量校验引擎
      const validationResult = await this.validationService.validateCleaningRun(cleanResult.runId)

      return {
        success: true,
        batchId,
        batchNo,
        parsedRowsCount: rawRows.length,
        cleanResult,
        validationResult,
      }
    } finally {
      client.release()
    }
  }
}
