-- ============================================================================
-- Migration: 107_traffic_source_taxonomy.sql
-- Description: 流量来源三级目录 + 平台映射（阶段 A3）
--
-- 背景：各平台流量来源目录完全不同，无法复用：
--   淘系：手淘搜索/猜你喜欢/逛逛/订阅/淘宝直播/拍立淘/淘外
--   京东：京东搜索/首页推荐/微信商城/QQ商城/M站 + 四级渠道
--   拼多多：搜索/推荐/拼团分享/百亿补贴/多多视频
--   快手：发现页（公域）/关注页（私域）
--   小红书：推荐/搜索/群聊/关注页/薯条
--
-- 方案：统一 L0-L1-L2 三级通用中间层，平台原始叫法通过映射表挂到通用层。
-- ============================================================================

-- ────────────────────────────────────────────────────────────
-- 1. 通用流量来源目录
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dim_traffic_source (
    code varchar(50) PRIMARY KEY,
    name varchar(100) NOT NULL,
    level1 varchar(30) NOT NULL,   -- 一级：自然搜索/推荐/私域/内容/付费/站外/其他
    level2 varchar(30),            -- 二级细分
    description text DEFAULT '',
    sort_order integer DEFAULT 0
);

INSERT INTO public.dim_traffic_source (code, name, level1, level2, description, sort_order) VALUES
    -- 自然搜索
    ('natural_search',      '自然搜索',     '自然搜索', '搜索', '用户主动搜索进入，无需付费', 1),
    ('search_keyword',      '关键词搜索',   '自然搜索', '搜索', '通过具体关键词搜索', 2),
    ('search_brand',        '品牌词搜索',   '自然搜索', '搜索', '通过品牌词搜索', 3),
    -- 推荐
    ('recommend',           '推荐信息流',   '推荐',     '推荐', '平台推荐算法分发', 4),
    ('recommend_home',      '首页推荐',     '推荐',     '推荐', '首页猜你喜欢/推荐位', 5),
    ('recommend_video',     '短视频推荐',   '推荐',     '内容', '短视频信息流', 6),
    ('recommend_live',      '直播推荐',     '推荐',     '内容', '直播间推荐', 7),
    -- 私域
    ('private_follow',      '关注页',       '私域',     '关注', '粉丝从关注页进入', 8),
    ('private_group',       '群聊',         '私域',     '社群', '群聊/社群进入', 9),
    ('private_cart',        '购物车',       '私域',     '回访', '购物车/收藏回访', 10),
    ('private_profile',     '个人主页',     '私域',     '回访', '通过个人主页/店铺主页进入', 11),
    -- 内容
    ('content',             '内容场',       '内容',     '内容', '逛逛/买家秀/视频等内容位', 12),
    ('content_community',   '社区内容',     '内容',     '内容', '逛逛/社区/笔记等内容', 13),
    ('content_short_video', '短视频',       '内容',     '内容', '短视频进入', 14),
    -- 付费
    ('paid',                '付费流量',     '付费',     '付费', '广告投放带来的流量（未细分工具）', 15),
    ('paid_search',         '付费搜索',     '付费',     '搜索', '关键词广告', 16),
    ('paid_feed',           '付费信息流',   '付费',     '推荐', '信息流广告', 17),
    ('paid_live',           '付费直播',     '付费',     '内容', '直播间推广', 18),
    -- 站外
    ('external',            '站外引流',     '站外',     '站外', '外部平台/渠道引流', 19),
    ('external_social',     '站外社交',     '站外',     '站外', '微博/微信等社交媒体', 20),
    ('external_cps',        '站外 CPS',     '站外',     '联盟', '淘宝客/多多进宝/京东联盟等', 21),
    -- 其他
    ('activity',            '活动会场',     '活动',     '活动', '大促/活动会场', 22),
    ('direct',              '直接访问',     '其他',     '直接', '直接输入/收藏夹', 23),
    ('unknown',             '未知来源',     '其他',     '未知', '无法归因', 24)
ON CONFLICT (code) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. 平台原始来源 → 通用来源 映射
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_source_mapping (
    id serial PRIMARY KEY,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    raw_source varchar(200) NOT NULL,
    source_code varchar(50) NOT NULL REFERENCES public.dim_traffic_source(code) ON DELETE CASCADE,
    match_type varchar(10) DEFAULT 'exact',   -- exact | contains | regex
    priority integer DEFAULT 0,
    is_verified boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE(platform_code, raw_source)
);
CREATE INDEX IF NOT EXISTS idx_source_map_platform ON public.platform_source_mapping (platform_code, priority DESC);

-- 预置映射（来自调研报告）
INSERT INTO public.platform_source_mapping (platform_code, raw_source, source_code, match_type, priority, is_verified) VALUES
    -- 淘宝/天猫
    ('taobao', '手淘搜索',        'natural_search',    'contains', 10, true),
    ('taobao', '淘宝搜索',        'natural_search',    'contains', 10, true),
    ('taobao', '猜你喜欢',        'recommend_home',    'contains', 10, true),
    ('taobao', '逛逛',            'content_community', 'contains', 10, true),
    ('taobao', '订阅',            'private_follow',    'contains', 10, true),
    ('taobao', '淘宝直播',        'recommend_live',    'contains', 10, true),
    ('taobao', '拍立淘',          'natural_search',    'contains', 5,  true),
    ('taobao', '聚划算',          'activity',          'contains', 10, true),
    ('taobao', '淘外',            'external',          'contains', 10, true),
    ('taobao', '淘宝客',          'external_cps',      'contains', 10, true),
    ('taobao', '直通车',          'paid_search',       'contains', 10, true),
    ('taobao', '万相台',          'paid_feed',         'contains', 10, true),
    ('taobao', '引力魔方',        'paid_feed',         'contains', 10, true),

    -- 京东
    ('jd', '京东搜索',            'natural_search',    'contains', 10, true),
    ('jd', '搜索',                'natural_search',    'contains', 5,  true),
    ('jd', '首页推荐',            'recommend_home',    'contains', 10, true),
    ('jd', '京东 App',            'recommend',         'contains', 5,  true),
    ('jd', '京东微信商城',        'external_social',   'contains', 10, true),
    ('jd', '京东手机 QQ 商城',    'external_social',   'contains', 10, true),
    ('jd', 'M 站',                'external',          'contains', 5,  true),
    ('jd', '秒杀',                'activity',          'contains', 10, true),
    ('jd', '搜索快车',            'paid_search',       'contains', 10, true),
    ('jd', '推荐广告',            'paid_feed',         'contains', 10, true),
    ('jd', '京东联盟',            'external_cps',      'contains', 10, true),

    -- 拼多多
    ('pdd', '搜索',               'natural_search',    'contains', 10, true),
    ('pdd', '推荐',               'recommend',         'contains', 10, true),
    ('pdd', '拼团分享',           'private_group',     'contains', 10, true),
    ('pdd', '分享',               'private_group',     'contains', 8,  true),
    ('pdd', '百亿补贴',           'activity',          'contains', 10, true),
    ('pdd', '限时秒杀',           'activity',          'contains', 10, true),
    ('pdd', '多多视频',           'content_short_video', 'contains', 10, true),
    ('pdd', '多多直播',           'recommend_live',    'contains', 10, true),
    ('pdd', '多多搜索',           'paid_search',       'contains', 10, true),
    ('pdd', '场景推广',           'paid_feed',         'contains', 10, true),
    ('pdd', '多多进宝',           'external_cps',      'contains', 10, true),

    -- 快手（公私域划分是快手核心）
    ('kuaishou', '发现页',        'recommend',         'contains', 10, true),
    ('kuaishou', '发现',          'recommend',         'contains', 8,  true),
    ('kuaishou', '关注页',        'private_follow',    'contains', 10, true),
    ('kuaishou', '关注',          'private_follow',    'contains', 8,  true),
    ('kuaishou', '同城',          'recommend',         'contains', 8,  true),
    ('kuaishou', '搜索',          'natural_search',    'contains', 10, true),
    ('kuaishou', '购物车',        'private_cart',      'contains', 10, true),
    ('kuaishou', '个人主页',      'private_profile',   'contains', 10, true),
    ('kuaishou', '小店',          'private_profile',   'contains', 5,  true),
    ('kuaishou', '磁力金牛',      'paid',              'contains', 10, true),
    ('kuaishou', '粉丝头条',      'paid_feed',         'contains', 10, true),

    -- 小红书（笔记/搜索是独立维度）
    ('xiaohongshu', '搜索',       'natural_search',    'contains', 10, true),
    ('xiaohongshu', '发现页',     'recommend',         'contains', 10, true),
    ('xiaohongshu', '发现',       'recommend',         'contains', 8,  true),
    ('xiaohongshu', '关注页',     'private_follow',    'contains', 10, true),
    ('xiaohongshu', '群聊',       'private_group',     'contains', 10, true),
    ('xiaohongshu', '笔记',       'content_community', 'contains', 10, true),
    ('xiaohongshu', '薯条',       'paid_feed',         'contains', 10, true),
    ('xiaohongshu', '聚光',       'paid',              'contains', 10, true),
    ('xiaohongshu', '蒲公英',     'content_community', 'contains', 10, true),

    -- 抖音（对照组）
    ('douyin', '推荐',            'recommend',         'contains', 10, true),
    ('douyin', '搜索',            'natural_search',    'contains', 10, true),
    ('douyin', '关注',            'private_follow',    'contains', 10, true),
    ('douyin', '短视频',          'content_short_video', 'contains', 10, true),
    ('douyin', '商城',            'recommend',         'contains', 8,  true),
    ('douyin', '千川',            'paid',              'contains', 10, true)
ON CONFLICT (platform_code, raw_source) DO NOTHING;

-- 事实表增加通用来源字段（保留原 channel_name 作为 raw_source）
ALTER TABLE public.fact_trade_daily ADD COLUMN IF NOT EXISTS source_code varchar(50);
ALTER TABLE public.fact_traffic_daily ADD COLUMN IF NOT EXISTS source_code varchar(50);

CREATE INDEX IF NOT EXISTS idx_trade_daily_source ON public.fact_trade_daily (source_code, biz_date);

COMMENT ON COLUMN public.fact_trade_daily.channel_name IS
    '平台原始来源名称（raw_source），不参与跨平台对比';
COMMENT ON COLUMN public.fact_trade_daily.source_code IS
    '通用来源 code，来自 platform_source_mapping 映射，可用于跨平台对比';

INSERT INTO public.schema_migrations (version, name)
VALUES ('107_traffic_source_taxonomy', 'Traffic source taxonomy and platform mappings')
ON CONFLICT (version) DO NOTHING;
