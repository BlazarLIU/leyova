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

