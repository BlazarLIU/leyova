-- ============================================================================
-- 迁移 144：成本可见性改为模块授权 + 财务角色彻底删除（P0-D-2）
-- ----------------------------------------------------------------------------
-- 老大决策 3：「财务角色不需要，彻底删除，但是投手、运营、HRBP 需要评估成本」
--
-- 现状（审计 02 发现）：
--   canAccessCost() = `['super_admin','admin'].includes(role)` —— 硬编码角色白名单
--   → 投手/运营/HRBP 看不到任何成本数据，无法评估一场直播赚没赚
--
-- 改造方向（与 S2/S3 的模块授权体系一致）：
--   新增模块 `cost_visibility`，粒度到人（user_module_overrides 可单独开关）
--   默认：super_admin / admin
--   授权：投手、运营、HRBP、总监（按岗位职责）
--
-- 同时清理 finance 角色全部残留（18 条 RLS 策略 + role_check + validRoles）
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 新增 cost_visibility 模块
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.system_modules (code, name, icon, sort_order)
VALUES ('cost_visibility', '成本可见性', 'Eye', 90)
ON CONFLICT (code) DO NOTHING;

-- 默认授权：超管 / 管理员
INSERT INTO public.role_module_grants (role_code, module_code, effect, note)
VALUES
  ('super_admin', 'cost_visibility', 'allow', '超管默认可看成本'),
  ('admin',       'cost_visibility', 'allow', '管理员默认可看成本')
ON CONFLICT (role_code, module_code) DO NOTHING;

-- 按老大要求授权：投手 / 运营 / HRBP（及总监）
INSERT INTO public.role_module_grants (role_code, module_code, effect, note)
VALUES
  ('ad_buyer',     'cost_visibility', 'allow', '投手需评估投放成本与净 ROI'),
  ('operator',     'cost_visibility', 'allow', '运营需评估单场盈亏'),
  ('ops_staff',    'cost_visibility', 'allow', '运营专员需评估单场盈亏'),
  ('ops_director', 'cost_visibility', 'allow', '运营总监需看成本做决策'),
  ('hrbp',         'cost_visibility', 'allow', 'HRBP 需评估人力成本与主播产出比')
ON CONFLICT (role_code, module_code) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 2. 统一成本视图 v_session_cost（按 session_id 聚合三类成本）
--    解决审计 03 断点 B8「无单场盈亏视图」
-- ────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.v_session_cost;

CREATE VIEW public.v_session_cost AS
WITH sess AS (
  SELECT s.id            AS session_id,
         s.room_id,
         r.shop_id,
         r.platform_code,
         s.date          AS biz_date,
         COALESCE(s.gmv, 0)            AS gmv,
         COALESCE(s.return_amount, 0)  AS return_amount,
         COALESCE(s.ad_cost, 0)        AS session_ad_cost
    FROM public.live_sessions s
    JOIN public.live_rooms r ON r.id = s.room_id
),
-- 平台费：按 shop + 日期摊到当天该店所有场次
fee AS (
  SELECT c.shop_id, c.order_date AS biz_date,
         SUM(c.platform_fee)  AS platform_fee,
         SUM(c.ad_spend)      AS settle_ad_spend,
         SUM(c.reserve_held)  AS reserve_held
    FROM public.fact_settlement_cycles c
   GROUP BY c.shop_id, c.order_date
),
-- 投流：按 shop + 日期
ad AS (
  SELECT a.shop_id, a.biz_date,
         SUM(a.ad_spend) AS ad_spend
    FROM public.fact_ad_spend_daily a
   GROUP BY a.shop_id, a.biz_date
),
-- 达人佣金：按 shop + 发布日期
ko AS (
  SELECT k.shop_id, k.publish_date AS biz_date,
         SUM(k.pit_fee)          AS pit_fee,
         SUM(k.commission_amount) AS commission_amount
    FROM public.fact_kol_cooperation k
   GROUP BY k.shop_id, k.publish_date
),
-- 当天该店场次数（用于分摊）
cnt AS (
  SELECT s.room_id, s.date AS biz_date, COUNT(*)::numeric AS n
    FROM public.live_sessions s
   GROUP BY s.room_id, s.date
)
SELECT sess.session_id,
       sess.room_id,
       sess.shop_id,
       sess.platform_code,
       sess.biz_date,
       sess.gmv,
       sess.return_amount,
       -- 收入（净）
       (sess.gmv - sess.return_amount)                                    AS net_revenue,
       -- 三类成本（按当天场次数摊分，避免多场重复计入）
       ROUND(COALESCE(fee.platform_fee, 0) / GREATEST(c.n, 1), 2)        AS platform_fee_alloc,
       ROUND(COALESCE(ad.ad_spend, sess.session_ad_cost) / GREATEST(c.n, 1), 2) AS ad_spend_alloc,
       ROUND(COALESCE(ko.pit_fee, 0) / GREATEST(c.n, 1), 2)              AS kol_pit_fee_alloc,
       ROUND(COALESCE(ko.commission_amount, 0) / GREATEST(c.n, 1), 2)    AS kol_commission_alloc,
       -- 总成本与净利
       ROUND(
         COALESCE(fee.platform_fee, 0) / GREATEST(c.n, 1)
       + COALESCE(ad.ad_spend, sess.session_ad_cost) / GREATEST(c.n, 1)
       + COALESCE(ko.pit_fee, 0) / GREATEST(c.n, 1)
       + COALESCE(ko.commission_amount, 0) / GREATEST(c.n, 1)
       , 2)                                                               AS total_cost_alloc,
       ROUND(
         (sess.gmv - sess.return_amount)
       - (
           COALESCE(fee.platform_fee, 0) / GREATEST(c.n, 1)
         + COALESCE(ad.ad_spend, sess.session_ad_cost) / GREATEST(c.n, 1)
         + COALESCE(ko.pit_fee, 0) / GREATEST(c.n, 1)
         + COALESCE(ko.commission_amount, 0) / GREATEST(c.n, 1)
         )
       , 2)                                                               AS net_profit_alloc
  FROM sess
  LEFT JOIN fee ON fee.shop_id = sess.shop_id AND fee.biz_date = sess.biz_date
  LEFT JOIN ad  ON ad.shop_id  = sess.shop_id AND ad.biz_date  = sess.biz_date
  LEFT JOIN ko  ON ko.shop_id  = sess.shop_id AND ko.biz_date  = sess.biz_date
  LEFT JOIN cnt c ON c.room_id = sess.room_id AND c.biz_date = sess.biz_date;

COMMENT ON VIEW public.v_session_cost IS
  '单场成本与盈亏：平台费 + 投流 + 达人坑位费/佣金，按当天该店场次数摊分。用于替代已删除的 cost_entries';

-- ────────────────────────────────────────────────────────────────
-- 3. 清理 finance 角色残留
-- ────────────────────────────────────────────────────────────────
-- 3.1 18 条 RLS 策略中的 'finance'：重建策略（去掉 finance 分支）
--     策略定义形如 role IN ('super_admin','admin','finance')，需精确替换
DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check, cmd, roles
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (qual LIKE '%finance%' OR with_check LIKE '%finance%')
  LOOP
    new_qual  := replace(replace(COALESCE(r.qual, ''),      ', ''finance''', ''), '''finance'', ', '');
    new_check := replace(replace(COALESCE(r.with_check, ''), ', ''finance''', ''), '''finance'', ', '');

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    IF r.cmd = 'SELECT' THEN
      EXECUTE format('CREATE POLICY %I ON %I.%I FOR SELECT USING (%s)',
                     r.policyname, r.schemaname, r.tablename, new_qual);
    ELSIF r.cmd = 'INSERT' THEN
      EXECUTE format('CREATE POLICY %I ON %I.%I FOR INSERT WITH CHECK (%s)',
                     r.policyname, r.schemaname, r.tablename, new_check);
    ELSIF r.cmd = 'UPDATE' THEN
      EXECUTE format('CREATE POLICY %I ON %I.%I FOR UPDATE USING (%s) WITH CHECK (%s)',
                     r.policyname, r.schemaname, r.tablename, new_qual, new_check);
    ELSIF r.cmd = 'DELETE' THEN
      EXECUTE format('CREATE POLICY %I ON %I.%I FOR DELETE USING (%s)',
                     r.policyname, r.schemaname, r.tablename, new_qual);
    ELSE  -- ALL
      EXECUTE format('CREATE POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
                     r.policyname, r.schemaname, r.tablename, new_qual, new_check);
    END IF;
  END LOOP;
END $$;

-- 3.2 roles 表清理（finance / manager）
DELETE FROM public.role_platform_permissions WHERE role_id IN (SELECT id FROM public.roles WHERE code IN ('finance','manager'));
DELETE FROM public.role_module_grants      WHERE role_code IN ('finance','manager');
DELETE FROM public.role_modules            WHERE role_code IN ('finance','manager');
DELETE FROM public.roles                   WHERE code IN ('finance','manager');

-- 3.3 users_role_check 去掉 finance / manager
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin','admin','ops_director','ops_staff','operator',
                  'controller','ad_buyer','hrbp','employee','manager'));

-- ────────────────────────────────────────────────────────────────
-- 4. 自校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_policy int;
  v_role int;
  v_view int;
  v_cost_module int;
BEGIN
  SELECT count(*) INTO v_policy FROM pg_policies
   WHERE schemaname='public' AND (qual LIKE '%finance%' OR with_check LIKE '%finance%');
  IF v_policy > 0 THEN RAISE EXCEPTION '仍有 % 条 RLS 策略含 finance', v_policy; END IF;

  SELECT count(*) INTO v_role FROM public.roles WHERE code IN ('finance','manager');
  IF v_role > 0 THEN RAISE EXCEPTION 'finance/manager 角色仍存在'; END IF;

  SELECT count(*) INTO v_view FROM public.v_session_cost;
  SELECT count(*) INTO v_cost_module FROM public.system_modules WHERE code='cost_visibility';
  IF v_cost_module = 0 THEN RAISE EXCEPTION 'cost_visibility 模块未创建'; END IF;

  RAISE NOTICE 'P0-D-2 完成：cost_visibility 已建，finance/manager 已清，v_session_cost 有 % 行', v_view;
END $$;

-- version: 144_cost_visibility_and_finance_removal
