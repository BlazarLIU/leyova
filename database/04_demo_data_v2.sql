--
-- ============================================================================
-- Leyova 演示数据重建脚本 V2（静态维度与配置）
-- 文件：database/04_demo_data_v2.sql
-- 适用：清理旧演示数据并重建全品类 10 类目、66 SKU、16 店铺静态维度
-- 回滚备份文件参考：/home/leyova/.backup/leyova_pre_demo_v2_20261112_214935.dump
-- ============================================================================

BEGIN;

SET LOCAL search_path = public;

-- ════════════════════════════════════════════════════════════
-- 0. 废弃冗余表与维护归因字典
-- ════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.promotion_rules CASCADE;
UPDATE public.ad_tool_dict SET default_attribution_hours = 168 WHERE code IN ('cili_juxing', 'shutiao') AND default_attribution_hours IS NULL;

-- ════════════════════════════════════════════════════════════
-- 1. 清理演示事实表（Group A，从外键依赖子表到父表）
-- ════════════════════════════════════════════════════════════
DELETE FROM canonical_order_items;
DELETE FROM canonical_orders;
DELETE FROM canonical_refund_events;
DELETE FROM clean_records;
DELETE FROM raw_records;
DELETE FROM fact_trade_daily;
DELETE FROM fact_traffic_daily;
DELETE FROM fact_ad_spend_daily;
DELETE FROM fact_content_daily;
DELETE FROM content_attribution_ledger;
DELETE FROM fact_search_keyword_daily;
DELETE FROM fact_settlement_cycles;
DELETE FROM fact_inventory_ledger;
DELETE FROM fact_inventory_stock;
DELETE FROM fact_kol_cooperation;
DELETE FROM fact_cs_session;
DELETE FROM fact_after_sale_tickets;
DELETE FROM fact_fulfillment_waybill;
DELETE FROM platform_members_summary;
DELETE FROM compliance_events;
DELETE FROM content_schedules;
DELETE FROM content_tasks;
DELETE FROM content_projects;

-- ════════════════════════════════════════════════════════════
-- 2. 清理场次/主播/维度扩展表（Group B）
-- ════════════════════════════════════════════════════════════
DELETE FROM session_product_skus;
DELETE FROM session_product_details;
DELETE FROM session_short_video_traffic;
DELETE FROM session_channel_metrics;
DELETE FROM session_anchor_metrics;
DELETE FROM session_overview_metrics;
DELETE FROM session_live_basic_info;
DELETE FROM session_plan_products;
DELETE FROM session_plans;
DELETE FROM live_sessions;
DELETE FROM room_health;
DELETE FROM multi_room_status;
DELETE FROM live_registrations;
DELETE FROM anchor_capabilities;
DELETE FROM anchor_training_records;
DELETE FROM anchor_training_plans;
DELETE FROM anchor_script_templates;
DELETE FROM anchor_profiles;
DELETE FROM douyin_anchor_daily_metrics;
DELETE FROM douyin_channel_daily_metrics;
DELETE FROM anchors;
DELETE FROM live_rooms;
DELETE FROM operators;
DELETE FROM dim_sku_mapping;
DELETE FROM dim_product;
DELETE FROM dim_kol;
DELETE FROM dim_cs_agent;
DELETE FROM pricing_rules;
DELETE FROM promotions;

-- 辅助业务展示表
DELETE FROM competitor_price_data;
DELETE FROM competitor_brands;
DELETE FROM overview_daily_stats;
DELETE FROM overview_activities;
DELETE FROM alert_events;
DELETE FROM improvement_tasks;
DELETE FROM goal_tracking;
DELETE FROM data_uploads;
DELETE FROM data_exports;
DELETE FROM script_library;
DELETE FROM issue_library;

-- ════════════════════════════════════════════════════════════
-- 3. 店铺主档（dim_shop）：更新 1-8 店铺 + 新增 9-16 店铺
-- ════════════════════════════════════════════════════════════
-- 6 平台 × 3 店 = 18 店（1-18 全量重写，无 jd/pdd）
UPDATE dim_shop SET platform_code='douyin',      shop_name='抖音主营旗舰店',       business_mode='standard', shop_type='douyin_flagship',   status='active', auth_status='manual_only' WHERE id=1;
UPDATE dim_shop SET platform_code='douyin',      shop_name='抖音美妆旗舰店',       business_mode='standard', shop_type='douyin_specialty',  status='active', auth_status='manual_only' WHERE id=2;
UPDATE dim_shop SET platform_code='douyin',      shop_name='抖音食品专营店',       business_mode='standard', shop_type='douyin_specialty',  status='active', auth_status='manual_only' WHERE id=3;
UPDATE dim_shop SET platform_code='kuaishou',    shop_name='快手官方旗舰店',       business_mode='standard', shop_type='kuaishou_flagship', status='active', auth_status='manual_only' WHERE id=4;
UPDATE dim_shop SET platform_code='kuaishou',    shop_name='快手食品专营店',       business_mode='standard', shop_type='kuaishou_specialty',status='active', auth_status='manual_only' WHERE id=5;
UPDATE dim_shop SET platform_code='kuaishou',    shop_name='快手服饰工厂店',       business_mode='standard', shop_type='kuaishou_factory',  status='active', auth_status='manual_only' WHERE id=6;
UPDATE dim_shop SET platform_code='wechat',      shop_name='视频号品牌自播旗舰店', business_mode='standard', shop_type='wechat_flagship',   status='active', auth_status='manual_only' WHERE id=7;
UPDATE dim_shop SET platform_code='wechat',      shop_name='视频号达人带货专营店', business_mode='standard', shop_type='wechat_specialty',  status='active', auth_status='manual_only' WHERE id=8;
UPDATE dim_shop SET platform_code='wechat',      shop_name='视频号私域精选店',     business_mode='standard', shop_type='wechat_private',    status='active', auth_status='manual_only' WHERE id=9;
UPDATE dim_shop SET platform_code='taobao',      shop_name='淘宝官方企业店',       business_mode='standard', shop_type='taobao_flagship',   status='active', auth_status='manual_only' WHERE id=10;
UPDATE dim_shop SET platform_code='taobao',      shop_name='淘宝数码专营店',       business_mode='standard', shop_type='taobao_specialty',  status='active', auth_status='manual_only' WHERE id=11;
UPDATE dim_shop SET platform_code='taobao',      shop_name='淘宝家居旗舰店',       business_mode='standard', shop_type='taobao_home',       status='active', auth_status='manual_only' WHERE id=12;
UPDATE dim_shop SET platform_code='tmall',       shop_name='天猫品牌官方旗舰店',   business_mode='standard', shop_type='tmall',             status='active', auth_status='manual_only' WHERE id=13;
UPDATE dim_shop SET platform_code='tmall',       shop_name='天猫美妆旗舰店',       business_mode='standard', shop_type='tmall',             status='active', auth_status='manual_only' WHERE id=14;
UPDATE dim_shop SET platform_code='tmall',       shop_name='天猫母婴旗舰店',       business_mode='standard', shop_type='tmall',             status='active', auth_status='manual_only' WHERE id=15;
UPDATE dim_shop SET platform_code='xiaohongshu', shop_name='小红书品牌官方号',     business_mode='standard', shop_type='xhs_brand',         status='active', auth_status='manual_only' WHERE id=16;
UPDATE dim_shop SET platform_code='xiaohongshu', shop_name='小红书美妆种草号',     business_mode='standard', shop_type='xhs_brand',         status='active', auth_status='manual_only' WHERE id=17;
UPDATE dim_shop SET platform_code='xiaohongshu', shop_name='小红书家居买手店',     business_mode='standard', shop_type='xhs_brand',         status='active', auth_status='manual_only' WHERE id=18;

INSERT INTO dim_shop (id, platform_code, shop_name, business_mode, shop_type, status, auth_status, tenant_id)
VALUES
  (1,  'douyin',      '抖音主营旗舰店',       'standard', 'douyin_flagship',   'active', 'manual_only', 1),
  (2,  'douyin',      '抖音美妆旗舰店',       'standard', 'douyin_specialty',  'active', 'manual_only', 1),
  (3,  'douyin',      '抖音食品专营店',       'standard', 'douyin_specialty',  'active', 'manual_only', 1),
  (4,  'kuaishou',    '快手官方旗舰店',       'standard', 'kuaishou_flagship', 'active', 'manual_only', 1),
  (5,  'kuaishou',    '快手食品专营店',       'standard', 'kuaishou_specialty','active', 'manual_only', 1),
  (6,  'kuaishou',    '快手服饰工厂店',       'standard', 'kuaishou_factory',  'active', 'manual_only', 1),
  (7,  'wechat',      '视频号品牌自播旗舰店', 'standard', 'wechat_flagship',   'active', 'manual_only', 1),
  (8,  'wechat',      '视频号达人带货专营店', 'standard', 'wechat_specialty',  'active', 'manual_only', 1),
  (9,  'wechat',      '视频号私域精选店',     'standard', 'wechat_private',    'active', 'manual_only', 1),
  (10, 'taobao',      '淘宝官方企业店',       'standard', 'taobao_flagship',   'active', 'manual_only', 1),
  (11, 'taobao',      '淘宝数码专营店',       'standard', 'taobao_specialty',  'active', 'manual_only', 1),
  (12, 'taobao',      '淘宝家居旗舰店',       'standard', 'taobao_home',       'active', 'manual_only', 1),
  (13, 'tmall',       '天猫品牌官方旗舰店',   'standard', 'tmall',             'active', 'manual_only', 1),
  (14, 'tmall',       '天猫美妆旗舰店',       'standard', 'tmall',             'active', 'manual_only', 1),
  (15, 'tmall',       '天猫母婴旗舰店',       'standard', 'tmall',             'active', 'manual_only', 1),
  (16, 'xiaohongshu', '小红书品牌官方号',     'standard', 'xhs_brand',         'active', 'manual_only', 1),
  (17, 'xiaohongshu', '小红书美妆种草号',     'standard', 'xhs_brand',         'active', 'manual_only', 1),
  (18, 'xiaohongshu', '小红书家居买手店',     'standard', 'xhs_brand',         'active', 'manual_only', 1)
ON CONFLICT (id) DO UPDATE SET
  platform_code = EXCLUDED.platform_code,
  shop_name = EXCLUDED.shop_name,
  business_mode = EXCLUDED.business_mode,
  shop_type = EXCLUDED.shop_type,
  status = EXCLUDED.status,
  auth_status = EXCLUDED.auth_status,
  tenant_id = EXCLUDED.tenant_id;

SELECT setval('dim_shop_id_seq', (SELECT COALESCE(MAX(id), 16) FROM dim_shop));

-- ════════════════════════════════════════════════════════════
-- 4. 商品主档（dim_product）：10 类目 × 66 SKU
-- ════════════════════════════════════════════════════════════
INSERT INTO dim_product (id, spu_code, sku_code, product_name, category, brand_name, unit_cost, retail_price, safety_stock, status, specs)
VALUES
  -- 1. 服饰鞋帽（10 SKU: ¥59~899，毛利 45%~60%）
  (1,  'SPU-2026-001', 'SKU-2026-001-BLK-M', '三防透气冲锋衣（曜石黑 / M）', '服饰鞋帽', 'Leyova Outdoor', 138.00, 399.00, 30, 'active', '{"颜色":"曜石黑","尺码":"M","面料":"Gore-Tex三防"}'::jsonb),
  (2,  'SPU-2026-001', 'SKU-2026-001-BLK-L', '三防透气冲锋衣（曜石黑 / L）', '服饰鞋帽', 'Leyova Outdoor', 138.00, 399.00, 35, 'active', '{"颜色":"曜石黑","尺码":"L","面料":"Gore-Tex三防"}'::jsonb),
  (3,  'SPU-2026-001', 'SKU-2026-001-KHK-L', '三防透气冲锋衣（山系卡其 / L）', '服饰鞋帽', 'Leyova Outdoor', 138.00, 399.00, 25, 'active', '{"颜色":"山系卡其","尺码":"L","面料":"Gore-Tex三防"}'::jsonb),
  (4,  'SPU-2026-002', 'SKU-2026-002-IVO-M', '100%美利奴羊毛打底衫（象牙白 / M）', '服饰鞋帽', 'Leyova Wool', 88.00, 229.00, 40, 'active', '{"颜色":"象牙白","尺码":"M","支数":"60支极细"}'::jsonb),
  (5,  'SPU-2026-002', 'SKU-2026-002-BLK-L', '100%美利奴羊毛打底衫（玄青黑 / L）', '服饰鞋帽', 'Leyova Wool', 88.00, 229.00, 35, 'active', '{"颜色":"玄青黑","尺码":"L","支数":"60支极细"}'::jsonb),
  (6,  'SPU-2026-003', 'SKU-2026-003-GRY-F', '德绒自发热无缝阔腿裤（浅雾灰 / 均码）', '服饰鞋帽', 'Leyova Daily', 48.00, 149.00, 50, 'active', '{"颜色":"浅雾灰","尺码":"均码","版型":"宽松垂坠"}'::jsonb),
  (7,  'SPU-2026-004', 'SKU-2026-004-BLK-L', '90白鹅绒轻量抗寒羽绒服（深空黑 / L）', '服饰鞋帽', 'Leyova Cold', 348.00, 799.00, 20, 'active', '{"充绒量":"180g","颜色":"深空黑","蓬松度":"750+"}'::jsonb),
  (8,  'SPU-2026-004', 'SKU-2026-004-WHT-M', '90白鹅绒轻量抗寒羽绒服（冰霜白 / M）', '服饰鞋帽', 'Leyova Cold', 348.00, 799.00, 15, 'active', '{"充绒量":"170g","颜色":"冰霜白","蓬松度":"750+"}'::jsonb),
  (9,  'SPU-2026-005', 'SKU-2026-005-WHT-41', '复古工装轻便低帮板鞋（经典白 / 41码）', '服饰鞋帽', 'Leyova Walk', 68.00, 179.00, 45, 'active', '{"颜色":"经典白","尺码":"41码","鞋底":"EVA缓震"}'::jsonb),
  (10, 'SPU-2026-006', 'SKU-2026-006-BLU-M', '重磅精梳棉复古休闲长袖衬衫（丹宁蓝 / M）', '服饰鞋帽', 'Leyova Classic', 75.00, 189.00, 30, 'active', '{"颜色":"丹宁蓝","尺码":"M","面料":"280g全棉"}'::jsonb),

  -- 2. 美妆个护（8 SKU: ¥29~499，毛利 55%~75%）
  (11, 'SPU-2026-011', 'SKU-2026-011-BOX-10', '玻尿酸深层补水修护面膜（10片装）', '美妆个护', 'Leyova Beauty', 22.00, 89.00, 60, 'active', '{"规格":"10片/盒","核心成分":"5D玻尿酸+积雪草"}'::jsonb),
  (12, 'SPU-2026-011', 'SKU-2026-011-BOX-20', '玻尿酸深层补水修护面膜（20片家庭装）', '美妆个护', 'Leyova Beauty', 38.00, 159.00, 50, 'active', '{"规格":"20片/盒","核心成分":"5D玻尿酸+积雪草"}'::jsonb),
  (13, 'SPU-2026-012', 'SKU-2026-012-BOT-150', '温和氨基酸净透洁面乳（150ml）', '美妆个护', 'Leyova Beauty', 16.50, 69.00, 70, 'active', '{"容量":"150ml","PH值":"弱酸性","香型":"无香"}'::jsonb),
  (14, 'SPU-2026-013', 'SKU-2026-013-SER-30', '二裂酵母抗老紧致赋活精华液（30ml）', '美妆个护', 'Leyova Beauty', 65.00, 269.00, 30, 'active', '{"容量":"30ml","浓度":"10%二裂酵母发酵滤液"}'::jsonb),
  (15, 'SPU-2026-014', 'SKU-2026-014-CRM-50', '多肽抗皱滋养修护晚霜（50g）', '美妆个护', 'Leyova Beauty', 58.00, 239.00, 25, 'active', '{"净含量":"50g","主要功效":"淡纹滋养"}'::jsonb),
  (16, 'SPU-2026-015', 'SKU-2026-015-SUN-50', '清透高倍防晒乳霜 SPF50+ PA++++（50ml）', '美妆个护', 'Leyova Beauty', 28.00, 99.00, 80, 'active', '{"防护等级":"SPF50+ PA++++","肤感":"清爽成膜快"}'::jsonb),
  (17, 'SPU-2026-016', 'SKU-2026-016-LIP-RED', '丝绒哑光持色锁水唇釉（冷茶玫瑰红）', '美妆个护', 'Leyova Beauty', 14.00, 59.00, 90, 'active', '{"色号":"#08冷茶玫瑰","质地":"空气丝绒"}'::jsonb),
  (18, 'SPU-2026-017', 'SKU-2026-017-OIL-100', '摩洛哥坚果修护柔顺护发精油（100ml）', '美妆个护', 'Leyova Beauty', 21.00, 79.00, 40, 'active', '{"容量":"100ml","适合发质":"烫染干枯受损"}'::jsonb),

  -- 3. 食品生鲜（8 SKU: ¥19~199，毛利 25%~40%）
  (19, 'SPU-2026-021', 'SKU-2026-021-COF-40', '云南保山冷萃精品冻干咖啡粉（2g*40颗）', '食品生鲜', 'Leyova Fresh', 42.00, 89.00, 50, 'active', '{"产地":"云南保山","规格":"2g*40颗","风味":"坚果可可"}'::jsonb),
  (20, 'SPU-2026-022', 'SKU-2026-022-BRD-10', '控卡全麦黑麦轻食代餐软欧包（85g*10袋）', '食品生鲜', 'Leyova Fresh', 24.00, 49.00, 60, 'active', '{"全麦含量":">=60%","保质期":"60天","包装":"独立单袋"}'::jsonb),
  (21, 'SPU-2026-023', 'SKU-2026-023-NUT-500', '原味无盐每日坚果礼盒装（25g*20包）', '食品生鲜', 'Leyova Fresh', 52.00, 99.00, 40, 'active', '{"配比":"6果仁+2果干","规格":"500g","工艺":"轻烘焙"}'::jsonb),
  (22, 'SPU-2026-024', 'SKU-2026-024-BEE-500', '内蒙古原切安格斯谷饲原味牛肉干（500g）', '食品生鲜', 'Leyova Fresh', 68.00, 119.00, 30, 'active', '{"净含量":"500g","风味":"经典风干原味","产地":"内蒙古"}'::jsonb),
  (23, 'SPU-2026-025', 'SKU-2026-025-TEA-100', '武夷山核心产区金骏眉特级红茶（100g听装）', '食品生鲜', 'Leyova Fresh', 78.00, 149.00, 25, 'active', '{"采摘标准":"单芽特级","净含量":"100g","包装":"马口铁密封听"}'::jsonb),
  (24, 'SPU-2026-026', 'SKU-2026-026-OAT-1KG', '澳洲整粒生烤免煮即食纯燕麦片（1kg罐装）', '食品生鲜', 'Leyova Fresh', 16.00, 29.90, 80, 'active', '{"规格":"1kg","配料":"100%澳洲燕麦","特点":"高膳食纤维"}'::jsonb),
  (25, 'SPU-2026-027', 'SKU-2026-027-CRB-1KG', '深海大西洋鲜冻捕捞熟冻熟甜雪蟹腿（1kg）', '食品生鲜', 'Leyova Fresh', 115.00, 189.00, 20, 'active', '{"储存":"-18℃冷冻","净重":"1000g","加工":"船冻捕捞"}'::jsonb),
  (26, 'SPU-2026-028', 'SKU-2026-028-HON-500', '长白山椴树天然结晶原蜜（500g玻璃瓶）', '食品生鲜', 'Leyova Fresh', 32.00, 69.00, 45, 'active', '{"波美度":">=42度","净含量":"500g","蜜源":"长白山椴树"}'::jsonb),

  -- 4. 数码3C（8 SKU: ¥199~4999，毛利 12%~25%）
  (27, 'SPU-2026-031', 'SKU-2026-031-ANC-BLK', '双馈主动降噪头戴式无线蓝牙耳机（墨夜黑）', '数码3C', 'Leyova Digital', 288.00, 399.00, 25, 'active', '{"降噪深度":"-45dB","续航":"60小时","蓝牙":"V5.4"}'::jsonb),
  (28, 'SPU-2026-031', 'SKU-2026-031-ANC-SIL', '双馈主动降噪头戴式无线蓝牙耳机（晨曦银）', '数码3C', 'Leyova Digital', 288.00, 399.00, 25, 'active', '{"降噪深度":"-45dB","续航":"60小时","蓝牙":"V5.4"}'::jsonb),
  (29, 'SPU-2026-032', 'SKU-2026-032-WCH-BLK', 'AMOLED高清屏运动健康监测智能手表（耀岩黑）', '数码3C', 'Leyova Digital', 345.00, 469.00, 30, 'active', '{"屏幕":"1.43英寸AMOLED","续航":"14天","防水":"5ATM"}'::jsonb),
  (30, 'SPU-2026-033', 'SKU-2026-033-KBD-RGB', '三模无线客制化机械键盘（全键热插拔/茶轴）', '数码3C', 'Leyova Digital', 218.00, 299.00, 40, 'active', '{"连接":"三模无线+Type-C","轴体":"润滑茶轴","键位":"87键"}'::jsonb),
  (31, 'SPU-2026-034', 'SKU-2026-034-BNK-20K', '65W双向氮化镓超级快充移动电源（20000mAh）', '数码3C', 'Leyova Digital', 145.00, 199.00, 50, 'active', '{"容量":"20000mAh","协议":"PD3.0/QC4+","端口":"2C1A"}'::jsonb),
  (32, 'SPU-2026-035', 'SKU-2026-035-TAB-256', '11英寸2.8K超清护眼学习办公平板电脑（8G+256G）', '数码3C', 'Leyova Digital', 1580.00, 1999.00, 15, 'active', '{"屏幕":"11寸2.8K 144Hz","内存":"8GB+256GB","电池":"8800mAh"}'::jsonb),
  (33, 'SPU-2026-036', 'SKU-2026-036-CAM-4K', '4K防抖云台户外运动全景相机套装', '数码3C', 'Leyova Digital', 1650.00, 2199.00, 12, 'active', '{"画质":"4K 60fps","防抖":"6轴电子防抖","裸机防水":"10米"}'::jsonb),
  (34, 'SPU-2026-037', 'SKU-2026-037-HUB-10N', '十合一多功能铝合金拓展坞（双HDMI+PD100W）', '数码3C', 'Leyova Digital', 148.00, 199.00, 35, 'active', '{"接口":"HDMI*2+USB3.0*3+PD+SD","材质":"CNC阳极铝"}'::jsonb),

  -- 5. 家居日用（6 SKU: ¥39~899，毛利 40%~55%）
  (35, 'SPU-2026-041', 'SKU-2026-041-PLW-WHT', '天然泰国进口乳胶抑菌波浪曲线护颈枕', '家居日用', 'Leyova Living', 78.00, 169.00, 40, 'active', '{"天然乳胶含量":"93%","高度":"10/12cm波浪","外套":"天丝面料"}'::jsonb),
  (36, 'SPU-2026-042', 'SKU-2026-042-SHT-QUE', '60支新疆长绒棉高密纯棉四件套（加大双人款）', '家居日用', 'Leyova Living', 165.00, 349.00, 30, 'active', '{"材质":"100%新疆长绒棉","规格":"适用1.8米床","工艺":"活性印染"}'::jsonb),
  (37, 'SPU-2026-043', 'SKU-2026-043-ROB-AUT', '全自动双旋擦地超薄静音拖扫一体扫地机', '家居日用', 'Leyova Living', 420.00, 899.00, 15, 'active', '{"吸力":"5000Pa","避障":"LDS激光导航","拖布":"对旋加压"}'::jsonb),
  (38, 'SPU-2026-044', 'SKU-2026-044-CND-200', '植物大豆蜡法式沙龙香氛蜡烛礼盒装（200g）', '家居日用', 'Leyova Living', 36.00, 79.00, 60, 'active', '{"净重":"200g","香型":"白茶与英国梨","燃烧时间":"约45小时"}'::jsonb),
  (39, 'SPU-2026-045', 'SKU-2026-045-TWL-3PC', '抗菌吸水无捻纱加厚素色洗脸毛巾3条装', '家居日用', 'Leyova Living', 18.00, 39.90, 80, 'active', '{"材质":"微米无捻超柔棉","数量":"3条装","克重":"120g/条"}'::jsonb),
  (40, 'SPU-2026-046', 'SKU-2026-046-ORG-5BX', '透明亚克力抽屉式桌面护肤品首饰收纳盒五件套', '家居日用', 'Leyova Living', 28.00, 69.00, 50, 'active', '{"材质":"环保加厚PET","组合":"3抽屉+2顶盒","特点":"防尘防水"}'::jsonb),

  -- 6. 母婴用品（6 SKU: ¥49~599，毛利 35%~50%）
  (41, 'SPU-2026-051', 'SKU-2026-051-DPR-L', '弱酸亲肤超薄透气婴儿纸尿裤（L码 84片）', '母婴用品', 'Leyova Baby', 58.00, 119.00, 60, 'active', '{"尺码":"L码(9-14kg)","片数":"84片","厚度":"0.18cm超薄"}'::jsonb),
  (42, 'SPU-2026-051', 'SKU-2026-051-DPR-XL', '弱酸亲肤超薄透气婴儿拉拉裤（XL码 76片）', '母婴用品', 'Leyova Baby', 58.00, 119.00, 50, 'active', '{"尺码":"XL码(12-17kg)","片数":"76片","厚度":"0.18cm超薄"}'::jsonb),
  (43, 'SPU-2026-052', 'SKU-2026-052-WIP-80X5', '食品级纯水无香无酒精特厚婴儿湿巾（80抽*5包）', '母婴用品', 'Leyova Baby', 22.00, 49.00, 80, 'active', '{"规格":"80抽*5包","配方":"EDI纯水+木糖醇","特点":"可入口级安全"}'::jsonb),
  (44, 'SPU-2026-053', 'SKU-2026-053-STR-F1', '轻量单手秒收高景观双向折叠婴儿手推车', '母婴用品', 'Leyova Baby', 290.00, 599.00, 18, 'active', '{"净重":"5.8kg","承重":"25kg","折叠体积":"可上飞机行李架"}'::jsonb),
  (45, 'SPU-2026-054', 'SKU-2026-054-BOT-240', 'PPSU仿母乳感宽口径耐高温防胀气奶瓶（240ml）', '母婴用品', 'Leyova Baby', 42.00, 89.00, 40, 'active', '{"容量":"240ml","瓶身材质":"德国进口PPSU","奶嘴":"食品级液态硅胶"}'::jsonb),
  (46, 'SPU-2026-055', 'SKU-2026-055-WSH-500', '植物基低泡无泪配方婴童二合一洗发沐浴露（500ml）', '母婴用品', 'Leyova Baby', 31.00, 69.00, 45, 'active', '{"容量":"500ml","认证":"欧盟有机认证原料","PH":"弱酸性中性"}'::jsonb),

  -- 7. 运动户外（6 SKU: ¥89~1999，毛利 35%~50%）
  (47, 'SPU-2026-061', 'SKU-2026-061-TNT-3P', '一秒全自动黑胶防晒野外露营速开帐篷（3-4人）', '运动户外', 'Leyova Trek', 245.00, 499.00, 20, 'active', '{"容量":"3-4人","涂层":"全贴胶黑胶PU3000","撑杆":"航空玻璃纤维"}'::jsonb),
  (48, 'SPU-2026-062', 'SKU-2026-062-TRD-SLM', '家用可折叠减震超静音走步机智能平板跑步机', '运动户外', 'Leyova Trek', 680.00, 1299.00, 10, 'active', '{"载重":"110kg","跑带面积":"120*45cm","折叠厚度":"14cm"}'::jsonb),
  (49, 'SPU-2026-063', 'SKU-2026-063-MAT-8MM', '加宽加厚防滑高弹TPE环保双面专业瑜伽垫（8mm）', '运动户外', 'Leyova Trek', 45.00, 99.00, 60, 'active', '{"厚度":"8mm加厚","材质":"高密度TPE","尺寸":"183*68cm"}'::jsonb),
  (50, 'SPU-2026-064', 'SKU-2026-064-BTL-1L', '户外双层真空316不锈钢运动保温保冷壶（1000ml）', '运动户外', 'Leyova Trek', 42.00, 89.00, 50, 'active', '{"内胆":"医用级316不锈钢","容量":"1000ml","保温性能":"24小时长效"}'::jsonb),
  (51, 'SPU-2026-065', 'SKU-2026-065-BAG-50L', '专业高承重轻量化户外登山徒步双肩包（50L）', '运动户外', 'Leyova Trek', 135.00, 269.00, 30, 'active', '{"容积":"50L","背负系统":"TCS透气减负背负","面料":"抗撕裂防泼水尼龙"}'::jsonb),
  (52, 'SPU-2026-066', 'SKU-2026-066-STK-2PC', '超轻三节外锁碳纤维徒步登山杖一对装（含泥托）', '运动户外', 'Leyova Trek', 92.00, 189.00, 35, 'active', '{"材质":"99%碳纤维","重量":"单支仅195g","锁定":"合金快速外锁"}'::jsonb),

  -- 8. 宠物用品（5 SKU: ¥29~499，毛利 40%~58%）
  (53, 'SPU-2026-071', 'SKU-2026-071-CAT-2KG', '低温烘焙无谷高肉生骨肉全价冻干鲜肉猫粮（2kg）', '宠物用品', 'Leyova Pet', 78.00, 169.00, 45, 'active', '{"肉类含量":"88%","粗蛋白":">=42%","烘焙温度":"90℃慢火烘焙"}'::jsonb),
  (54, 'SPU-2026-072', 'SKU-2026-072-LIT-6KG', '原味食品级结团吸臭无尘原生豆腐混合猫砂（6kg）', '宠物用品', 'Leyova Pet', 18.00, 39.90, 80, 'active', '{"成分":"70%豌豆豆腐+30%钠基膨润土","粉尘":">=99.9%洁净","可冲马桶":"是"}'::jsonb),
  (55, 'SPU-2026-073', 'SKU-2026-073-WTR-2L', '全静音循环过滤宠物智能感应自动饮水机（2.5L）', '宠物用品', 'Leyova Pet', 52.00, 109.00, 35, 'active', '{"容量":"2.5L","水泵分贝":"<25dB静音","滤芯":"四重精滤麦饭石复合"}'::jsonb),
  (56, 'SPU-2026-074', 'SKU-2026-074-BED-OVAL', '加厚回弹记忆棉保暖深睡甜甜圈猫窝狗窝（中号）', '宠物用品', 'Leyova Pet', 36.00, 79.00, 50, 'active', '{"填充":"波浪透气记忆棉","面料":"加厚PV仿兔毛","可拆洗":"全拉链易拆洗"}'::jsonb),
  (57, 'SPU-2026-075', 'SKU-2026-075-FDG-BOX', '纯鲜肉多拼原切宠物补钙冻干零食全家桶（400g）', '宠物用品', 'Leyova Pet', 38.00, 89.00, 40, 'active', '{"肉源":"鸡胸肉+鸭肉+蛋黄+三文鱼","工艺":"-35℃真空冷冻干燥"}'::jsonb),

  -- 9. 小家电（5 SKU: ¥99~2999，毛利 25%~45%）
  (58, 'SPU-2026-081', 'SKU-2026-081-AIR-5L', '可视化大容量触控智能无油多功能空气炸锅（5.5L）', '小家电', 'Leyova Home', 115.00, 199.00, 35, 'active', '{"容量":"5.5L","功率":"1500W","视窗":"双层耐热玻璃全景"}'::jsonb),
  (59, 'SPU-2026-082', 'SKU-2026-082-BLD-1L', '低音降噪免滤破壁机多功能家用加热豆浆料理机', '小家电', 'Leyova Home', 165.00, 279.00, 25, 'active', '{"刀头":"8叶精钢锯齿刀","噪音":"48dB柔音罩","容量":"冷饮1200ml/热饮800ml"}'::jsonb),
  (60, 'SPU-2026-083', 'SKU-2026-083-FAN-WRL', '负离子除菌直流变频遥控摇头循环空气对流落地扇', '小家电', 'Leyova Home', 128.00, 229.00, 30, 'active', '{"电机":"日本NMB无刷直流变频","风量":"24m³/min","挡位":"12档风速"}'::jsonb),
  (61, 'SPU-2026-084', 'SKU-2026-084-KTL-GOO', '高精度温控恒温手冲咖啡长嘴细口电热水壶（0.8L）', '小家电', 'Leyova Home', 142.00, 249.00, 30, 'active', '{"温控":"英国Strix温控器","精度":"±1℃","容量":"800ml"}'::jsonb),
  (62, 'SPU-2026-085', 'SKU-2026-085-IRN-MIN', '便携式折叠增压蒸汽手持挂烫机家用迷你电熨斗', '小家电', 'Leyova Home', 62.00, 119.00, 45, 'active', '{"预热时间":"15秒","蒸汽量":"22g/min","面板":"陶瓷釉顺滑面板"}'::jsonb),

  -- 10. 医药健康（4 SKU: ¥39~399，毛利 45%~65%）
  (63, 'SPU-2026-091', 'SKU-2026-091-VTC-100', '天然针叶樱桃高浓度维生素C咀嚼片（100片）', '医药健康', 'Leyova Health', 22.00, 59.00, 60, 'active', '{"规格":"100片/瓶","每片VC含量":"200mg","原料":"巴西进口针叶樱桃"}'::jsonb),
  (64, 'SPU-2026-092', 'SKU-2026-092-BPM-VOX', '医用级一键精准全自动上臂式家用电子血压计', '医药健康', 'Leyova Health', 88.00, 199.00, 30, 'active', '{"测量原理":"示波法双核芯片","语音播报":"大音量中文全程","认证":"二类医疗器械"}'::jsonb),
  (65, 'SPU-2026-093', 'SKU-2026-093-GLC-50T', '免调码微量采血家用智能血糖仪测试仪试纸套装', '医药健康', 'Leyova Health', 45.00, 99.00, 50, 'active', '{"配件":"血糖仪主机+50片试纸+50采血针","采血量":"0.6微升","出结果":"5秒"}'::jsonb),
  (66, 'SPU-2026-094', 'SKU-2026-094-MSK-KN95', '医用五层防护KN95立体透气防尘无菌防护口罩（50只）', '医药健康', 'Leyova Health', 18.00, 49.00, 100, 'active', '{"防护标准":"GB19083-2010医用级","数量":"50只独立包","过滤效率":">=99%"}'::jsonb)
ON CONFLICT (sku_code) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  category = EXCLUDED.category,
  brand_name = EXCLUDED.brand_name,
  unit_cost = EXCLUDED.unit_cost,
  retail_price = EXCLUDED.retail_price,
  safety_stock = EXCLUDED.safety_stock,
  status = EXCLUDED.status,
  specs = EXCLUDED.specs,
  updated_at = now();

SELECT setval('dim_product_id_seq', (SELECT COALESCE(MAX(id), 66) FROM dim_product));

-- ════════════════════════════════════════════════════════════
-- 5. SKU 映射表（dim_sku_mapping）：66 SKU × 16 店 = 1,056 行
-- ════════════════════════════════════════════════════════════
INSERT INTO dim_sku_mapping (product_id, platform_code, shop_id, platform_item_id, platform_sku_id, platform_sku_name, is_active)
SELECT p.id, s.platform_code, s.id,
       upper(substring(s.platform_code, 1, 2)) || '-ITEM-' || p.id,
       upper(substring(s.platform_code, 1, 2)) || '-SKU-' || p.id,
       p.product_name, true
FROM dim_product p
CROSS JOIN dim_shop s
WHERE s.status = 'active'
ON CONFLICT (platform_code, shop_id, platform_sku_id) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  platform_item_id = EXCLUDED.platform_item_id,
  platform_sku_name = EXCLUDED.platform_sku_name,
  is_active = EXCLUDED.is_active;

SELECT setval('dim_sku_mapping_id_seq', (SELECT COALESCE(MAX(id), 1) FROM dim_sku_mapping));

-- ════════════════════════════════════════════════════════════
-- 6. 直播间（live_rooms）：24 间覆盖 16 家店铺
-- ════════════════════════════════════════════════════════════
INSERT INTO live_rooms (id, name, platform, status, shop_id, platform_code)
VALUES
  (1,  '抖音主营旗舰店-1号直播间',      '抖音',   'active', 1,  'douyin'),
  (2,  '抖音主营旗舰店-2号品质间',      '抖音',   'active', 1,  'douyin'),
  (3,  '抖音美妆旗舰店-专场直播间',     '抖音',   'active', 2,  'douyin'),
  (4,  '抖音食品专营店-吃播直播间',     '抖音',   'active', 3,  'douyin'),
  (5,  '快手官方旗舰店-老铁福利间',     '快手',   'active', 4,  'kuaishou'),
  (6,  '快手官方旗舰店-达人联名间',     '快手',   'active', 4,  'kuaishou'),
  (7,  '快手食品专营店-源头严选间',     '快手',   'active', 5,  'kuaishou'),
  (8,  '快手服饰工厂店-工厂直供间',     '快手',   'active', 6,  'kuaishou'),
  (9,  '视频号品牌自播旗舰店-品牌直播厅','视频号', 'active', 7,  'wechat'),
  (10, '视频号品牌自播旗舰店-私域专场',  '视频号', 'active', 7,  'wechat'),
  (11, '视频号达人带货专营店-达人带货厅','视频号', 'active', 8,  'wechat'),
  (12, '视频号私域精选店-社群精选间',    '视频号', 'active', 9,  'wechat'),
  (13, '淘宝官方企业店-主理人直播间',    '淘宝',   'active', 10, 'taobao'),
  (14, '淘宝官方企业店-会员专享间',      '淘宝',   'active', 10, 'taobao'),
  (15, '淘宝数码专营店-极客评测间',      '淘宝',   'active', 11, 'taobao'),
  (16, '淘宝家居旗舰店-生活美学间',      '淘宝',   'active', 12, 'taobao'),
  (17, '天猫品牌官方旗舰店-品牌直播厅',  '天猫',   'active', 13, 'tmall'),
  (18, '天猫品牌官方旗舰店-大促主会场',  '天猫',   'active', 13, 'tmall'),
  (19, '天猫美妆旗舰店-奢美秀场间',      '天猫',   'active', 14, 'tmall'),
  (20, '天猫母婴旗舰店-育儿专场',        '天猫',   'active', 15, 'tmall'),
  (21, '小红书品牌官方号-种草直播间',    '小红书', 'active', 16, 'xiaohongshu'),
  (22, '小红书品牌官方号-穿搭私享间',    '小红书', 'active', 16, 'xiaohongshu'),
  (23, '小红书美妆种草号-素颜变美间',    '小红书', 'active', 17, 'xiaohongshu'),
  (24, '小红书家居买手店-买手精选间',    '小红书', 'active', 18, 'xiaohongshu')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  platform = EXCLUDED.platform,
  status = EXCLUDED.status,
  shop_id = EXCLUDED.shop_id,
  platform_code = EXCLUDED.platform_code;

SELECT setval('live_rooms_id_seq', (SELECT COALESCE(MAX(id), 24) FROM live_rooms));

-- ════════════════════════════════════════════════════════════
-- 7. 主播主档（anchors）：32 位主播
-- ════════════════════════════════════════════════════════════
INSERT INTO anchors (id, name, platform, level, status, platform_code)
VALUES
  (1,  '沈知夏', '抖音',   'S级', 1, 'douyin'),
  (2,  '林清和', '抖音',   'A级', 1, 'douyin'),
  (3,  '苏沐春', '抖音',   'A级', 1, 'douyin'),
  (4,  '陆星野', '抖音',   'B级', 1, 'douyin'),
  (5,  '叶南音', '抖音',   'B级', 1, 'douyin'),
  (6,  '顾清欢', '抖音',   'A级', 1, 'douyin'),
  (7,  '唐不言', '抖音',   'B级', 1, 'douyin'),
  (8,  '温以宁', '抖音',   'C级', 1, 'douyin'),
  (9,  '程霜降', '抖音',   'B级', 1, 'douyin'),
  (10, '许知意', '抖音',   'A级', 1, 'douyin'),
  (11, '何须臾', '快手',   'A级', 1, 'kuaishou'),
  (12, '秦望舒', '快手',   'B级', 1, 'kuaishou'),
  (13, '宋亦寒', '快手',   'B级', 1, 'kuaishou'),
  (14, '方锦夕', '快手',   'C级', 1, 'kuaishou'),
  (15, '段千寻', '快手',   'A级', 1, 'kuaishou'),
  (16, '江逾白', '快手',   'B级', 1, 'kuaishou'),
  (17, '顾南舟', '视频号', 'A级', 1, 'wechat'),
  (18, '沈知微', '视频号', 'S级', 1, 'wechat'),
  (19, '梁听白', '视频号', 'B级', 1, 'wechat'),
  (20, '韩星阑', '视频号', 'A级', 1, 'wechat'),
  (21, '裴云深', '视频号', 'B级', 1, 'wechat'),
  (22, '阮清秋', '视频号', 'C级', 1, 'wechat'),
  (23, '施南乔', '淘宝',   'S级', 1, 'taobao'),
  (24, '卓未晞', '淘宝',   'A级', 1, 'taobao'),
  (25, '白梦泽', '淘宝',   'B级', 1, 'taobao'),
  (26, '楚天阔', '淘宝',   'B级', 1, 'taobao'),
  (27, '柳扶风', '淘宝',   'A级', 1, 'taobao'),
  (28, '莫问归', '天猫',   'A级', 1, 'tmall'),
  (29, '宁长生', '天猫',   'B级', 1, 'tmall'),
  (30, '齐云深', '天猫',   'B级', 1, 'tmall'),
  (31, '任轻舟', '天猫',   'A级', 1, 'tmall'),
  (32, '司空摘星', '天猫', 'C级', 1, 'tmall'),
  (33, '陶陶然', '小红书', 'A级', 1, 'xiaohongshu'),
  (34, '魏无羡', '小红书', 'B级', 1, 'xiaohongshu'),
  (35, '云知遥', '小红书', 'B级', 1, 'xiaohongshu'),
  (36, '祁连山', '小红书', 'C级', 1, 'xiaohongshu')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  platform = EXCLUDED.platform,
  level = EXCLUDED.level,
  status = EXCLUDED.status,
  platform_code = EXCLUDED.platform_code;

SELECT setval('live_rooms_id_seq', (SELECT COALESCE(MAX(id), 24) FROM live_rooms));

-- ════════════════════════════════════════════════════════════
-- 7. 主播主档（anchors）：32 位主播
-- ════════════════════════════════════════════════════════════
INSERT INTO anchors (id, name, platform, level, status, platform_code)
VALUES
  (1,  '沈知夏', '抖音',   'S级', 1, 'douyin'),
  (2,  '林清和', '抖音',   'A级', 1, 'douyin'),
  (3,  '苏沐春', '抖音',   'A级', 1, 'douyin'),
  (4,  '陆星野', '抖音',   'B级', 1, 'douyin'),
  (5,  '叶南音', '抖音',   'B级', 1, 'douyin'),
  (6,  '顾清欢', '抖音',   'A级', 1, 'douyin'),
  (7,  '唐不言', '抖音',   'B级', 1, 'douyin'),
  (8,  '温以宁', '抖音',   'C级', 1, 'douyin'),
  (9,  '程霜降', '抖音',   'B级', 1, 'douyin'),
  (10, '许知意', '抖音',   'A级', 1, 'douyin'),
  (11, '何须臾', '快手',   'A级', 1, 'kuaishou'),
  (12, '秦望舒', '快手',   'B级', 1, 'kuaishou'),
  (13, '宋亦寒', '快手',   'B级', 1, 'kuaishou'),
  (14, '方锦夕', '快手',   'C级', 1, 'kuaishou'),
  (15, '梁听白', '淘宝',   'S级', 1, 'taobao'),
  (16, '韩星阑', '淘宝',   'A级', 1, 'taobao'),
  (17, '裴云深', '淘宝',   'B级', 1, 'taobao'),
  (18, '阮清秋', '淘宝',   'B级', 1, 'taobao'),
  (19, '施南乔', '天猫',   'S级', 1, 'tmall'),
  (20, '卓未晞', '天猫',   'A级', 1, 'tmall'),
  (21, '白梦泽', '天猫',   'B级', 1, 'tmall'),
  (22, '楚天阔', '天猫',   'B级', 1, 'tmall'),
  (23, '顾南舟', '视频号', 'A级', 1, 'wechat'),
  (24, '沈知微', '视频号', 'S级', 1, 'wechat'),
  (25, '云知遥', '视频号', 'B级', 1, 'wechat'),
  (26, '祁连山', '视频号', 'C级', 1, 'wechat'),
  (27, '柳扶风', '淘宝',   'A级', 1, 'taobao'),
  (28, '莫问归', '天猫',   'A级', 1, 'tmall'),
  (29, '宁长生', '天猫',   'B级', 1, 'tmall'),
  (30, '齐云深', '天猫',   'B级', 1, 'tmall'),
  (31, '陶陶然', '小红书', 'A级', 1, 'xiaohongshu'),
  (32, '魏无羡', '小红书', 'B级', 1, 'xiaohongshu')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  platform = EXCLUDED.platform,
  level = EXCLUDED.level,
  status = EXCLUDED.status,
  platform_code = EXCLUDED.platform_code;

-- 关联既有测试用户 anchor_shen 到主播 1
UPDATE users SET anchor_id = 1 WHERE id = 11;

INSERT INTO anchor_profiles (id, level, followers, join_date, email, phone, tags)
SELECT a.id, a.level,
       (30000 + a.id * 8500),
       '2026-01-10'::date + (a.id * 3),
       'anchor' || lpad(a.id::text, 2, '0') || '@leyova.demo',
       '1390000' || lpad(a.id::text, 4, '0'),
       CASE WHEN a.level IN ('S级','A级') THEN ARRAY['核心控场','高转化','头部主推']::text[]
            WHEN a.level = 'B级' THEN ARRAY['讲解细致','亲和力强','稳健型']::text[]
            ELSE ARRAY['成长型主播','品类专精']::text[] END
FROM anchors a
ON CONFLICT (id) DO UPDATE SET
  level = EXCLUDED.level,
  followers = EXCLUDED.followers,
  join_date = EXCLUDED.join_date,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  tags = EXCLUDED.tags;

SELECT setval('anchors_id_seq', (SELECT COALESCE(MAX(id), 36) FROM anchors));

-- ════════════════════════════════════════════════════════════
-- 8. 运营与场控（operators）：24 人
-- ════════════════════════════════════════════════════════════
INSERT INTO operators (id, name, employee_id, status)
SELECT g,
       (ARRAY['陈一鸣','李思远','王雨桐','赵子涵','周若彤','吴昊然','郑雅雯','孙嘉豪',
              '黄梦洁','徐之远','刘紫晴','张志强','何晨曦','杨博文','马嘉怡','朱云鹏',
              '高雅丽','郭天明','林书豪','胡一凡','卢思敏','罗俊杰','彭海峰','崔子健'])[g],
       'OP' || lpad(g::text, 4, '0'),
       1
FROM generate_series(1, 24) g
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  employee_id = EXCLUDED.employee_id,
  status = EXCLUDED.status;

SELECT setval('operators_id_seq', (SELECT COALESCE(MAX(id), 24) FROM operators));

-- ════════════════════════════════════════════════════════════
-- 9. 达人主档（dim_kol）：12 位达人
-- ════════════════════════════════════════════════════════════
INSERT INTO dim_kol (id, kol_name, platform_code, platform_uid, tier, fans_count, category, default_commission_rate, status)
VALUES
  (1,  '大米穿搭日记',   'douyin',      'DY_KOL_001', 'head',  2800000, '服饰鞋帽', 0.2000, 'active'),
  (2,  '阿喵美妆评测',   'douyin',      'DY_KOL_002', 'waist',  950000, '美妆个护', 0.1800, 'active'),
  (3,  '老饕寻味处',     'douyin',      'DY_KOL_003', 'waist',  680000, '食品生鲜', 0.1500, 'active'),
  (4,  '极客老王数码',   'taobao',      'TB_KOL_004', 'head',  1600000, '数码3C',   0.1200, 'active'),
  (5,  '苏苏的温暖家',   'tmall',       'TM_KOL_005', 'waist',  820000, '家居日用', 0.1500, 'active'),
  (6,  '宝妈萌娃日记',   'kuaishou',    'KS_KOL_006', 'head',  2200000, '母婴用品', 0.1800, 'active'),
  (7,  '山系户外阿飞',   'xiaohongshu', 'XHS_KOL_007','waist',  540000, '运动户外', 0.2500, 'active'),
  (8,  '毛孩子日常社',   'xiaohongshu', 'XHS_KOL_008','waist',  430000, '宠物用品', 0.2200, 'active'),
  (9,  '生活家小敏',     'wechat',      'WX_KOL_009', 'tail',   260000, '小家电',   0.1000, 'active'),
  (10, '健康营养师李姐', 'wechat',      'WX_KOL_010', 'tail',   180000, '医药健康', 0.1500, 'active'),
  (11, '时尚博主Vivian', 'xiaohongshu', 'XHS_KOL_011','head',  1950000, '服饰鞋帽', 0.2800, 'active'),
  (12, '老铁精选优品',   'kuaishou',    'KS_KOL_012', 'waist',  760000, '家居日用', 0.1600, 'active')
ON CONFLICT (id) DO UPDATE SET
  kol_name = EXCLUDED.kol_name,
  platform_code = EXCLUDED.platform_code,
  platform_uid = EXCLUDED.platform_uid,
  tier = EXCLUDED.tier,
  fans_count = EXCLUDED.fans_count,
  category = EXCLUDED.category,
  default_commission_rate = EXCLUDED.default_commission_rate,
  status = EXCLUDED.status;

SELECT setval('dim_kol_id_seq', (SELECT COALESCE(MAX(id), 12) FROM dim_kol));

-- ════════════════════════════════════════════════════════════
-- 10. 客服主档（dim_cs_agent）：8 名客服
-- ════════════════════════════════════════════════════════════
INSERT INTO dim_cs_agent (id, agent_code, agent_name, platform_code, shop_id, shift_group, status)
VALUES
  (1, 'CS-DY-01',  '抖音早班01-小雅', 'douyin',      1,  'day',   'online'),
  (2, 'CS-DY-02',  '抖音晚班02-小峰', 'douyin',      1,  'night', 'online'),
  (3, 'CS-TB-01',  '淘宝旗舰-小婷',   'taobao',      2,  'day',   'online'),
  (4, 'CS-TM-01',  '天猫尊享-小慧',   'tmall',       3,  'day',   'online'),
  (5, 'CS-WX-02',  '视频号品牌-小周',  'wechat',      7,  'day',   'online'),
  (6, 'CS-WX-01',  '视频号品牌-小陈', 'wechat',      7,  'day',   'online'),
  (7, 'CS-KS-01',  '快手小店-小芳',   'kuaishou',    6,  'day',   'online'),
  (8, 'CS-XHS-01', '小红书种草-小敏', 'xiaohongshu', 7,  'day',   'online')
ON CONFLICT (id) DO UPDATE SET
  agent_code = EXCLUDED.agent_code,
  agent_name = EXCLUDED.agent_name,
  platform_code = EXCLUDED.platform_code,
  shop_id = EXCLUDED.shop_id,
  shift_group = EXCLUDED.shift_group,
  status = EXCLUDED.status;

SELECT setval('dim_cs_agent_id_seq', (SELECT COALESCE(MAX(id), 8) FROM dim_cs_agent));

-- ════════════════════════════════════════════════════════════
-- 11. 价格让利常态规则（pricing_rules）：8 平台 16 条
-- ════════════════════════════════════════════════════════════
INSERT INTO pricing_rules (id, tenant_id, platform_code, shop_id, rule_layer, rule_name, discount_mode, discount_value, is_exclusive, merchant_cost_ratio, platform_cost_ratio, note, is_active)
VALUES
  -- 天猫（完整五层体系）
  (1,  1, 'tmall',       3,  1, '天猫官方立减 15%',             'official_reduction', 0.1500, false, 1.0000, 0.0000, '店铺官方立减，商家全额让利', true),
  (2,  1, 'tmall',       3,  2, '天猫店铺满减优惠券 5%',        'store_coupon',       0.0500, false, 1.0000, 0.0000, '店铺满减券，商家承担', true),
  (3,  1, 'tmall',       3,  3, '天猫品类专属消费券 5%',        'category_coupon',    0.0500, false, 0.3000, 0.7000, '平台补贴70%，商家让利30%', true),
  (4,  1, 'tmall',       3,  4, '88VIP 95折与品效消费券',       'vip_discount',       0.0500, false, 0.5000, 0.5000, '会员权益，各承担50%', true),
  (5,  1, 'tmall',       3,  5, '国家绿色以旧换新补贴与平台红包', 'national_subsidy',   0.0500, false, 0.0000, 1.0000, '国补与平台红包，商家零让利', true),

  -- 淘宝（3层）
  (6,  1, 'taobao',      2,  1, '淘宝跨店立减 10%',             'official_reduction', 0.1000, false, 1.0000, 0.0000, '跨店立减，商家承担', true),
  (7,  1, 'taobao',      2,  2, '淘宝淘金币与店铺券 5%',        'store_coupon',       0.0500, false, 0.8000, 0.2000, '店铺淘金币抵扣', true),
  (8,  1, 'taobao',      2,  4, '淘宝企业会员专属折 5%',        'vip_discount',       0.0500, false, 0.5000, 0.5000, '会员等级折扣', true),

  -- 抖音（2层）
  (9,  1, 'douyin',      1,  1, '抖音商城官方立减 12%',         'official_reduction', 0.1200, false, 1.0000, 0.0000, '抖店立减', true),
  (10, 1, 'douyin',      1,  2, '抖音直播间福袋红包券 5%',      'red_packet',         0.0500, false, 0.6000, 0.4000, '直播间互动红包', true),

  -- 京东自营（2层）
  (11, 1, 'wechat',      7,  1, '视频号小店新客立减 10%',       'official_reduction', 0.1000, false, 1.0000, 0.0000, '视频号新客专享', true),
  (12, 1, 'wechat',      8,  5, '视频号私域专属券 10%',          'store_coupon',       0.1000, false, 1.0000, 0.0000, '私域社群专享', true),

  -- 京东 POP（1层）
  (13, 1, 'taobao',      10, 1, '淘宝店铺满减 8%',              'official_reduction', 0.0800, false, 1.0000, 0.0000, '淘宝店铺自主立减', true),

  -- 拼多多（1层，百亿补贴平台承担）
  (14, 1, 'xiaohongshu', 16, 1, '小红书买手专享直减 20%',       'official_reduction', 0.2000, false, 0.0000, 1.0000, '买手直播间专享', true),

  -- 快手（1层）
  (15, 1, 'kuaishou',    6,  2, '快手粉丝团专属优惠券 8%',      'store_coupon',       0.0800, false, 0.7000, 0.3000, '老铁专属粉丝券', true),

  -- 小红书（1层）
  (16, 1, 'xiaohongshu', 7,  2, '小红书薯店粉丝券 10%',         'store_coupon',       0.1000, false, 0.9000, 0.1000, '笔记挂车立减券', true)
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  platform_code = EXCLUDED.platform_code,
  shop_id = EXCLUDED.shop_id,
  rule_layer = EXCLUDED.rule_layer,
  rule_name = EXCLUDED.rule_name,
  discount_mode = EXCLUDED.discount_mode,
  discount_value = EXCLUDED.discount_value,
  is_exclusive = EXCLUDED.is_exclusive,
  merchant_cost_ratio = EXCLUDED.merchant_cost_ratio,
  platform_cost_ratio = EXCLUDED.platform_cost_ratio,
  note = EXCLUDED.note,
  is_active = EXCLUDED.is_active;

SELECT setval('pricing_rules_id_seq', (SELECT COALESCE(MAX(id), 16) FROM pricing_rules));

-- ════════════════════════════════════════════════════════════
-- 12. 大促活动（promotions）：12 个大促
-- ════════════════════════════════════════════════════════════
INSERT INTO promotions (id, name, type, content, start_date, end_date, applicable_rooms, applicable_anchors, target_gmv, current_gmv, status)
VALUES
  (1,  '天猫双11全球狂欢节·预售狂欢', 'platform_event', '官方立减+88VIP大额券+满300减50', '2026-10-20', '2026-11-03', '[3,4,5,15,20]'::jsonb, '[15,16,19,20]'::jsonb, 5000000.00, 4820000.00, 'ended'),
  (2,  '天猫双11全球狂欢节·爆发冲刺', 'platform_event', '全周期爆发冲刺，品类神券叠加',     '2026-11-04', '2026-11-11', '[3,4,5,15,20]'::jsonb, '[15,16,19,20]'::jsonb, 8000000.00, 8350000.00, 'ended'),
  (3,  '抖音双11好物节·宠粉狂欢',     'platform_event', '千川加投，千万红包雨，爆品破价',   '2026-10-25', '2026-11-11', '[1,2,11,12,19]'::jsonb, '[1,2,3,6,10]'::jsonb,   6500000.00, 6720000.00, 'ended'),
  (4,  '京东11.11全球好物节',         'platform_event', '白条免息，以旧换新国补专场',       '2026-10-28', '2026-11-12', '[6,10,14,16,21]'::jsonb, '[23,24,25]'::jsonb,    4500000.00, 4390000.00, 'ended'),
  (5,  '快手116品质购物节',           'platform_event', '老铁宠粉节，主播联名超级专场',     '2026-10-26', '2026-11-11', '[8,13,22]'::jsonb,       '[11,12,13]'::jsonb,    3000000.00, 3120000.00, 'ended'),
  (6,  '拼多多百亿补贴超级大促',     'platform_event', '大牌正品官方补贴，多人成团秒杀',   '2026-11-01', '2026-11-12', '[7,17]'::jsonb,          '[28,29]'::jsonb,       2800000.00, 2950000.00, 'ended'),
  (7,  '小红书双11种草直播嘉年华',   'platform_event', '博主联动种草，全网独家首发',       '2026-10-22', '2026-11-11', '[9,18,24]'::jsonb,       '[31,32]'::jsonb,       2200000.00, 2180000.00, 'ended'),
  (8,  '88VIP年度超级会员日',         'brand_event',    '天猫88VIP用户独享95折大促',        '2026-08-18', '2026-08-20', '[3,4,20]'::jsonb,         '[19,20]'::jsonb,       1500000.00, 1540000.00, 'ended'),
  (9,  '99百亿补贴划算节',            'platform_event', '秋季焕新大促，多渠道爆款让利',     '2026-09-08', '2026-09-12', '[1,3,6,8,10]'::jsonb,    '[1,15,19,23]'::jsonb,  3500000.00, 3610000.00, 'ended'),
  (10, '金秋焕新开学季特惠',         'live_special',   '户外露营与数码装备专场',           '2026-08-28', '2026-09-03', '[1,6,14,16]'::jsonb,     '[2,16,24]'::jsonb,     1800000.00, 1780000.00, 'ended'),
  (11, '双12年终好物狂欢预热',       'platform_event', '双12年终冲刺，蓄水爆款抢先订',     '2026-11-15', '2026-11-30', '[1,3,4,8,10]'::jsonb,    '[1,2,15,19,23]'::jsonb,3000000.00, 1200000.00, 'ongoing'),
  (12, '元旦年货节超级专场',         'brand_event',    '年终礼盒与冬令滋补囤货节',         '2026-12-20', '2027-01-05', '[1,2,3,6,8,10]'::jsonb,  '[1,3,15,19,23]'::jsonb,4000000.00, 0.00,       'preparing')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  content = EXCLUDED.content,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  applicable_rooms = EXCLUDED.applicable_rooms,
  applicable_anchors = EXCLUDED.applicable_anchors,
  target_gmv = EXCLUDED.target_gmv,
  current_gmv = EXCLUDED.current_gmv,
  status = EXCLUDED.status;

SELECT setval('promotions_id_seq', (SELECT COALESCE(MAX(id), 12) FROM promotions));

-- ════════════════════════════════════════════════════════════
-- 13. 话术库与问题库（辅助支撑表）
-- ════════════════════════════════════════════════════════════
INSERT INTO script_library (id, title, category, content, use_count, likes)
VALUES
  (1,  '高吸睛黄金 3 秒开场留人话术',   '开场', '“姐妹们停下！今天这件冲锋衣，面料直接对标专业大牌，上身瞬间显瘦显精神，今天在直播间首发直降，拼手速！”', 188, 76),
  (2,  '核心卖点 3+1 黄金讲解公式',      '讲解', '“第一看版型，第二看面料，第三看细节走线。加上我们品牌独家一年质保，买回去不合适全额包退！”',           156, 62),
  (3,  '阶梯式价格锚点与破价催单',      '转化', '“专柜吊牌 799，平常大促也要 499，今天在我们直播间，前 50 单直接打到 299，还送运费险！”',                  210, 94),
  (4,  '公屏弹幕强互动与粉丝团留存',    '互动', '“想要黑色扣 1，想要卡其色扣 2！扣满 50 条我们马上找运营去后台申请补 20 单！”',                             145, 53),
  (5,  '整点超级福袋与憋单倒计时',      '转化', '“上方福袋还有最后 60 秒开奖，今天的大牌正装精华直接免单送，手速快的宝宝把‘主播最美’打在公屏上！”',         178, 81),
  (6,  '下半场逼单催付与临门一脚',      '转化', '“库存只剩最后 3 件，拍下不付款的 5 分钟后自动回库，手慢就真的没有了！”',                                    230, 105),
  (7,  '客诉退款拦截与售后安心服务',    '售后', '“咱们全场带运费险，到手试穿不满意随时退，一分钱不用大家掏，放心拍！”',                                      120, 48),
  (8,  '下场预告与次日大促蓄水',        '开场', '“明天晚上 8 点，我们秋冬大促正式爆发，提前加购的姐妹明天开播先发 50 元大额品类券！”',                       98,  35)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  content = EXCLUDED.content,
  use_count = EXCLUDED.use_count,
  likes = EXCLUDED.likes;

SELECT setval('script_library_id_seq', (SELECT COALESCE(MAX(id), 8) FROM script_library));

INSERT INTO issue_library (id, title, category, solution, occurrence_count, detailed_solution)
VALUES
  (1, '直播间突然掉流量与停留骤降', '流量', '立即更换引流款商品，主播提升语速与声调，配合 1 元福袋抽奖拉高互动率与停留时长。', 12, '1）排查是否撞同品类大主播开播；2）切换高完播率短视频追投千川；3）开播中控上架强吸引力爆品。'),
  (2, '主推款商品点击率高但下单转化低', '转化', '说明商品有兴趣但价格锚点不够或缺乏催单紧迫感，应立即释放限量专属优惠券并突出运费险。', 8, '1）主播立刻演示实物细节与穿戴效果；2）公屏引导已买老客好评；3）追加限时满减赠品。'),
  (3, '特定服饰类目售后退货率偏高', '售后', '尺码说明不够细致或灯光色差，需在中控详情页加注模特身高体重实测，并在直播中强调版型建议。', 15, '1）主播手把手教量肩宽胸围；2）调优直播间暖光减少色差；3）优化发货防损包装。'),
  (4, '公屏出现竞品比价与负面反馈', '内容', '场控中控迅速通过关键词屏蔽机制过滤不实言论，主播正面讲解我们品牌独有工艺与服务优势。', 6, '1）不回避客观对比，展示质检报告；2）强化售后无忧退换承诺；3）引导核心老粉正面分享。')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  solution = EXCLUDED.solution,
  occurrence_count = EXCLUDED.occurrence_count,
  detailed_solution = EXCLUDED.detailed_solution;

SELECT setval('issue_library_id_seq', (SELECT COALESCE(MAX(id), 4) FROM issue_library));

-- ════════════════════════════════════════════════════════════
-- 14. 主播能力与成长（anchor_capabilities / anchor_rankings）
--     【重要修复】：采用固定业务评估日期，杜绝 now() 导致重复执行唯一键冲突
-- ════════════════════════════════════════════════════════════
INSERT INTO anchor_capabilities (anchor_id, expression, interaction, conversion, professionalism, overall, evaluated_at)
SELECT a,
       s.e, s.i, s.c, s.p,
       round((s.e + s.i + s.c + s.p) / 4.0)::smallint,
       '2026-11-12'::date
FROM generate_series(1, 32) a
CROSS JOIN LATERAL (
  SELECT (65 + (a * 7) % 30)::smallint AS e,
         (60 + (a * 5) % 35)::smallint AS i,
         (62 + (a * 11) % 33)::smallint AS c,
         (68 + (a * 3) % 28)::smallint AS p
) s
ON CONFLICT (anchor_id, evaluated_at) DO UPDATE SET
  expression = EXCLUDED.expression,
  interaction = EXCLUDED.interaction,
  conversion = EXCLUDED.conversion,
  professionalism = EXCLUDED.professionalism,
  overall = EXCLUDED.overall;

SELECT setval('anchor_capabilities_id_seq', (SELECT COALESCE(MAX(id), 1) FROM anchor_capabilities));

-- ════════════════════════════════════════════════════════════
-- 15. 直播间健康度（room_health）与多直播间状态（multi_room_status）
-- ════════════════════════════════════════════════════════════
INSERT INTO room_health (id, room_id, health_score, interaction_score, conversion_score, content_score, traffic_score, status, evaluated_at)
SELECT r, r,
       s.score,
       GREATEST(40, s.score - (r * 3) % 10)::smallint,
       GREATEST(40, s.score + (r * 5) % 8)::smallint,
       GREATEST(40, s.score - (r * 2) % 6)::smallint,
       GREATEST(40, s.score + (r * 4) % 10)::smallint,
       CASE WHEN s.score >= 80 THEN 'healthy'
            WHEN s.score >= 65 THEN 'warning'
            ELSE 'critical' END,
       '2026-11-12'::date
FROM generate_series(1, 24) r
CROSS JOIN LATERAL (SELECT (68 + (r * 7) % 28)::int AS score) s
ON CONFLICT (id) DO UPDATE SET
  room_id = EXCLUDED.room_id,
  health_score = EXCLUDED.health_score,
  interaction_score = EXCLUDED.interaction_score,
  conversion_score = EXCLUDED.conversion_score,
  content_score = EXCLUDED.content_score,
  traffic_score = EXCLUDED.traffic_score,
  status = EXCLUDED.status,
  evaluated_at = EXCLUDED.evaluated_at;

SELECT setval('room_health_id_seq', (SELECT COALESCE(MAX(id), 24) FROM room_health));

INSERT INTO multi_room_status (id, room_id, online_users, realtime_gmv, total_views, status, conversion_rate, avg_order_value, snapshot_at)
SELECT r, r,
       350 + r * 45,
       round(3500 + r * 920.0, 2),
       (500 + r * 50) * 35,
       CASE WHEN r <= 10 THEN 'live' ELSE 'offline' END,
       (3.0 + (r % 5) * 0.4)::numeric(5,2),
       (135 + r * 6)::numeric(10,2),
       '2026-11-12 20:00:00+08'::timestamptz
FROM generate_series(1, 24) r
ON CONFLICT (id) DO UPDATE SET
  room_id = EXCLUDED.room_id,
  online_users = EXCLUDED.online_users,
  realtime_gmv = EXCLUDED.realtime_gmv,
  total_views = EXCLUDED.total_views,
  status = EXCLUDED.status,
  conversion_rate = EXCLUDED.conversion_rate,
  avg_order_value = EXCLUDED.avg_order_value,
  snapshot_at = EXCLUDED.snapshot_at;

SELECT setval('multi_room_status_id_seq', (SELECT COALESCE(MAX(id), 24) FROM multi_room_status));

-- ════════════════════════════════════════════════════════════
-- 16. 主播培训（anchor_training_plans / records）与话术模板
-- ════════════════════════════════════════════════════════════
INSERT INTO anchor_training_plans (id, name, anchor_count, start_date, end_date, progress, status)
VALUES
  (1, '2026大促冲刺：爆品连带话术实战营', 12, '2026-10-10', '2026-10-25', 100, 'completed'),
  (2, '全品类选品与货盘结构化表达特训',   16, '2026-11-01', '2026-11-15', 85,  'in_progress'),
  (3, '新人主播镜头感与应急公关训练营',   8,  '2026-11-10', '2026-11-30', 30,  'in_progress')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  anchor_count = EXCLUDED.anchor_count,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  progress = EXCLUDED.progress,
  status = EXCLUDED.status;

SELECT setval('anchor_training_plans_id_seq', (SELECT COALESCE(MAX(id), 3) FROM anchor_training_plans));

INSERT INTO anchor_script_templates (id, category, title, scenario, content, usage_count, last_used)
VALUES
  (1, '开场', '深秋换季三防冲锋衣黄金破冰', '日常服饰开播', '“各位老铁晚上好！秋风一起温度骤降，今天咱们直播间第一款直接给到保暖王炸！”', 45, '2026-11-10'),
  (2, '讲解', '玻尿酸面膜核心配方可视化拆解', '美妆精细讲解', '“大家仔细看这个精华挂壁的质地，5D玻尿酸由内而外层层锁水，敷完第二天直接素颜发光！”', 38, '2026-11-09'),
  (3, '转化', '生鲜冷萃咖啡买二赠一限时逼单', '食品专场逼单', '“倒数最后 10 秒，买两盒直接送一盒原装杯，折算下来一杯只要两块多，比便利店划算太多！”', 52, '2026-11-11'),
  (4, '互动', '数码降噪耳机现场测音互动',     '数码专场互动', '“戴上耳机的瞬间整个世界都安静了，想听音质的扣 666，中控老师把音乐放起来！”', 29, '2026-11-08')
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  scenario = EXCLUDED.scenario,
  content = EXCLUDED.content,
  usage_count = EXCLUDED.usage_count,
  last_used = EXCLUDED.last_used;

SELECT setval('anchor_script_templates_id_seq', (SELECT COALESCE(MAX(id), 4) FROM anchor_script_templates));

-- ════════════════════════════════════════════════════════════
-- 17. 竞品与目标跟踪（goal_tracking / competitor_*）
-- ════════════════════════════════════════════════════════════
INSERT INTO competitor_brands (id, brand, industry, monitored_products, avg_price, estimated_sales, trend)
VALUES
  (1, '竞品A-北欧探险家', '户外服饰', 16, '389 元', '2200 件/日', 'stable'),
  (2, '竞品B-轻润美研',   '美妆个护', 24, '159 元', '3500 件/日', 'up'),
  (3, '竞品C-山野原萃',   '食品生鲜', 18, '79 元',  '4800 件/日', 'up'),
  (4, '竞品D-极速数码',   '数码3C',   12, '499 元', '1100 件/日', 'down')
ON CONFLICT (id) DO UPDATE SET
  brand = EXCLUDED.brand,
  industry = EXCLUDED.industry,
  monitored_products = EXCLUDED.monitored_products,
  avg_price = EXCLUDED.avg_price,
  estimated_sales = EXCLUDED.estimated_sales,
  trend = EXCLUDED.trend;

SELECT setval('competitor_brands_id_seq', (SELECT COALESCE(MAX(id), 4) FROM competitor_brands));

INSERT INTO competitor_price_data (id, brand_id, label, ours, theirs, data_type)
VALUES
  (1, 1, '三防冲锋衣', 399.00, 429.00, 'price'),
  (2, 2, '玻尿酸面膜', 89.00,  99.00,  'price'),
  (3, 3, '冷萃冻干粉', 89.00,  99.00,  'price'),
  (4, 4, '主动降噪耳机', 399.00, 449.00, 'price')
ON CONFLICT (id) DO UPDATE SET
  brand_id = EXCLUDED.brand_id,
  label = EXCLUDED.label,
  ours = EXCLUDED.ours,
  theirs = EXCLUDED.theirs,
  data_type = EXCLUDED.data_type;

SELECT setval('competitor_price_data_id_seq', (SELECT COALESCE(MAX(id), 4) FROM competitor_price_data));

INSERT INTO goal_tracking (id, name, target, current_val, unit, progress, category, period)
VALUES
  (1, 'Q4 季度 GMV 营收总目标', 38000000, 34200000, '元', 90, '营收', 'quarterly'),
  (2, '全平台全品类订单量总目标', 280000,   265000,   '单', 94, '规模', 'quarterly'),
  (3, '全渠道粉丝增长净目标',     350000,   318000,   '人', 90, '增长', 'quarterly'),
  (4, '全渠道综合退款率控制上限', 12.00,    9.45,     '%',  78, '质量', 'quarterly')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  target = EXCLUDED.target,
  current_val = EXCLUDED.current_val,
  unit = EXCLUDED.unit,
  progress = EXCLUDED.progress,
  category = EXCLUDED.category,
  period = EXCLUDED.period;

SELECT setval('goal_tracking_id_seq', (SELECT COALESCE(MAX(id), 4) FROM goal_tracking));

-- ════════════════════════════════════════════════════════════
-- 18. 内容项目库（content_projects）
-- ════════════════════════════════════════════════════════════
INSERT INTO content_projects (id, name, description, platform_code, shop_id, status)
VALUES
  (1,  '全品类秋冬上新短视频矩阵', '围绕10类目爆品策划短视频引流', 'douyin',      1, 'active'),
  (2,  '小红书美妆种草爆文计划',   '深度成分测评与真实上脸试色',   'xiaohongshu', 7, 'active'),
  (3,  '快手老铁福利大促预热',     '源头工厂与性价比实测好物',     'kuaishou',    6, 'active'),
  (4,  '天猫双11爆发短视频回流',   '大牌立减心智与穿搭分享',       'tmall',       3, 'active')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  platform_code = EXCLUDED.platform_code,
  shop_id = EXCLUDED.shop_id,
  status = EXCLUDED.status;

SELECT setval('content_projects_id_seq', (SELECT COALESCE(MAX(id), 4) FROM content_projects));

COMMIT;
