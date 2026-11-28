-- ============================================================================
-- 202_p1_platform_rls_predicates.sql
--
-- 为「已启用 RLS 但策略缺少平台谓词」的 14 张表补 rls_has_platform(platform_code)。
--
-- 背景：
--   平台权限（用户可见平台）此前只在部分表通过 RLS 生效。以下表的策略只做
--   租户/店铺/角色过滤，未限制 platform_code，导致平台权限被收窄的用户仍能
--   读到其他平台的数据。
--
-- 说明：
--   - rls_has_platform 对 platform_code 为 NULL/空串的行返回 true（全局数据
--     对所有登录用户可见），平台级数据则按 app.allowed_platforms 过滤；
--   - 该迁移幂等：已包含 rls_has_platform 的策略会被跳过；
--   - WITH CHECK 仅在原策略已显式定义时追加，ALL 策略会自动继承 USING。
-- ============================================================================

BEGIN;

DO $$
DECLARE
  r record;
  v_using text;
  v_check text;
  v_sql text;
BEGIN
  FOR r IN
    SELECT p.tablename, p.policyname, p.qual, p.with_check
      FROM pg_policies p
     WHERE p.schemaname = 'public'
       AND p.tablename = ANY (ARRAY[
         'ad_plan',
         'campaign_plan_template',
         'content_attribution_ledger',
         'content_briefs',
         'content_ideas',
         'content_metrics_link',
         'content_publish_jobs',
         'fact_ad_spend_daily',
         'fact_search_keyword_daily',
         'fact_selection_recommendation',
         'fact_settlement_cycles',
         'platform_members_summary',
         'seasonal_calendar',
         'topic_performance'
       ])
  LOOP
    v_using := CASE
      WHEN r.qual IS NULL THEN NULL
      WHEN r.qual LIKE '%rls_has_platform%' THEN r.qual
      ELSE format('(%s) AND rls_has_platform(platform_code)', r.qual)
    END;
    v_check := CASE
      WHEN r.with_check IS NULL THEN NULL
      WHEN r.with_check LIKE '%rls_has_platform%' THEN r.with_check
      ELSE format('(%s) AND rls_has_platform(platform_code)', r.with_check)
    END;

    IF v_using IS NULL AND v_check IS NULL THEN
      CONTINUE;
    END IF;

    v_sql := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF v_using IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', v_using);
    END IF;
    IF v_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', v_check);
    END IF;
    EXECUTE v_sql;
  END LOOP;

  RAISE NOTICE '202 完成：B 类表策略已补平台谓词';
END $$;

COMMIT;
