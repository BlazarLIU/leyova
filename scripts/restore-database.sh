#!/usr/bin/env bash
# ==============================================================================
# scripts/restore-database.sh — Leyova 数据库一键全量恢复脚本
#
# 依据 WP-08 交付规范：
# - 支持从 .sql.gz 备份包全量恢复数据库
# - 具备恢复前完整性校验
# - 恢复后自动运行 node database/migrate.js 补齐版本
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ $# -lt 1 ]; then
  echo "使用方法: $0 <backup_file.sql.gz>"
  echo "示例:     $0 database/backups/leyova_backup_20261123_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "错误: 备份文件不存在: ${BACKUP_FILE}" >&2
  exit 1
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-55432}"
DB_USER="${DB_USER:-leyova}"
DB_NAME="${DB_NAME:-leyova}"

echo "==============================================================="
echo "   Leyova 数据库全量恢复"
echo "   源备份包:   ${BACKUP_FILE}"
echo "   目标数据库: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "==============================================================="

# 验证压缩包完整性
if ! gzip -t "${BACKUP_FILE}"; then
  echo "错误: 备份包损坏，无法解压！" >&2
  exit 1
fi

echo "正在导入数据到 ${DB_NAME}..."
gunzip -c "${BACKUP_FILE}" | psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -v ON_ERROR_STOP=1 \
  --quiet

echo "正在执行数据库增量迁移校验..."
node "${ROOT_DIR}/database/migrate.js"

echo ""
echo "✓ 数据库恢复完成且增量迁移状态正常！"
echo "==============================================================="
