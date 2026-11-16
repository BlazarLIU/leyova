-- =============================================================================
-- Migration 123: 平台规则巡检雷达、合规变更差量检测与大促活动提醒
-- 对应规划：FINAL-PLAN Phase 3 (③ 合规风控每日 3 次巡检)
-- =============================================================================

-- 1. 规则原文快照表 (compliance_rule_snapshot)
CREATE TABLE IF NOT EXISTS public.compliance_rule_snapshot (
  id bigserial PRIMARY KEY,
  platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
  external_id varchar(120) NOT NULL,
  title varchar(300) NOT NULL,
  category varchar(60) NOT NULL DEFAULT '通用规则',
  source_url varchar(500) NOT NULL,
  published_at timestamptz,
  effective_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  fetch_method varchar(20) NOT NULL DEFAULT 'manual' CHECK (fetch_method IN ('html_direct', 'rss', 'json_api', 'headless', 'manual')),
  content_text text NOT NULL,
  content_hash varchar(64) NOT NULL,
  raw_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_rule_snapshot UNIQUE (platform_code, external_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_rule_snapshot_pf_ext ON public.compliance_rule_snapshot(platform_code, external_id);
CREATE INDEX IF NOT EXISTS idx_rule_snapshot_hash ON public.compliance_rule_snapshot(content_hash);
CREATE INDEX IF NOT EXISTS idx_rule_snapshot_fetched ON public.compliance_rule_snapshot(fetched_at DESC);

-- 2. 规则变更事件表 (compliance_rule_change)
CREATE TABLE IF NOT EXISTS public.compliance_rule_change (
  id bigserial PRIMARY KEY,
  snapshot_id bigint NOT NULL REFERENCES public.compliance_rule_snapshot(id) ON DELETE CASCADE,
  platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
  external_id varchar(120) NOT NULL,
  change_type varchar(20) NOT NULL CHECK (change_type IN ('new', 'revised', 'repealed')),
  diff_summary text NOT NULL DEFAULT '',
  severity varchar(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  is_read boolean NOT NULL DEFAULT false,
  read_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rule_change_unread ON public.compliance_rule_change(platform_code, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rule_change_severity ON public.compliance_rule_change(severity, created_at DESC);

-- 3. AI 风险评估与运营影响表 (compliance_risk_assessment)
CREATE TABLE IF NOT EXISTS public.compliance_risk_assessment (
  id bigserial PRIMARY KEY,
  change_id bigint NOT NULL REFERENCES public.compliance_rule_change(id) ON DELETE CASCADE,
  affected_shops integer[] DEFAULT '{}'::integer[],
  risk_summary text NOT NULL,
  operational_impact text NOT NULL,
  recommended_actions text[] DEFAULT '{}'::text[],
  evidence_refs jsonb DEFAULT '[]'::jsonb,
  assessed_by varchar(40) NOT NULL DEFAULT 'AI_RISK_ENGINE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_assessment_change ON public.compliance_risk_assessment(change_id);

-- 4. 大促与营销活动报名提醒表 (compliance_activity_reminder)
CREATE TABLE IF NOT EXISTS public.compliance_activity_reminder (
  id bigserial PRIMARY KEY,
  platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
  activity_name varchar(200) NOT NULL,
  activity_type varchar(50) NOT NULL DEFAULT '大促活动',
  signup_deadline timestamptz NOT NULL,
  activity_start timestamptz,
  activity_end timestamptz,
  requirements text DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reminded', 'done', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_reminder_status ON public.compliance_activity_reminder(signup_deadline) WHERE status <> 'done';

-- 5. 初始种子规则与基准变更（覆盖 6 个典型平台规则与大促节点）
INSERT INTO public.compliance_rule_snapshot (
  platform_code, external_id, title, category, source_url,
  published_at, effective_at, fetch_method, content_text, content_hash
) VALUES
  (
    'douyin',
    'DY-RULE-2026-089',
    '关于直播间绝对化极限用语与功效宣称专项治理公告',
    '违禁词与广告法',
    'https://school.jinritemai.com/doudian/web/rules/DY-RULE-2026-089',
    '2026-11-01 10:00:00+08',
    '2026-11-15 00:00:00+08',
    'headless',
    '为保障消费者知情权与真实交易环境，抖音电商自 2026 年 11 月 15 日起对“全网第一”、“纯天然无副作用”、“3天见效”等绝对化及未备案功效词展开系统级拦截与处罚，违规场次将限制自然流推流并扣减店铺信用分。',
    'c7d9a10f8234bbd8129037418247012398410293847109283471029384710293'
  ),
  (
    'tmall',
    'TM-RULE-2026-102',
    '天猫双11发货时效与48小时揽收保障实施细则',
    '发货与履约SLA',
    'https://rulechannel.tmall.com/rules/TM-RULE-2026-102',
    '2026-10-20 14:00:00+08',
    '2026-11-01 00:00:00+08',
    'html_direct',
    '2026年天猫双11大促期间，所有已支付订单必须在48小时内上传真实物流运单号，且物流轨迹在揽收后24小时内必须有中转更新，超时每单按成交金额10%赔付买家红包，上限100元。',
    'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0'
  ),
  (
    'jd',
    'JD-RULE-2026-045',
    '京东开放平台售后退货无忧与极速退款规范升级',
    '售后与客服',
    'https://help.jd.com/rules/JD-RULE-2026-045',
    '2026-10-25 11:30:00+08',
    '2026-11-10 00:00:00+08',
    'headless',
    'POP商家在买家提交退货申请后，由原48小时缩短为24小时未审核自动同意退货。对于高信用买家小额订单（¥100以内）支持系统先行垫付极速退款。',
    'b2c3d4e5f6a10718293a4b5c6d7e8f90123456789abcdef0123456789abcdef1'
  ),
  (
    'pdd',
    'PDD-RULE-2026-012',
    '拼多多商家服务协议及售后仅退款执行细则（人工录入）',
    '售后退款',
    'https://mms.pinduoduo.com/rules/PDD-RULE-2026-012',
    '2026-11-05 16:00:00+08',
    '2026-11-12 00:00:00+08',
    'manual',
    '对破损、少件、生鲜变质等买家争议订单，系统评估商家综合服务分低于4.2分时，平台客服将直接介入判定仅退款，商家需在12小时内补充举证方可申诉。',
    'd4e5f6a1b2c30718293a4b5c6d7e8f90123456789abcdef0123456789abcdef2'
  ),
  (
    'xiaohongshu',
    'XHS-RULE-2026-077',
    '小红书商业笔记与站外导流违规处罚规范',
    '内容生态与种草',
    'https://school.xiaohongshu.com/rules/XHS-RULE-2026-077',
    '2026-11-02 09:00:00+08',
    '2026-11-15 00:00:00+08',
    'headless',
    '严禁在图文笔记、视频画面及评论区以变体字、微信号、暗号等方式引导用户前往微信或第三方平台交易，违规账号将阶梯式限流封禁7~30天，关联品牌将被暂停蒲公英合作。',
    'f6a1b2c3d4e50718293a4b5c6d7e8f90123456789abcdef0123456789abcdef3'
  )
ON CONFLICT (platform_code, external_id, content_hash) DO NOTHING;

-- 关联变更与风险评估
INSERT INTO public.compliance_rule_change (
  snapshot_id, platform_code, external_id, change_type, diff_summary, severity, is_read
)
SELECT id, platform_code, external_id, 'new', '平台发布新规专项治理，重点管控直播违禁词宣称与售后仅退款', 'critical', false
FROM public.compliance_rule_snapshot
WHERE external_id = 'DY-RULE-2026-089'
ON CONFLICT DO NOTHING;

INSERT INTO public.compliance_rule_change (
  snapshot_id, platform_code, external_id, change_type, diff_summary, severity, is_read
)
SELECT id, platform_code, external_id, 'revised', '大促发货揽收SLA严格收紧至48小时，超时按订单10%现金赔付', 'high', false
FROM public.compliance_rule_snapshot
WHERE external_id = 'TM-RULE-2026-102'
ON CONFLICT DO NOTHING;

-- 风险评估落地
INSERT INTO public.compliance_risk_assessment (
  change_id, affected_shops, risk_summary, operational_impact, recommended_actions, evidence_refs
)
SELECT c.id, ARRAY[1, 9, 10], '抖音直播违禁词系统拦截高危预警',
       '美妆及食品店铺直播间话术若含有绝对化夸大词，将被实时掐断自然推荐流并扣除5分信用分',
       ARRAY['排查所有主播提词卡与话术模板', '启用实时违禁词拦截检测', '对新入职场控进行广告法强化培训'],
       '[{"source": "DY-RULE-2026-089", "quote": "对绝对化及未备案功效词展开系统级拦截与处罚"}]'::jsonb
FROM public.compliance_rule_change c
WHERE c.external_id = 'DY-RULE-2026-089'
ON CONFLICT DO NOTHING;

INSERT INTO public.compliance_risk_assessment (
  change_id, affected_shops, risk_summary, operational_impact, recommended_actions, evidence_refs
)
SELECT c.id, ARRAY[3, 13], '天猫双11发货时效48小时硬约束与赔付风险',
       '双11峰值期若仓库爆仓可能触发大面积揽收超时，预估可能导致 ¥20,000~50,000 买家赔付',
       ARRAY['中心仓前置预打包爆款', '与顺丰/中通签署双11运力保供协议', '客服开通延迟发货报备豁免流程'],
       '[{"source": "TM-RULE-2026-102", "quote": "超时每单按成交金额10%赔付买家红包，上限100元"}]'::jsonb
FROM public.compliance_rule_change c
WHERE c.external_id = 'TM-RULE-2026-102'
ON CONFLICT DO NOTHING;

-- 大促提醒活动
INSERT INTO public.compliance_activity_reminder (
  platform_code, activity_name, activity_type, signup_deadline, activity_start, activity_end, requirements, status
) VALUES
  ('tmall', '天猫双11第二波现货申报与券包配置', 'S级官方大促', '2026-11-18 23:59:59+08', '2026-11-20 20:00:00+08', '2026-11-25 23:59:59+08', '全店商品必须支持跨店满300减50，且价格低于近30天最低成交价', 'pending'),
  ('douyin', '抖音电商好物节年终返场报名', '平台主题活动', '2026-11-22 18:00:00+08', '2026-11-24 00:00:00+08', '2026-11-30 23:59:59+08', '近90天店铺体验分需高于 4.5 分，主推款备货量不低于 1,000 件', 'pending'),
  ('jd', '京东超级秒杀日核心资源位申报', '频道秒杀专区', '2026-11-19 12:00:00+08', '2026-11-21 00:00:00+08', '2026-11-21 23:59:59+08', '商品降价幅度>=20%，且自营入仓现货率 100%', 'pending')
ON CONFLICT DO NOTHING;

-- 6. 行级安全隔离与权限
ALTER TABLE public.compliance_rule_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_rule_change ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_risk_assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_activity_reminder ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compliance_rule_snapshot FORCE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_rule_change FORCE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_risk_assessment FORCE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_activity_reminder FORCE ROW LEVEL SECURITY;

-- 读权限：只要是已登录用户且有对应平台权限即可看
DROP POLICY IF EXISTS p_rule_snapshot_select ON public.compliance_rule_snapshot;
CREATE POLICY p_rule_snapshot_select ON public.compliance_rule_snapshot FOR SELECT TO leyova_app
  USING (rls_user_id() IS NOT NULL AND rls_has_platform(platform_code::text));

DROP POLICY IF EXISTS p_rule_change_select ON public.compliance_rule_change;
CREATE POLICY p_rule_change_select ON public.compliance_rule_change FOR SELECT TO leyova_app
  USING (rls_user_id() IS NOT NULL AND rls_has_platform(platform_code::text));

DROP POLICY IF EXISTS p_risk_assessment_select ON public.compliance_risk_assessment;
CREATE POLICY p_risk_assessment_select ON public.compliance_risk_assessment FOR SELECT TO leyova_app
  USING (
    rls_user_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.compliance_rule_change c
      WHERE c.id = change_id AND rls_has_platform(c.platform_code::text)
    )
  );

DROP POLICY IF EXISTS p_activity_reminder_select ON public.compliance_activity_reminder;
CREATE POLICY p_activity_reminder_select ON public.compliance_activity_reminder FOR SELECT TO leyova_app
  USING (rls_user_id() IS NOT NULL AND rls_has_platform(platform_code::text));

-- 写权限：机构运营、合规风控与超管
DROP POLICY IF EXISTS p_rule_snapshot_write ON public.compliance_rule_snapshot;
CREATE POLICY p_rule_snapshot_write ON public.compliance_rule_snapshot FOR ALL TO leyova_app
  USING (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text]))
  WITH CHECK (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text]));

DROP POLICY IF EXISTS p_rule_change_write ON public.compliance_rule_change;
CREATE POLICY p_rule_change_write ON public.compliance_rule_change FOR ALL TO leyova_app
  USING (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text]))
  WITH CHECK (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text]));

DROP POLICY IF EXISTS p_risk_assessment_write ON public.compliance_risk_assessment;
CREATE POLICY p_risk_assessment_write ON public.compliance_risk_assessment FOR ALL TO leyova_app
  USING (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text]))
  WITH CHECK (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text]));

DROP POLICY IF EXISTS p_activity_reminder_write ON public.compliance_activity_reminder;
CREATE POLICY p_activity_reminder_write ON public.compliance_activity_reminder FOR ALL TO leyova_app
  USING (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text]))
  WITH CHECK (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text]));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_rule_snapshot TO leyova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_rule_change TO leyova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_risk_assessment TO leyova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_activity_reminder TO leyova_app;

GRANT USAGE, SELECT ON SEQUENCE public.compliance_rule_snapshot_id_seq TO leyova_app;
GRANT USAGE, SELECT ON SEQUENCE public.compliance_rule_change_id_seq TO leyova_app;
GRANT USAGE, SELECT ON SEQUENCE public.compliance_risk_assessment_id_seq TO leyova_app;
GRANT USAGE, SELECT ON SEQUENCE public.compliance_activity_reminder_id_seq TO leyova_app;
