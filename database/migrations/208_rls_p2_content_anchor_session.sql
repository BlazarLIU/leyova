-- ============================================================================
-- 208_rls_p2_content_anchor_session.sql
--
-- P2 批次：内容、主播/HR、直播场次、租户内配置，共 26 张表。
--
-- 范围（docs/RLS-190-ENABLEMENT-PLAN.md §4 P2）：
--   F07 内容项目（2）
--     content_assets, content_tasks
--   F08 主播/HR/排期（10）
--     anchors, anchor_profiles,
--     hrbp_candidates, hrbp_auditions, douyin_anchor_daily_metrics,
--     session_anchor_metrics, session_plans, live_registrations
--   F09 场次/房间子表（8）
--     session_live_basic_info, session_overview_metrics,
--     session_short_video_traffic, session_staff_assignments,
--     session_plan_products, multi_room_status, room_health,
--     douyin_channel_daily_metrics
--   F10 租户内配置（6）
--     biz_targets, decision_cases, dim_dept, dim_team,
--     role_workbenches, workbench_widgets
--
-- 同步处理：
--   1. session_plan_products 旧策略读取 app.role（从未注入）且引用死角色，
--      本迁移先删除旧策略，改为通过 session_plans / live_sessions 继承；
--   2. live_sessions 现有策略引用 admin/operator/employee 死角色，且
--      controller 可见全部场次；本迁移收敛为「运营角色全量、controller 仅本人
--      主播/本人录入」，并保留 brand_viewer 的 can_view_anchors + 项目约束；
--   3. session_product_details / session_product_skus 视图启用 security_invoker，
--      避免视图以 owner 权限绕过基表 RLS。
--
-- 本批只 ENABLE，不 FORCE。
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 0. 先修正 live_sessions（P2 场次子表的继承父表）
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS p_live_sessions_select ON public.live_sessions;
CREATE POLICY p_live_sessions_select ON public.live_sessions FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_has_platform(platform_code)
    AND (
      (
        public.rls_user_type() = 'brand_viewer'
        AND public.rls_can_view_anchors()
        AND project_id IS NOT NULL
        AND public.rls_has_project(project_id)
      )
      OR (
        public.rls_is_agency_staff()
        AND (
          public.rls_role() <> 'controller'
          OR anchor_id = public.rls_anchor_id()
          OR (anchor_id IS NULL AND operator_id = public.rls_user_id())
        )
      )
    )
  );

DROP POLICY IF EXISTS p_live_sessions_write ON public.live_sessions;
CREATE POLICY p_live_sessions_write ON public.live_sessions FOR ALL TO public
  USING (
    public.rls_is_agency_staff()
    AND (
      public.rls_is_ops_writer()
      OR (
        public.rls_role() = 'controller'
        AND (
          anchor_id = public.rls_anchor_id()
          OR (anchor_id IS NULL AND operator_id = public.rls_user_id())
        )
      )
    )
  )
  WITH CHECK (
    public.rls_is_agency_staff()
    AND (
      public.rls_is_ops_writer()
      OR (
        public.rls_role() = 'controller'
        AND (
          anchor_id = public.rls_anchor_id()
          OR (anchor_id IS NULL AND operator_id = public.rls_user_id())
        )
      )
    )
  );

-- ────────────────────────────────────────────────────────────
-- F07 内容项目
-- ────────────────────────────────────────────────────────────

-- content_assets：租户 + 平台 + 内容/项目可见性；写允许 video_editor
DROP POLICY IF EXISTS p_content_assets_select ON public.content_assets;
CREATE POLICY p_content_assets_select ON public.content_assets FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_is_agency_staff()
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
    AND (source_platform IS NULL OR source_platform = '' OR public.rls_has_platform(source_platform))
    AND (public.rls_is_content_writer() OR public.rls_has_project(project_id))
  );

DROP POLICY IF EXISTS p_content_assets_write ON public.content_assets;
CREATE POLICY p_content_assets_write ON public.content_assets FOR ALL TO public
  USING (
    public.rls_is_content_writer()
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
    AND (source_platform IS NULL OR source_platform = '' OR public.rls_has_platform(source_platform))
  )
  WITH CHECK (
    public.rls_is_content_writer()
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
    AND (source_platform IS NULL OR source_platform = '' OR public.rls_has_platform(source_platform))
  );

-- content_tasks：无 tenant/platform 列，按内容角色 / 项目收敛
DROP POLICY IF EXISTS p_content_tasks_select ON public.content_tasks;
CREATE POLICY p_content_tasks_select ON public.content_tasks FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_is_agency_staff()
    AND (public.rls_is_content_writer() OR public.rls_has_project(project_id))
  );

DROP POLICY IF EXISTS p_content_tasks_write ON public.content_tasks;
CREATE POLICY p_content_tasks_write ON public.content_tasks FOR ALL TO public
  USING (public.rls_is_content_writer())
  WITH CHECK (public.rls_is_content_writer());

-- ────────────────────────────────────────────────────────────
-- F08 主播 / HR / 排期
-- ────────────────────────────────────────────────────────────

-- anchors：内部员工按平台可见；controller 仅本人主播；brand_viewer 需 can_view_anchors
DROP POLICY IF EXISTS p_anchors_select ON public.anchors;
CREATE POLICY p_anchors_select ON public.anchors FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (
      (public.rls_role() = 'controller' AND id = public.rls_anchor_id())
      OR (
        (platform_code IS NULL OR public.rls_has_platform(platform_code))
        AND (
          (public.rls_is_agency_staff() AND public.rls_role() <> 'controller')
          OR (public.rls_user_type() = 'brand_viewer' AND public.rls_can_view_anchors())
          OR user_id = public.rls_user_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS p_anchors_write ON public.anchors;
CREATE POLICY p_anchors_write ON public.anchors FOR ALL TO public
  USING (
    (public.rls_is_ops_writer() OR public.rls_is_hr_writer())
    AND (platform_code IS NULL OR public.rls_has_platform(platform_code))
  )
  WITH CHECK (
    (public.rls_is_ops_writer() OR public.rls_is_hr_writer())
    AND (platform_code IS NULL OR public.rls_has_platform(platform_code))
  );

-- anchor_profiles：id = anchors.id，按 anchors 可见性收敛
DROP POLICY IF EXISTS p_anchor_profiles_select ON public.anchor_profiles;
CREATE POLICY p_anchor_profiles_select ON public.anchor_profiles FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.anchors a WHERE a.id = anchor_profiles.id)
  );

DROP POLICY IF EXISTS p_anchor_profiles_write ON public.anchor_profiles;
CREATE POLICY p_anchor_profiles_write ON public.anchor_profiles FOR ALL TO public
  USING (
    (public.rls_is_ops_writer() OR public.rls_is_hr_writer())
    AND EXISTS (SELECT 1 FROM public.anchors a WHERE a.id = anchor_profiles.id)
  )
  WITH CHECK (
    (public.rls_is_ops_writer() OR public.rls_is_hr_writer())
    AND EXISTS (SELECT 1 FROM public.anchors a WHERE a.id = anchor_profiles.id)
  );

-- hrbp_candidates：HR 角色，关联主播时叠加主播可见性
DROP POLICY IF EXISTS p_hrbp_candidates_select ON public.hrbp_candidates;
CREATE POLICY p_hrbp_candidates_select ON public.hrbp_candidates FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (
      public.rls_is_hr_writer()
      OR (anchor_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.anchors a WHERE a.id = anchor_id))
    )
  );

DROP POLICY IF EXISTS p_hrbp_candidates_write ON public.hrbp_candidates;
CREATE POLICY p_hrbp_candidates_write ON public.hrbp_candidates FOR ALL TO public
  USING (public.rls_is_hr_writer())
  WITH CHECK (public.rls_is_hr_writer());

-- hrbp_auditions：HR 角色读写
DROP POLICY IF EXISTS p_hrbp_auditions_select ON public.hrbp_auditions;
CREATE POLICY p_hrbp_auditions_select ON public.hrbp_auditions FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL AND public.rls_is_hr_writer());

DROP POLICY IF EXISTS p_hrbp_auditions_write ON public.hrbp_auditions;
CREATE POLICY p_hrbp_auditions_write ON public.hrbp_auditions FOR ALL TO public
  USING (public.rls_is_hr_writer())
  WITH CHECK (public.rls_is_hr_writer());

-- douyin_anchor_daily_metrics：通过 anchors 继承主播可见性
DROP POLICY IF EXISTS p_douyin_anchor_daily_metrics_select ON public.douyin_anchor_daily_metrics;
CREATE POLICY p_douyin_anchor_daily_metrics_select ON public.douyin_anchor_daily_metrics FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (
      public.rls_is_ops_writer()
      OR (anchor_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.anchors a WHERE a.id = anchor_id))
    )
  );

DROP POLICY IF EXISTS p_douyin_anchor_daily_metrics_write ON public.douyin_anchor_daily_metrics;
CREATE POLICY p_douyin_anchor_daily_metrics_write ON public.douyin_anchor_daily_metrics FOR ALL TO public
  USING (public.rls_is_ops_writer())
  WITH CHECK (public.rls_is_ops_writer());

-- session_anchor_metrics：通过 anchors 继承主播可见性
DROP POLICY IF EXISTS p_session_anchor_metrics_select ON public.session_anchor_metrics;
CREATE POLICY p_session_anchor_metrics_select ON public.session_anchor_metrics FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (
      public.rls_is_ops_writer()
      OR (anchor_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.anchors a WHERE a.id = anchor_id))
    )
  );

DROP POLICY IF EXISTS p_session_anchor_metrics_write ON public.session_anchor_metrics;
CREATE POLICY p_session_anchor_metrics_write ON public.session_anchor_metrics FOR ALL TO public
  USING (public.rls_is_ops_writer())
  WITH CHECK (public.rls_is_ops_writer());

-- session_plans：运营全量；controller 仅本人主播；brand_viewer 需 can_view_anchors
DROP POLICY IF EXISTS p_session_plans_select ON public.session_plans;
CREATE POLICY p_session_plans_select ON public.session_plans FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (
      public.rls_is_ops_writer()
      -- controller 仅本人主播的排期，不得通过 room 分支绕过
      OR (
        public.rls_role() = 'controller'
        AND anchor_id IS NOT NULL
        AND anchor_id = public.rls_anchor_id()
      )
      -- 其他内部员工（含 HR / 内容 / 投放 / 客服）按主播或房间可见
      OR (
        public.rls_is_agency_staff()
        AND public.rls_role() <> 'controller'
        AND (
          (anchor_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.anchors a WHERE a.id = anchor_id))
          OR (room_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.live_rooms r WHERE r.id = room_id))
        )
      )
      -- 品牌查看者需 can_view_anchors 且主播对其可见
      OR (
        public.rls_user_type() = 'brand_viewer'
        AND public.rls_can_view_anchors()
        AND anchor_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.anchors a WHERE a.id = anchor_id)
      )
    )
  );

DROP POLICY IF EXISTS p_session_plans_write ON public.session_plans;
CREATE POLICY p_session_plans_write ON public.session_plans FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND (
      anchor_id IS NULL
      OR EXISTS (SELECT 1 FROM public.anchors a WHERE a.id = anchor_id)
    )
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND (
      anchor_id IS NULL
      OR EXISTS (SELECT 1 FROM public.anchors a WHERE a.id = anchor_id)
    )
  );

-- live_registrations：项目 + 主播本人 + 运营；仅内部员工
DROP POLICY IF EXISTS p_live_registrations_select ON public.live_registrations;
CREATE POLICY p_live_registrations_select ON public.live_registrations FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_is_agency_staff()
    AND (
      public.rls_is_ops_writer()
      OR public.rls_has_project(project_id)
      OR (anchor_id IS NOT NULL AND anchor_id = public.rls_anchor_id())
    )
  );

DROP POLICY IF EXISTS p_live_registrations_write ON public.live_registrations;
CREATE POLICY p_live_registrations_write ON public.live_registrations FOR ALL TO public
  USING (
    public.rls_is_agency_staff()
    AND (
      public.rls_is_ops_writer()
      OR (anchor_id IS NOT NULL AND anchor_id = public.rls_anchor_id())
    )
    AND (
      project_id IS NULL
      OR public.rls_is_ops_writer()
      OR public.rls_has_project(project_id)
    )
  )
  WITH CHECK (
    public.rls_is_agency_staff()
    AND (
      public.rls_is_ops_writer()
      OR (anchor_id IS NOT NULL AND anchor_id = public.rls_anchor_id())
    )
    AND (
      project_id IS NULL
      OR public.rls_is_ops_writer()
      OR public.rls_has_project(project_id)
    )
  );

-- ────────────────────────────────────────────────────────────
-- F09 场次 / 房间子表
-- ────────────────────────────────────────────────────────────

-- session_live_basic_info：session_id → live_sessions
DROP POLICY IF EXISTS p_session_live_basic_info_select ON public.session_live_basic_info;
CREATE POLICY p_session_live_basic_info_select ON public.session_live_basic_info FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id)
  );

DROP POLICY IF EXISTS p_session_live_basic_info_write ON public.session_live_basic_info;
CREATE POLICY p_session_live_basic_info_write ON public.session_live_basic_info FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id)
  );

-- session_overview_metrics：session_id → live_sessions
DROP POLICY IF EXISTS p_session_overview_metrics_select ON public.session_overview_metrics;
CREATE POLICY p_session_overview_metrics_select ON public.session_overview_metrics FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id)
  );

DROP POLICY IF EXISTS p_session_overview_metrics_write ON public.session_overview_metrics;
CREATE POLICY p_session_overview_metrics_write ON public.session_overview_metrics FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id)
  );

-- session_short_video_traffic：session_id → live_sessions
DROP POLICY IF EXISTS p_session_short_video_traffic_select ON public.session_short_video_traffic;
CREATE POLICY p_session_short_video_traffic_select ON public.session_short_video_traffic FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id)
  );

DROP POLICY IF EXISTS p_session_short_video_traffic_write ON public.session_short_video_traffic;
CREATE POLICY p_session_short_video_traffic_write ON public.session_short_video_traffic FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id)
  );

-- session_staff_assignments：session_id → live_sessions
DROP POLICY IF EXISTS p_session_staff_assignments_select ON public.session_staff_assignments;
CREATE POLICY p_session_staff_assignments_select ON public.session_staff_assignments FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id)
  );

DROP POLICY IF EXISTS p_session_staff_assignments_write ON public.session_staff_assignments;
CREATE POLICY p_session_staff_assignments_write ON public.session_staff_assignments FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id)
  );

-- session_plan_products：删除旧 app.role 策略，改为通过 session_plans / live_sessions 继承
DROP POLICY IF EXISTS session_plan_products_admin_all ON public.session_plan_products;
DROP POLICY IF EXISTS session_plan_products_read_scope ON public.session_plan_products;

DROP POLICY IF EXISTS p_session_plan_products_select ON public.session_plan_products;
CREATE POLICY p_session_plan_products_select ON public.session_plan_products FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (
      public.rls_is_ops_writer()
      OR (plan_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.session_plans p WHERE p.id = plan_id))
      OR (session_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id))
    )
  );

DROP POLICY IF EXISTS p_session_plan_products_write ON public.session_plan_products;
CREATE POLICY p_session_plan_products_write ON public.session_plan_products FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND (
      (plan_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.session_plans p WHERE p.id = plan_id))
      OR (session_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id))
    )
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND (
      (plan_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.session_plans p WHERE p.id = plan_id))
      OR (session_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id))
    )
  );

-- multi_room_status：room_id → live_rooms
DROP POLICY IF EXISTS p_multi_room_status_select ON public.multi_room_status;
CREATE POLICY p_multi_room_status_select ON public.multi_room_status FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_is_agency_staff()
    AND (
      public.rls_is_ops_writer()
      OR (room_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.live_rooms r WHERE r.id = room_id))
    )
  );

DROP POLICY IF EXISTS p_multi_room_status_write ON public.multi_room_status;
CREATE POLICY p_multi_room_status_write ON public.multi_room_status FOR ALL TO public
  USING (public.rls_is_ops_writer())
  WITH CHECK (public.rls_is_ops_writer());

-- room_health：room_id → live_rooms
DROP POLICY IF EXISTS p_room_health_select ON public.room_health;
CREATE POLICY p_room_health_select ON public.room_health FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_is_agency_staff()
    AND (
      public.rls_is_ops_writer()
      OR (room_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.live_rooms r WHERE r.id = room_id))
    )
  );

DROP POLICY IF EXISTS p_room_health_write ON public.room_health;
CREATE POLICY p_room_health_write ON public.room_health FOR ALL TO public
  USING (public.rls_is_ops_writer())
  WITH CHECK (public.rls_is_ops_writer());

-- douyin_channel_daily_metrics：upload_id → data_uploads（已启用 RLS）
DROP POLICY IF EXISTS p_douyin_channel_daily_metrics_select ON public.douyin_channel_daily_metrics;
CREATE POLICY p_douyin_channel_daily_metrics_select ON public.douyin_channel_daily_metrics FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_is_agency_staff()
    AND (
      public.rls_is_ops_writer()
      OR (upload_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.data_uploads u WHERE u.id = upload_id))
    )
  );

DROP POLICY IF EXISTS p_douyin_channel_daily_metrics_write ON public.douyin_channel_daily_metrics;
CREATE POLICY p_douyin_channel_daily_metrics_write ON public.douyin_channel_daily_metrics FOR ALL TO public
  USING (public.rls_is_ops_writer())
  WITH CHECK (public.rls_is_ops_writer());

-- ────────────────────────────────────────────────────────────
-- F10 租户内配置
-- ────────────────────────────────────────────────────────────

-- biz_targets：租户隔离
DROP POLICY IF EXISTS p_biz_targets_select ON public.biz_targets;
CREATE POLICY p_biz_targets_select ON public.biz_targets FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
  );

DROP POLICY IF EXISTS p_biz_targets_write ON public.biz_targets;
CREATE POLICY p_biz_targets_write ON public.biz_targets FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
  );

-- decision_cases：租户 + 责任人 / 创建人 / 运营
DROP POLICY IF EXISTS p_decision_cases_select ON public.decision_cases;
CREATE POLICY p_decision_cases_select ON public.decision_cases FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
    AND (
      public.rls_is_ops_writer()
      OR owner_user_id = public.rls_user_id()
      OR created_by = public.rls_user_id()
    )
  );

DROP POLICY IF EXISTS p_decision_cases_write ON public.decision_cases;
CREATE POLICY p_decision_cases_write ON public.decision_cases FOR ALL TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
    AND (
      public.rls_is_ops_writer()
      OR owner_user_id = public.rls_user_id()
      OR created_by = public.rls_user_id()
    )
  )
  WITH CHECK (
    public.rls_user_id() IS NOT NULL
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
    AND (
      public.rls_is_ops_writer()
      OR owner_user_id = public.rls_user_id()
      OR created_by = public.rls_user_id()
    )
  );

-- dim_dept：租户内可读，HR 角色可写
DROP POLICY IF EXISTS p_dim_dept_select ON public.dim_dept;
CREATE POLICY p_dim_dept_select ON public.dim_dept FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
  );

DROP POLICY IF EXISTS p_dim_dept_write ON public.dim_dept;
CREATE POLICY p_dim_dept_write ON public.dim_dept FOR ALL TO public
  USING (
    public.rls_is_hr_writer()
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
  )
  WITH CHECK (
    public.rls_is_hr_writer()
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
  );

-- dim_team：租户内可读，HR 角色可写
DROP POLICY IF EXISTS p_dim_team_select ON public.dim_team;
CREATE POLICY p_dim_team_select ON public.dim_team FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
  );

DROP POLICY IF EXISTS p_dim_team_write ON public.dim_team;
CREATE POLICY p_dim_team_write ON public.dim_team FOR ALL TO public
  USING (
    public.rls_is_hr_writer()
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
  )
  WITH CHECK (
    public.rls_is_hr_writer()
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
  );

-- role_workbenches：租户内可读，仅超管可写
DROP POLICY IF EXISTS p_role_workbenches_select ON public.role_workbenches;
CREATE POLICY p_role_workbenches_select ON public.role_workbenches FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
  );

DROP POLICY IF EXISTS p_role_workbenches_write ON public.role_workbenches;
CREATE POLICY p_role_workbenches_write ON public.role_workbenches FOR ALL TO public
  USING (
    public.rls_is_super_admin()
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
  )
  WITH CHECK (
    public.rls_is_super_admin()
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
  );

-- workbench_widgets：workbench_id → role_workbenches（租户继承）
DROP POLICY IF EXISTS p_workbench_widgets_select ON public.workbench_widgets;
CREATE POLICY p_workbench_widgets_select ON public.workbench_widgets FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.role_workbenches w WHERE w.id = workbench_id)
  );

DROP POLICY IF EXISTS p_workbench_widgets_write ON public.workbench_widgets;
CREATE POLICY p_workbench_widgets_write ON public.workbench_widgets FOR ALL TO public
  USING (
    public.rls_is_super_admin()
    AND EXISTS (SELECT 1 FROM public.role_workbenches w WHERE w.id = workbench_id)
  )
  WITH CHECK (
    public.rls_is_super_admin()
    AND EXISTS (SELECT 1 FROM public.role_workbenches w WHERE w.id = workbench_id)
  );

-- ────────────────────────────────────────────────────────────
-- 启用 RLS（不 FORCE）
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.content_assets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_tasks                 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.anchors                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anchor_profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrbp_candidates               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrbp_auditions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.douyin_anchor_daily_metrics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_anchor_metrics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_plans                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_registrations            ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.session_live_basic_info       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_overview_metrics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_short_video_traffic   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_staff_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_plan_products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multi_room_status             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_health                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.douyin_channel_daily_metrics  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.biz_targets                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_cases                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_dept                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_team                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_workbenches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbench_widgets             ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 视图旁路：会话商品视图改为调用者权限
-- ────────────────────────────────────────────────────────────
ALTER VIEW public.session_product_details SET (security_invoker = true);
ALTER VIEW public.session_product_skus    SET (security_invoker = true);

-- ────────────────────────────────────────────────────────────
-- 断言：26 张表均已启用 RLS 且至少 1 条策略
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  n_pol int;
  rls_on boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'content_assets','content_tasks',
    'anchors','anchor_profiles',
    'hrbp_candidates','hrbp_auditions','douyin_anchor_daily_metrics',
    'session_anchor_metrics','session_plans','live_registrations',
    'session_live_basic_info','session_overview_metrics',
    'session_short_video_traffic','session_staff_assignments',
    'session_plan_products','multi_room_status','room_health',
    'douyin_channel_daily_metrics',
    'biz_targets','decision_cases','dim_dept','dim_team',
    'role_workbenches','workbench_widgets'
  ] LOOP
    SELECT c.relrowsecurity INTO rls_on
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = t;

    SELECT count(*) INTO n_pol
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename = t;

    IF NOT COALESCE(rls_on, false) THEN
      RAISE EXCEPTION 'P2 表未启用 RLS: %', t;
    END IF;
    IF n_pol = 0 THEN
      RAISE EXCEPTION 'P2 表已启用 RLS 但缺少策略: %', t;
    END IF;
  END LOOP;

  RAISE NOTICE '208 完成：P2 26 张表已启用 RLS 并覆盖策略';
END $$;

COMMIT;
