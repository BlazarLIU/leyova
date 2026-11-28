-- ============================================================================
-- 203_p1_force_rls_platform_tables.sql
--
-- 对已启用 RLS 且已补平台谓词、但表 owner 为应用连接用户（superuser/bypassrls）
-- 的 6 张内容域表强制 ROW LEVEL SECURITY，避免裸连接（getPool）绕过 RLS。
--
-- 前提：这些表的所有访问路径均已在 withRlsContext / withSystemRlsContext 内执行。
--
-- 幂等：仅在 relforcerowsecurity = false 时执行。
-- ============================================================================

BEGIN;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'content_briefs',
    'content_ideas',
    'content_metrics_link',
    'content_publish_jobs',
    'seasonal_calendar',
    'topic_performance'
  ] LOOP
    IF EXISTS (
      SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = tbl
         AND c.relforcerowsecurity = false
    ) THEN
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;

COMMIT;
