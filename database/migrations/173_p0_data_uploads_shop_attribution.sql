-- ============================================================================
-- P0-11 手动上传归因与失败留痕
--
-- data_uploads 原先只有 platform_code，无法归因到具体店铺/租户，
-- 上传记录也无法按店铺查询。补齐 shop_id / tenant_id。
-- ============================================================================
BEGIN;

ALTER TABLE public.data_uploads ADD COLUMN IF NOT EXISTS shop_id BIGINT;
ALTER TABLE public.data_uploads ADD COLUMN IF NOT EXISTS tenant_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_data_uploads_shop
  ON public.data_uploads (shop_id, created_at DESC);

COMMIT;
