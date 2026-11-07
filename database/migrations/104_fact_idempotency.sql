-- ============================================================================
-- Migration: 104_fact_idempotency.sql
-- Description: 事实表业务唯一键（修复审核 S5：重复上传导致重复计账）
--
-- 问题：fact_trade_daily / fact_traffic_daily 原只有主键 (biz_date, id)，
--       manual-mapper 与 sync-job 都是裸 INSERT，同一文件重复上传即重复计账。
--
-- 方案：为两张表建立业务唯一约束（分区表要求唯一键必须含分区键 biz_date），
--       并把写入改为 ON CONFLICT DO UPDATE（覆盖而非累加）。
-- ============================================================================

-- 1) 交易事实表：(biz_date, platform_code, shop_id, channel_name) 唯一
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_trade_daily_biz_key'
    ) THEN
        -- 先清理历史重复行（保留 id 最大的一条），避免建约束失败
        DELETE FROM public.fact_trade_daily a
        USING public.fact_trade_daily b
        WHERE a.biz_date = b.biz_date
          AND a.platform_code = b.platform_code
          AND a.shop_id = b.shop_id
          AND COALESCE(a.channel_name, '') = COALESCE(b.channel_name, '')
          AND a.id < b.id;

        ALTER TABLE public.fact_trade_daily
            ADD CONSTRAINT uq_trade_daily_biz_key
            UNIQUE (biz_date, platform_code, shop_id, channel_name);
    END IF;
END $$;

-- 2) 流量事实表：(biz_date, platform_code, shop_id, channel_name) 唯一
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_traffic_daily_biz_key'
    ) THEN
        DELETE FROM public.fact_traffic_daily a
        USING public.fact_traffic_daily b
        WHERE a.biz_date = b.biz_date
          AND a.platform_code = b.platform_code
          AND a.shop_id = b.shop_id
          AND COALESCE(a.channel_name, '') = COALESCE(b.channel_name, '')
          AND a.id < b.id;

        ALTER TABLE public.fact_traffic_daily
            ADD CONSTRAINT uq_traffic_daily_biz_key
            UNIQUE (biz_date, platform_code, shop_id, channel_name);
    END IF;
END $$;

-- 3) 广告事实表：(biz_date, platform_code, shop_id, plan_name) 唯一
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_ad_daily_biz_key'
    ) THEN
        ALTER TABLE public.fact_ad_daily
            ADD CONSTRAINT uq_ad_daily_biz_key
            UNIQUE (biz_date, platform_code, shop_id, plan_name);
    END IF;
END $$;

-- 4) 内容事实表：(biz_date, platform_code, shop_id, content_id) 唯一
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_content_daily_biz_key'
    ) THEN
        ALTER TABLE public.fact_content_daily
            ADD CONSTRAINT uq_content_daily_biz_key
            UNIQUE (biz_date, platform_code, shop_id, content_id);
    END IF;
END $$;

-- 5) 聚合表：补充唯一约束（若尚未存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_agg_shop_daily_key') THEN
        ALTER TABLE public.agg_shop_daily
            ADD CONSTRAINT uq_agg_shop_daily_key UNIQUE (biz_date, platform_code, shop_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_agg_platform_monthly_key') THEN
        ALTER TABLE public.agg_platform_monthly
            ADD CONSTRAINT uq_agg_platform_monthly_key UNIQUE (year_month, platform_code);
    END IF;
END $$;

INSERT INTO public.schema_migrations (version, name)
VALUES ('104_fact_idempotency', 'Business unique keys on fact and aggregate tables')
ON CONFLICT (version) DO NOTHING;
