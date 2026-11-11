-- 115_cold_storage_and_user_anchor_link.sql
-- 阶段 0 修复：
-- 1. P0-8: 增加 overview_daily_stats_archive 归档表（冷存储），彻底杜绝 CRON 盲目删除
-- 2. P0-9: 增加 users.anchor_id 与 anchors.user_id 物理外键双向关联，消除硬编码 Anchor ID 1 漏洞

CREATE TABLE IF NOT EXISTS public.overview_daily_stats_archive (
  id integer,
  date date NOT NULL,
  today_gmv numeric(12,2) NOT NULL DEFAULT 0,
  today_orders integer NOT NULL DEFAULT 0,
  active_rooms integer NOT NULL DEFAULT 0,
  online_viewers integer NOT NULL DEFAULT 0,
  growth_rate numeric(5,1) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL,
  archived_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (date)
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS anchor_id integer REFERENCES public.anchors(id) ON DELETE SET NULL;
ALTER TABLE public.anchors ADD COLUMN IF NOT EXISTS user_id integer REFERENCES public.users(id) ON DELETE SET NULL;

-- 关联预置主播用户
UPDATE public.users SET anchor_id = 1 WHERE username = 'anchor_shen' AND anchor_id IS NULL;
UPDATE public.anchors SET user_id = (SELECT id FROM public.users WHERE username = 'anchor_shen') WHERE id = 1 AND user_id IS NULL;

