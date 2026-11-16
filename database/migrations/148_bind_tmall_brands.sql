-- 迁移 148：为天猫店铺绑定品牌（P0-C 天猫闭环配套）
-- 审计发现 dim_brand 只有 1 行「默认品牌」，3 家天猫店 brand_id 全为 NULL
-- → 「品牌×场次」视图的 brands 统计恒为 0，无法按品牌维度分析。
INSERT INTO public.dim_brand (id, brand_name)
VALUES
  (2, '雅诗兰黛'),
  (3, '花西子'),
  (4, 'Babycare')
ON CONFLICT (id) DO NOTHING;

UPDATE public.dim_shop SET brand_id = 2 WHERE platform_code = 'tmall' AND shop_name LIKE '%品牌官方旗舰店%';
UPDATE public.dim_shop SET brand_id = 3 WHERE platform_code = 'tmall' AND shop_name LIKE '%美妆%';
UPDATE public.dim_shop SET brand_id = 4 WHERE platform_code = 'tmall' AND shop_name LIKE '%母婴%';

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM public.dim_shop WHERE platform_code='tmall' AND brand_id IS NOT NULL;
  IF v < 3 THEN RAISE EXCEPTION '天猫店铺品牌绑定不足（% / 3）', v; END IF;
  RAISE NOTICE '天猫 3 家店铺已绑定品牌';
END $$;
-- version: 148_bind_tmall_brands
