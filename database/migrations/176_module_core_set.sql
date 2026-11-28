-- ============================================================================
-- 176：模块核心集重划（W1）
-- ----------------------------------------------------------------------------
-- 166 号迁移把 28 个模块标为 is_core=true，导致初始化「选择功能」形同虚设。
-- 本迁移把「系统运行必需 + 数据底座」限定为 9 个，其余业务域/AI 域全部可关。
--
-- 关闭语义：只关 UI 入口与 AI 工具访问，不停止事实数据入库。
-- ============================================================================

BEGIN;

-- 系统必需（7）+ 数据底座（2）
UPDATE public.system_modules
   SET is_core = true,
       is_enabled = true
 WHERE code IN (
   'system_users', 'system_config', 'system_dict', 'system_ai', 'audit_logs',
   'overview', 'data',
   'bi', 'session'
 );

-- 其余全部可关（业务域 + AI 域 + 后续新增模块默认非核心）
UPDATE public.system_modules
   SET is_core = false
 WHERE code NOT IN (
   'system_users', 'system_config', 'system_dict', 'system_ai', 'audit_logs',
   'overview', 'data',
   'bi', 'session'
 );

-- 兜底：后续新增模块默认非核心、默认关闭，必须显式授权
ALTER TABLE public.system_modules
  ALTER COLUMN is_core SET DEFAULT false;

COMMIT;
