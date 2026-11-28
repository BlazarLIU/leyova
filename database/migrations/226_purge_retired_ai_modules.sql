-- ============================================================================
-- 迁移 226：清理「系统配置与 AI」中已下线的 4 个模块
-- ----------------------------------------------------------------------------
-- 下线范围（代码与数据表一并删除）：
--   · 评测（ai_eval_run / ai_eval_case）
--   · 影子模式（ai_v2_shadow_suggestion）
--   · 工作流（workflow_definitions / workflow_runs / workflow_node_runs / workflow_artifacts）
--   · 发布与回流（content_publish_jobs / content_feedback_loops）
--
-- 注意：
--   · publish_runs / publish_reversals 仍被数据治理（governance）使用，保留不动。
--   · Agent 配置 / PromptOps / 集成中心只是隐藏入口，后端能力保留，不在本迁移范围。
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS public.ai_eval_run;
DROP TABLE IF EXISTS public.ai_eval_case;
DROP TABLE IF EXISTS public.ai_v2_shadow_suggestion;

DROP TABLE IF EXISTS public.workflow_artifacts;
DROP TABLE IF EXISTS public.workflow_node_runs;
DROP TABLE IF EXISTS public.workflow_runs;
DROP TABLE IF EXISTS public.workflow_definitions;

DROP TABLE IF EXISTS public.content_publish_jobs;
DROP TABLE IF EXISTS public.content_feedback_loops;

DO $$
DECLARE v_left int;
BEGIN
  SELECT count(*) INTO v_left
    FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN (
       'ai_eval_run','ai_eval_case','ai_v2_shadow_suggestion',
       'workflow_definitions','workflow_runs','workflow_node_runs','workflow_artifacts',
       'content_publish_jobs','content_feedback_loops'
     );
  IF v_left <> 0 THEN
    RAISE EXCEPTION '仍残留 % 张待清理表', v_left;
  END IF;
  RAISE NOTICE '已下线模块的数据表清理完成';
END $$;

COMMIT;

-- version: 226_purge_retired_ai_modules
