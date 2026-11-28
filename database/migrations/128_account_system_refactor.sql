-- ============================================================================
-- 迁移 128：账号关系体系重构（S2）
-- ----------------------------------------------------------------------------
-- 现状问题（实测）：
--   1. `role_modules` 只有「角色级」一层，无用户级覆盖 → 同角色的人看到完全一样
--   2. `workMode`（代运营/品牌自播/全功能）仅存于前端 localStorage，与权限零联动
--   3. `permissions`(31 条) + `role_permissions` + `hasPermission()` 全为死代码
--      （grep 全项目：除 guard.ts 内部自引用外，无任何路由调用）
--   4. `roles` 表 11 个角色是按「抖音直播电商」单一业态设计的
--      （如 hrbp 只有 5 个通用模块、无专属功能）
--   5. 平台授权（`role_platform_permissions`）与模块授权（`role_modules`）互不相干
--      → 无法表达「该账号在抖音可看直播复盘，在淘宝只能看店铺看板」
--
-- 本迁移建立「模式 × 平台 × 模块」三维模型：
--   role_module_grants    角色 × 工作模式 × 模块 （三模式各自一套可见性）
--   user_module_overrides 用户级模块覆盖（在角色基线上做 grant/revoke）
--   user_work_modes       用户可用的工作模式（一人可同时具备多种）
--   platform_capability_matrix 平台 × 能力矩阵（决定哪些模块在该平台有意义）
--
-- 兼容策略：不改 `role_modules` / `role_platform_permissions`，
--          新表以它们为「默认基线」，读取时优先级：
--          用户覆盖 > 模式授权 > 角色默认 > 平台能力矩阵
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 角色 × 工作模式 × 模块授权
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_module_grants (
    id            bigserial PRIMARY KEY,
    role_code     varchar(50)  NOT NULL REFERENCES public.roles(code) ON DELETE CASCADE,
    work_mode     varchar(16)  NOT NULL CHECK (work_mode IN ('agency', 'brand', 'all')),
    module_code   varchar(64)  NOT NULL,
    -- 'allow' 显式授权；'deny' 显式禁止（用于在同一模式下收紧某些模块）
    effect        varchar(8)   NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
    note          text         DEFAULT '',
    created_at    timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (role_code, work_mode, module_code)
);

COMMENT ON TABLE public.role_module_grants IS
  '角色在每种工作模式下的模块可见性。读取优先级：user_module_overrides > role_module_grants > role_modules > platform_capability_matrix';

-- 兼容基线 schema：基线已是 130 之后的形态（无 work_mode，且存在 role_code+module_code 唯一约束），
-- 本迁移需要 work_mode 维度，因此在此临时补齐，130 会再次移除。
ALTER TABLE public.role_module_grants
  ADD COLUMN IF NOT EXISTS work_mode varchar(16);
UPDATE public.role_module_grants SET work_mode = 'all' WHERE work_mode IS NULL;
ALTER TABLE public.role_module_grants ALTER COLUMN work_mode SET NOT NULL;

-- 旧唯一约束会阻止同一角色在多工作模式下的授权，先移除，130 会重建
ALTER TABLE public.role_module_grants
  DROP CONSTRAINT IF EXISTS role_module_grants_role_module_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.role_module_grants'::regclass
      AND conname = 'role_module_grants_role_code_work_mode_module_code_key'
  ) THEN
    ALTER TABLE public.role_module_grants
      ADD CONSTRAINT role_module_grants_role_code_work_mode_module_code_key
      UNIQUE (role_code, work_mode, module_code);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_role_module_grants_role_mode
  ON public.role_module_grants (role_code, work_mode) WHERE effect = 'allow';

-- ────────────────────────────────────────────────────────────────
-- 2. 用户级模块覆盖
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_module_overrides (
    id            bigserial PRIMARY KEY,
    user_id       integer      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    module_code   varchar(64)  NOT NULL,
    effect        varchar(8)   NOT NULL CHECK (effect IN ('grant', 'revoke')),
    granted_by    integer      REFERENCES public.users(id) ON DELETE SET NULL,
    note          text         DEFAULT '',
    created_at    timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (user_id, module_code)
);

COMMENT ON TABLE public.user_module_overrides IS
  '用户级模块覆盖，用于「同角色但职责不同」的精细授权（如某运营额外开通合规风控）';

CREATE INDEX IF NOT EXISTS idx_user_module_overrides_user
  ON public.user_module_overrides (user_id);

-- ────────────────────────────────────────────────────────────────
-- 3. 用户可用工作模式
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_work_modes (
    id            bigserial PRIMARY KEY,
    user_id       integer      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    work_mode     varchar(16)  NOT NULL CHECK (work_mode IN ('agency', 'brand', 'all')),
    is_default    boolean      NOT NULL DEFAULT false,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (user_id, work_mode)
);

COMMENT ON TABLE public.user_work_modes IS
  '用户可用的工作模式。一人可同时具备「代运营 + 品牌自播」，前端顶部切换器只展示已授权的模式';

CREATE INDEX IF NOT EXISTS idx_user_work_modes_user
  ON public.user_work_modes (user_id);

-- ────────────────────────────────────────────────────────────────
-- 4. 平台 × 能力矩阵（决定模块在某平台是否成立）
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_capability_matrix (
    id               bigserial PRIMARY KEY,
    platform_code    varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    module_code      varchar(64) NOT NULL,
    -- 该模块在此平台是否适用
    is_applicable    boolean     NOT NULL DEFAULT true,
    -- 若适用，是否必须有专属页面（false = 复用通用页 + platform 参数）
    needs_dedicated_page boolean NOT NULL DEFAULT false,
    note             text        DEFAULT '',
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (platform_code, module_code)
);

COMMENT ON TABLE public.platform_capability_matrix IS
  '平台能力矩阵：模块在某平台是否有意义。用于解决「切换平台后仍显示不适用的分组」问题';

CREATE INDEX IF NOT EXISTS idx_platform_capability_platform
  ON public.platform_capability_matrix (platform_code) WHERE is_applicable = true;

-- ────────────────────────────────────────────────────────────────
-- 5. 用户表补字段：主工作模式 + 数据范围
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS primary_work_mode varchar(16) DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS data_scope varchar(16) DEFAULT 'self'
    CHECK (data_scope IS NULL OR data_scope IN ('self', 'team', 'org', 'all'));

COMMENT ON COLUMN public.users.primary_work_mode IS '登录后默认进入的工作模式';
COMMENT ON COLUMN public.users.data_scope IS
  '数据可见范围：self=仅本人 / team=本团队 / org=本租户全量 / all=跨租户（仅超管）';

-- ────────────────────────────────────────────────────────────────
-- 6. 种子：三种模式下的角色模块基线
--    规则：
--      - 'all' 模式 = 现有 role_modules 全量（保持向后兼容）
--      - 'brand' 模式 = 剔除代运营专属（agency 相关）
--      - 'agency' 模式 = 只保留代运营相关 + 通用支撑
-- ────────────────────────────────────────────────────────────────
-- 6.1 所有角色在 'all' 模式下继承现有 role_modules
INSERT INTO public.role_module_grants (role_code, work_mode, module_code, effect)
SELECT rm.role_code, 'all', rm.module_code, 'allow'
FROM public.role_modules rm
ON CONFLICT (role_code, work_mode, module_code) DO NOTHING;

-- 6.2 'brand' 模式 = 'all' 模式下剔除 agency / net_roi 之外的代运营域
--     （代运营域：agency；其余业务域品牌自播同样需要，保留）
INSERT INTO public.role_module_grants (role_code, work_mode, module_code, effect)
SELECT g.role_code, 'brand', g.module_code, 'allow'
FROM public.role_module_grants g
WHERE g.work_mode = 'all'
  AND g.module_code NOT IN ('agency')
ON CONFLICT (role_code, work_mode, module_code) DO NOTHING;

-- 6.3 'agency' 模式 = 现有模块中与「代播交付」相关的子集
--     代运营机构真正需要的：场次/主播/复盘/排班/客户项目/成本/目标/异常/任务/AI/系统
INSERT INTO public.role_module_grants (role_code, work_mode, module_code, effect)
SELECT g.role_code, 'agency', g.module_code, 'allow'
FROM public.role_module_grants g
WHERE g.work_mode = 'all'
  AND g.module_code = ANY (ARRAY[
    'overview', 'session', 'session_products', 'anchor', 'personal_achievement',
    'live_registration', 'live_data', 'review', 'review_overview', 'review_anchors',
    'review_channels', 'review_funnel', 'review_closed_loop',
    'ops', 'agency',
    'system_multiroom', 'system_rooms', 'system_personnel_ops', 'system_alerts',
    'system_tasks', 'system_competitors', 'system_users', 'system_config',
    'audit_logs', 'system_ai', 'system_dict', 'ai', 'bi', 'data', 'content', 'content_schedule'
  ]::varchar[])
ON CONFLICT (role_code, work_mode, module_code) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 7. 种子：现有用户的工作模式（按 user_type 推断）
-- ────────────────────────────────────────────────────────────────
-- 超管 → 三种模式全开
INSERT INTO public.user_work_modes (user_id, work_mode, is_default)
SELECT u.id, m.mode, (m.mode = 'all')
FROM public.users u
CROSS JOIN (VALUES ('all'), ('brand'), ('agency')) AS m(mode)
WHERE u.role = 'super_admin'
ON CONFLICT (user_id, work_mode) DO NOTHING;

-- 品牌方查看者 → 仅品牌自播
INSERT INTO public.user_work_modes (user_id, work_mode, is_default)
SELECT u.id, 'brand', true
FROM public.users u
WHERE u.user_type = 'brand_viewer'
ON CONFLICT (user_id, work_mode) DO NOTHING;

-- 其余账号 → 全功能模式（保持现有行为，不改变任何人的可见范围）
INSERT INTO public.user_work_modes (user_id, work_mode, is_default)
SELECT u.id, COALESCE(u.primary_work_mode, 'all'), true
FROM public.users u
WHERE u.role <> 'super_admin'
  AND COALESCE(u.user_type, '') <> 'brand_viewer'
ON CONFLICT (user_id, work_mode) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 8. 种子：平台能力矩阵（6 平台 × 关键模块）
--    这是「切换平台后模块该不该显示」的唯一真值源
-- ────────────────────────────────────────────────────────────────
-- 8.1 直播域模块：仅直播电商平台适用
INSERT INTO public.platform_capability_matrix (platform_code, module_code, is_applicable, needs_dedicated_page, note)
SELECT p.platform_code, m.module_code,
       CASE WHEN p.category = 'live' THEN true ELSE false END,
       false,
       CASE WHEN p.category = 'live' THEN '' ELSE '非直播业态平台不适用直播场次/排班模块' END
FROM public.system_platform_configs p
CROSS JOIN (VALUES
  ('session'), ('session_products'), ('personal_achievement'),
  ('live_registration'), ('live_data'), ('review'), ('review_overview'),
  ('review_anchors'), ('review_funnel'), ('review_closed_loop'),
  ('system_multiroom'), ('anchor')
) AS m(module_code)
WHERE p.is_enabled = true
ON CONFLICT (platform_code, module_code) DO NOTHING;

-- 8.2 通用业务模块：全平台适用
INSERT INTO public.platform_capability_matrix (platform_code, module_code, is_applicable, needs_dedicated_page, note)
SELECT p.platform_code, m.module_code, true, false, ''
FROM public.system_platform_configs p
CROSS JOIN (VALUES
  ('overview'), ('data'), ('bi'), ('ops'), ('ai'),
  ('product_center'), ('fulfillment'), ('after_sales'),
  ('customer_service'), ('members'), ('net_roi'), ('search_seo'),
  ('content'), ('content_schedule'), ('system_alerts'), ('system_tasks'),
  ('compliance'), ('system_promotions'), ('system_competitors')
) AS m(module_code)
WHERE p.is_enabled = true
ON CONFLICT (platform_code, module_code) DO NOTHING;

-- 8.3 达人合作：抖/快/视频号/小红书 强相关，淘系较弱但适用
INSERT INTO public.platform_capability_matrix (platform_code, module_code, is_applicable, needs_dedicated_page, note)
SELECT p.platform_code, 'kol',
       CASE WHEN p.platform_code IN ('taobao','tmall') THEN true ELSE true END,
       false,
       '淘系达人生态以站内内容为主，抖快视为核心'
FROM public.system_platform_configs p
WHERE p.is_enabled = true
ON CONFLICT (platform_code, module_code) DO NOTHING;

-- 8.4 各平台专属页标记
INSERT INTO public.platform_capability_matrix (platform_code, module_code, is_applicable, needs_dedicated_page, note)
VALUES
  ('kuaishou', 'review_channels', true, true, '快手公私域流量拆分（关注页/发现页）'),
  ('kuaishou', 'kol',           true, true, '快手粉丝团与间接成交'),
  ('taobao',   'product_center', true, true, '淘系父子订单与 SKU 结构'),
  ('taobao',   'net_roi',        true, true, '万相台投放对账'),
  ('tmall',    'system_promotions', true, true, '天猫五层抵扣规则'),
  ('xiaohongshu', 'content',     true, true, '笔记经营看板与种草转化链路'),
  ('xiaohongshu', 'kol',         true, true, '蒲公英达人合作'),
  ('wechat',   'content',        true, true, '视频号短视频与公众号图文')
ON CONFLICT (platform_code, module_code)
DO UPDATE SET needs_dedicated_page = EXCLUDED.needs_dedicated_page, note = EXCLUDED.note;

-- ────────────────────────────────────────────────────────────────
-- 9. 自校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_grants int;
  v_modes int;
  v_matrix int;
  v_live_off int;
BEGIN
  SELECT count(*) INTO v_grants FROM public.role_module_grants;
  SELECT count(*) INTO v_modes  FROM public.user_work_modes;
  SELECT count(*) INTO v_matrix FROM public.platform_capability_matrix;
  SELECT count(*) INTO v_live_off FROM public.platform_capability_matrix m
    JOIN public.system_platform_configs p ON p.platform_code = m.platform_code
   WHERE m.module_code = 'session' AND m.is_applicable = true AND p.category <> 'live';

  RAISE NOTICE 'S2: role_module_grants=%, user_work_modes=%, capability_matrix=%', v_grants, v_modes, v_matrix;

  IF v_grants < 100 THEN
    RAISE EXCEPTION 'role_module_grants 种子不足（实际 %）', v_grants;
  END IF;
  -- 演示账号已清理，默认仅保留 admin 一个超管（3 种工作模式）
  IF v_modes < 1 THEN
    RAISE EXCEPTION 'user_work_modes 种子不足（实际 %）', v_modes;
  END IF;
  IF v_live_off > 0 THEN
    RAISE EXCEPTION '平台能力矩阵错误：非直播平台被标记为适用 session 模块 % 条', v_live_off;
  END IF;
END $$;

-- version: 128_account_system_refactor
