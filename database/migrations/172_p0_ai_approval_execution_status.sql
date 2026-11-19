-- ============================================================================
-- P0-9 AI 写操作审批：执行状态落库
--
-- 原 ai_action_approvals.status 仅允许 pending/approved/rejected/expired，
-- 批准后无法区分「已执行」与「执行失败」，前端只能看到 approved 假象。
-- 新增 executed / failed 两个真实终态。
-- ============================================================================
BEGIN;

ALTER TABLE public.ai_action_approvals
  DROP CONSTRAINT IF EXISTS ai_action_approvals_status_check;

ALTER TABLE public.ai_action_approvals
  ADD CONSTRAINT ai_action_approvals_status_check
  CHECK (status::text = ANY (ARRAY[
    'pending'::text, 'approved'::text, 'rejected'::text,
    'expired'::text, 'executed'::text, 'failed'::text
  ]));

COMMIT;
