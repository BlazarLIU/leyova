-- 170_hrbp_recruitment.sql — HRBP 招聘管理与声画试镜实测事实表
--
-- 解决痛点：HRBP 工作台试镜与招聘漏斗数据无事实表支持的断层问题
-- 支撑全链路闭环：候选人录入 -> 声画试镜五维打分 -> 15分钟试播实测 -> 发放 Offer -> 一键转正自动生成正式主播档案

CREATE TABLE IF NOT EXISTS public.hrbp_candidates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    target_category VARCHAR(50) NOT NULL, -- '美妆护肤' | '服装' | '食品生鲜' | '3C数码' | '鞋箱包'
    experience_years NUMERIC(4,1) DEFAULT 0,
    expected_salary NUMERIC(10,2) DEFAULT 0,
    source VARCHAR(50) DEFAULT 'BOSS直聘', -- 'BOSS直聘' | '猎头推荐' | '内部转介' | '校园招聘' | '抖音自荐'
    stage VARCHAR(30) NOT NULL DEFAULT 'resume_screening', -- 'resume_screening' | 'audition_scheduled' | 'trial_streaming' | 'offer_extended' | 'onboarded' | 'eliminated'
    eliminated_reason TEXT,
    anchor_id INTEGER REFERENCES public.anchors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hrbp_candidates_stage ON public.hrbp_candidates(stage);
CREATE INDEX IF NOT EXISTS idx_hrbp_candidates_category ON public.hrbp_candidates(target_category);

CREATE TABLE IF NOT EXISTS public.hrbp_auditions (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER NOT NULL REFERENCES public.hrbp_candidates(id) ON DELETE CASCADE,
    audition_date DATE NOT NULL DEFAULT CURRENT_DATE,
    interviewer VARCHAR(50) NOT NULL,
    camera_presence_score NUMERIC(3,1) DEFAULT 8.0, -- 镜头表现力 (0-10)
    vocal_clarity_score NUMERIC(3,1) DEFAULT 8.0,   -- 声线穿透与控场 (0-10)
    sales_pitch_score NUMERIC(3,1) DEFAULT 8.0,     -- 带货话术与逼单 (0-10)
    script_adaptability_score NUMERIC(3,1) DEFAULT 8.0, -- 脚本变通与临场 (0-10)
    rhythm_control_score NUMERIC(3,1) DEFAULT 8.0,  -- 节奏把控与过品 (0-10)
    total_score NUMERIC(4,1) DEFAULT 8.0,          -- 五维加权总分 (0-10)
    trial_gmv NUMERIC(12,2) DEFAULT 0,              -- 15分钟实战试播实测 GMV (元)
    trial_orders INTEGER DEFAULT 0,                -- 试播订单量
    result VARCHAR(20) NOT NULL DEFAULT 'pass',    -- 'pass' | 'fail' | 'pending'
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hrbp_auditions_candidate ON public.hrbp_auditions(candidate_id);

-- 初始化种子候选人与声画打分数据（覆盖5大类目与招聘漏斗各阶段）
INSERT INTO public.hrbp_candidates (id, name, phone, target_category, experience_years, expected_salary, source, stage, created_at)
VALUES
  (1, '周雅莉', '13800138001', '美妆护肤', 3.0, 15000, 'BOSS直聘', 'onboarded', NOW() - INTERVAL '15 days'),
  (2, '赵婷婷', '13800138002', '服装', 2.5, 12000, '猎头推荐', 'offer_extended', NOW() - INTERVAL '10 days'),
  (3, '王浩宇', '13800138003', '3C数码', 4.0, 18000, '抖音自荐', 'trial_streaming', NOW() - INTERVAL '7 days'),
  (4, '李美琪', '13800138004', '鞋箱包', 1.5, 9000, 'BOSS直聘', 'audition_scheduled', NOW() - INTERVAL '5 days'),
  (5, '孙佳慧', '13800138005', '食品生鲜', 2.0, 10000, '校园招聘', 'resume_screening', NOW() - INTERVAL '3 days'),
  (6, '陈思思', '13800138006', '美妆护肤', 1.0, 8000, 'BOSS直聘', 'eliminated', NOW() - INTERVAL '12 days')
ON CONFLICT (id) DO NOTHING;

SELECT setval('public.hrbp_candidates_id_seq', (SELECT MAX(id) FROM public.hrbp_candidates));

INSERT INTO public.hrbp_auditions (candidate_id, audition_date, interviewer, camera_presence_score, vocal_clarity_score, sales_pitch_score, script_adaptability_score, rhythm_control_score, total_score, trial_gmv, trial_orders, result, comments)
VALUES
  (1, CURRENT_DATE - INTERVAL '14 days', '李HRBP', 9.2, 9.0, 9.4, 8.8, 9.0, 9.1, 8650, 42, 'pass', '声线极具感染力，微表情与试色逼真度极高，15分钟带货GMV突破8000元，建议直接入职'),
  (2, CURRENT_DATE - INTERVAL '9 days', '李HRBP', 8.8, 8.5, 8.7, 8.6, 8.9, 8.7, 6200, 28, 'pass', '服装试穿与尺码推荐节奏流畅，临场搭配建议专业，已发Offer'),
  (3, CURRENT_DATE - INTERVAL '6 days', '李HRBP', 8.5, 8.6, 8.9, 8.4, 8.5, 8.6, 7500, 19, 'pass', '数码参数拆解清晰，高客单逼单能力强，试播效果良好'),
  (6, CURRENT_DATE - INTERVAL '11 days', '李HRBP', 6.0, 6.5, 5.5, 5.8, 6.2, 6.0, 1200, 4, 'fail', '镜头前紧张感强，产品控场话术不连贯，未达到B级主播及格线')
ON CONFLICT DO NOTHING;
