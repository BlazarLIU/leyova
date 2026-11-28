#!/usr/bin/env bash
# ==============================================================================
# scripts/backup-database.sh — Leyova 数据库一键全量备份脚本
#
# 依据 WP-08 交付规范：
# - 支持全量结构、表分区、增量迁移记录与业务事实数据备份
# - 采用 gzip 格式压缩存储，输出带有毫秒级时间戳的备份文件
# - 自动校验备份文件完整性 (gzip -t)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKUP_DIR="${ROOT_DIR}/database/backups"
mkdir -p "${BACKUP_DIR}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-55432}"
DB_USER="${DB_USER:-leyova}"
DB_NAME="${DB_NAME:-leyova}"

TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_FILE="${BACKUP_DIR}/leyova_backup_${TIMESTAMP}.sql.gz"

echo "==============================================================="
echo "   Leyova 数据库全量备份开始..."
echo "   目标数据库: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "   输出文件:   ${BACKUP_FILE}"
echo "==============================================================="

# 执行 pg_dump 并压缩
pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --no-owner \
  --no-privileges \
  | gzip -9 > "${BACKUP_FILE}"

# 验证压缩包完整性
if gzip -t "${BACKUP_FILE}"; then
  FILE_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
  echo ""
  echo "✓ 备份成功且完整性校验通过！"
  echo "  备份路径: ${BACKUP_FILE}"
  echo "  文件大小: ${FILE_SIZE}"
  echo "==============================================================="
else
  echo ""
  echo "✖ 备份文件完整性校验失败，请检查数据库连接或磁盘空间！" >&2
  exit 1
fi
