-- 169_module_parameters.sql — 系统运维-系统配置「模块参数」多层级参数体系
--
-- 解决痛点：各模块参数（如 HRBP 提成激励、排班工时限制、品类退货率阈值）硬编码与一锅烩拉通
-- 支持分层覆盖架构：L1 全局默认 -> L2 岗位/主播等级/品类基准 -> L3 个人/直播间专属覆盖

CREATE TABLE IF NOT EXISTS public.system_module_parameters (
    id SERIAL PRIMARY KEY,
    module_code VARCHAR(50) NOT NULL,              -- 业务模块: 'hrbp', 'schedule', 'traffic', 'assortment', 'fulfillment', 'compliance'
    param_key VARCHAR(100) NOT NULL,              -- 参数标识: 'anchor_commission_matrix', 'max_daily_stream_hours'
    param_name VARCHAR(100) NOT NULL,             -- 参数显示名
    param_type VARCHAR(30) NOT NULL DEFAULT 'json',-- 'number' | 'percentage' | 'json' | 'string' | 'boolean'
    scope_type VARCHAR(30) NOT NULL DEFAULT 'global', -- 'global' | 'tier' | 'category' | 'role' | 'entity'
    scope_id VARCHAR(50) NOT NULL DEFAULT 'default',-- 'default', 'S', 'A', '美妆护肤', 'anchor:1', 'room:1'
    param_value JSONB NOT NULL,                   -- 参数配置体
    unit VARCHAR(20) DEFAULT '',                  -- 单位: '%', '元', 'h', '万元'
    description TEXT,                             -- 参数说明与业务建议
    updated_by VARCHAR(50),                       -- 最后修改人
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_module_param_scope UNIQUE (module_code, param_key, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_module_param_lookup ON public.system_module_parameters(module_code, scope_type, scope_id);

COMMENT ON TABLE public.system_module_parameters IS '系统业务模块多层级参数配置表（全局默认/层级品类基准/个体覆盖）';
