-- ============================================================================
-- 迁移 151：补齐 5 个真实直播岗位角色（P1）
-- ----------------------------------------------------------------------------
-- 审计 02 发现：真实直播团队 11 个岗位，系统只有 9 个角色，缺 5 个：
--   场控（floor_manager）/ 拍剪（video_editor）/ 编导（director）
--   客服（cs_agent）/ 仓配（warehouse）
--
-- 后果：这些岗位只能被塞进 employee（只有 3 个模块）
--   → 场控看不到场次看板，拍剪看不到素材库，客服看不到工单
-- ============================================================================

INSERT INTO public.roles (code, name, description) VALUES
  ('floor_manager', '场控',  '负责直播现场执行：场次跟进、节奏把控、道具准备、突发处理'),
  ('video_editor',  '拍剪',  '负责短视频拍摄与剪辑、素材产出、内容排产执行'),
  ('director',      '编导',  '负责选题策划、脚本撰写、话术模板、内容复盘'),
  ('cs_agent',      '客服',  '负责售前咨询、售后工单、评价维护、DSR'),
  ('warehouse',     '仓配',  '负责库存、拣货发货、履约 SLA、退货入库')
ON CONFLICT (code) DO NOTHING;

-- 场控：场次 + 排班 + 直播监控 + 话术（现场要用）
INSERT INTO public.role_module_grants (role_code, module_code, effect, note) VALUES
  ('floor_manager', 'overview',      'allow', '场控需看经营总览'),
  ('floor_manager', 'session',       'allow', '场控需看/管场次'),
  ('floor_manager', 'session_products','allow','场控需看排品'),
  ('floor_manager', 'live_data',     'allow', '场控需看实时数据'),
  ('floor_manager', 'ops',           'allow', '场控需用话术库/道具清单'),
  ('floor_manager', 'review',        'allow', '场控需复盘'),
  ('floor_manager', 'ai',            'allow', '场控可用 AI 助手'),
  ('floor_manager', 'personal_achievement', 'allow', '个人业绩')
ON CONFLICT (role_code, module_code) DO NOTHING;

-- 拍剪：内容 + 内容排产 + 素材
INSERT INTO public.role_module_grants (role_code, module_code, effect, note) VALUES
  ('video_editor', 'overview',        'allow', '拍剪需看内容数据'),
  ('video_editor', 'content',         'allow', '拍剪核心：内容创作与数据'),
  ('video_editor', 'content_schedule','allow', '拍剪需看内容排产'),
  ('video_editor', 'ai',              'allow', '拍剪可用 AI 生成脚本/标题'),
  ('video_editor', 'personal_achievement', 'allow', '个人业绩')
ON CONFLICT (role_code, module_code) DO NOTHING;

-- 编导：内容排产 + 话术 + 复盘
INSERT INTO public.role_module_grants (role_code, module_code, effect, note) VALUES
  ('director', 'overview',         'allow', '编导需看内容与经营数据'),
  ('director', 'content',          'allow', '编导需写脚本'),
  ('director', 'content_schedule', 'allow', '编导核心：内容排产'),
  ('director', 'ops',              'allow', '编导需维护话术库'),
  ('director', 'review',           'allow', '编导需参与复盘'),
  ('director', 'review_overview',  'allow', '复盘总览'),
  ('director', 'ai',               'allow', '编导可用 AI'),
  ('director', 'personal_achievement', 'allow', '个人业绩')
ON CONFLICT (role_code, module_code) DO NOTHING;

-- 客服：客服会话 + 售后 + 订单
INSERT INTO public.role_module_grants (role_code, module_code, effect, note) VALUES
  ('cs_agent', 'overview',          'allow', '客服需看经营总览'),
  ('cs_agent', 'customer_service',  'allow', '客服核心：会话与工单'),
  ('cs_agent', 'after_sales',       'allow', '客服需处理售后'),
  ('cs_agent', 'fulfillment',       'allow', '客服需查物流'),
  ('cs_agent', 'ai',                'allow', '客服可用 AI 辅助回复'),
  ('cs_agent', 'personal_achievement', 'allow', '个人业绩')
ON CONFLICT (role_code, module_code) DO NOTHING;

-- 仓配：库存 + 履约
INSERT INTO public.role_module_grants (role_code, module_code, effect, note) VALUES
  ('warehouse', 'overview',        'allow', '仓配需看经营总览'),
  ('warehouse', 'product_center',  'allow', '仓配需看商品与库存'),
  ('warehouse', 'fulfillment',     'allow', '仓配核心：履约与发货'),
  ('warehouse', 'after_sales',     'allow', '仓配需处理退货入库'),
  ('warehouse', 'data',            'allow', '仓配需看数据导入（库存同步）'),
  ('warehouse', 'personal_achievement', 'allow', '个人业绩')
ON CONFLICT (role_code, module_code) DO NOTHING;

-- 平台授权：全部给 6 个启用平台
INSERT INTO public.role_platform_permissions (role_id, platform_code)
SELECT r.id, p.platform_code
  FROM public.roles r
  CROSS JOIN public.system_platform_configs p
 WHERE r.code IN ('floor_manager','video_editor','director','cs_agent','warehouse')
   AND p.is_enabled = true
ON CONFLICT DO NOTHING;

-- users_role_check 扩容
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin','admin','ops_director','ops_staff','operator',
                  'controller','ad_buyer','hrbp','employee','brand_viewer',
                  'floor_manager','video_editor','director','cs_agent','warehouse'));

DO $$
DECLARE v_role int; v_grant int;
BEGIN
  SELECT count(*) INTO v_role FROM public.roles
   WHERE code IN ('floor_manager','video_editor','director','cs_agent','warehouse');
  SELECT count(*) INTO v_grant FROM public.role_module_grants
   WHERE role_code IN ('floor_manager','video_editor','director','cs_agent','warehouse');
  IF v_role < 5 THEN RAISE EXCEPTION '新角色不足（% / 5）', v_role; END IF;
  RAISE NOTICE '5 个岗位角色已建，共 % 条模块授权', v_grant;
END $$;

-- version: 151_five_missing_roles
