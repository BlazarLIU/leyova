-- ============================================================================
-- Migration: 109_caliber_unique_key.sql
-- Description: 唯一键加入 amount_type
--
-- 问题：105 加了 amount_type 字段，但唯一约束仍是
--       (biz_date, platform_code, shop_id, channel_name)
--       导致同一店铺同一天同一渠道的「交易额/结算/净成交」三种口径
--       会被 ON CONFLICT 覆盖，后插入的口径覆盖前者。
--
-- 修复：唯一键加入 amount_type，允许同一维度下并存多套口径。
-- ============================================================================

DO $$
BEGIN
    -- 1) 删除旧约束
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_trade_daily_biz_key') THEN
        ALTER TABLE public.fact_trade_daily DROP CONSTRAINT uq_trade_daily_biz_key;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_traffic_daily_biz_key') THEN
        ALTER TABLE public.fact_traffic_daily DROP CONSTRAINT uq_traffic_daily_biz_key;
    END IF;
END $$;

-- 2) 清理历史重复（同维度同口径保留 id 最大的一条）
DELETE FROM public.fact_trade_daily a
USING public.fact_trade_daily b
WHERE a.biz_date = b.biz_date
  AND a.platform_code = b.platform_code
  AND a.shop_id = b.shop_id
  AND COALESCE(a.channel_name,'') = COALESCE(b.channel_name,'')
  AND COALESCE(a.amount_type,'gross_paid') = COALESCE(b.amount_type,'gross_paid')
  AND a.id < b.id;

DELETE FROM public.fact_traffic_daily a
USING public.fact_traffic_daily b
WHERE a.biz_date = b.biz_date
  AND a.platform_code = b.platform_code
  AND a.shop_id = b.shop_id
  AND COALESCE(a.channel_name,'') = COALESCE(b.channel_name,'')
  AND a.id < b.id;

-- 3) 建立新约束（含 amount_type）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_trade_daily_caliber_key') THEN
        ALTER TABLE public.fact_trade_daily
            ADD CONSTRAINT uq_trade_daily_caliber_key
            UNIQUE (biz_date, platform_code, shop_id, channel_name, amount_type);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_traffic_daily_caliber_key') THEN
        ALTER TABLE public.fact_traffic_daily
            ADD CONSTRAINT uq_traffic_daily_caliber_key
            UNIQUE (biz_date, platform_code, shop_id, channel_name);
    END IF;
END $$;

-- 4) amount_type 设为 NOT NULL 并补默认值
UPDATE public.fact_trade_daily SET amount_type = 'gross_paid' WHERE amount_type IS NULL;
ALTER TABLE public.fact_trade_daily ALTER COLUMN amount_type SET NOT NULL;

INSERT INTO public.schema_migrations (version, name)
VALUES ('109_caliber_unique_key', 'Add amount_type to fact table unique keys')
ON CONFLICT (version) DO NOTHING;
