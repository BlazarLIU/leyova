/**
 * database/scripts/generate-demo-v2.mjs
 * 
 * 演示数据事实生成器：
 * - 90 天全品类、16 店铺、7 平台事实数据
 * - 确保 14 条验收标准（AC1~AC14）100% 达成
 * - 输出为 database/04b_demo_data_v2_facts.sql
 */

import fs from 'fs';
import path from 'path';

// 固定种子伪随机数生成器（LCG，保证完全可复现）
class DeterministicPRNG {
  constructor(seed = 4242) {
    this.m = 0x80000000;
    this.a = 1103515245;
    this.c = 12345;
    this.state = seed;
  }
  next() {
    this.state = (this.a * this.state + this.c) % this.m;
    return this.state / (this.m - 1);
  }
  range(min, max) {
    return min + this.next() * (max - min);
  }
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
  choice(arr) {
    return arr[this.int(0, arr.length - 1)];
  }
}

const prng = new DeterministicPRNG(4242);

// 日期范围：90 天，基准日 2026-11-12
const BASE_DATE_STR = '2026-11-12';
const DAYS = 90;

function get90Days() {
  const dates = [];
  const base = new Date('2026-11-12T00:00:00Z');
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86400000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

const dates = get90Days(); // 2026-08-15 to 2026-11-12

// 6 平台 × 3 店铺 = 18 店（S0 已下线 jd/pdd，S1 新增 wechat）
// 每平台固定 3 店：旗舰店 / 专营店 / 垂类店，便于按平台对比
const shops = [
  // 抖音（3 店）
  { id: 1,  platform: 'douyin',      name: '抖音主营旗舰店',     mode: 'standard', baseDailyGmv: 48000, rooms: [1, 2] },
  { id: 2,  platform: 'douyin',      name: '抖音美妆旗舰店',     mode: 'standard', baseDailyGmv: 32000, rooms: [3] },
  { id: 3,  platform: 'douyin',      name: '抖音食品专营店',     mode: 'standard', baseDailyGmv: 26000, rooms: [4] },
  // 快手（3 店）
  { id: 4,  platform: 'kuaishou',    name: '快手官方旗舰店',     mode: 'standard', baseDailyGmv: 34000, rooms: [5, 6] },
  { id: 5,  platform: 'kuaishou',    name: '快手食品专营店',     mode: 'standard', baseDailyGmv: 22000, rooms: [7] },
  { id: 6,  platform: 'kuaishou',    name: '快手服饰工厂店',     mode: 'standard', baseDailyGmv: 20000, rooms: [8] },
  // 视频号（3 店）
  { id: 7,  platform: 'wechat',      name: '视频号品牌自播旗舰店', mode: 'standard', baseDailyGmv: 30000, rooms: [9, 10] },
  { id: 8,  platform: 'wechat',      name: '视频号达人带货专营店', mode: 'standard', baseDailyGmv: 21000, rooms: [11] },
  { id: 9,  platform: 'wechat',      name: '视频号私域精选店',   mode: 'standard', baseDailyGmv: 18000, rooms: [12] },
  // 淘宝（3 店）
  { id: 10, platform: 'taobao',      name: '淘宝官方企业店',     mode: 'standard', baseDailyGmv: 30000, rooms: [13, 14] },
  { id: 11, platform: 'taobao',      name: '淘宝数码专营店',     mode: 'standard', baseDailyGmv: 25000, rooms: [15] },
  { id: 12, platform: 'taobao',      name: '淘宝家居旗舰店',     mode: 'standard', baseDailyGmv: 21000, rooms: [16] },
  // 天猫（3 店）
  { id: 13, platform: 'tmall',       name: '天猫品牌官方旗舰店', mode: 'standard', baseDailyGmv: 46000, rooms: [17, 18] },
  { id: 14, platform: 'tmall',       name: '天猫美妆旗舰店',     mode: 'standard', baseDailyGmv: 38000, rooms: [19] },
  { id: 15, platform: 'tmall',       name: '天猫母婴旗舰店',     mode: 'standard', baseDailyGmv: 28000, rooms: [20] },
  // 小红书（3 店）
  { id: 16, platform: 'xiaohongshu', name: '小红书品牌官方号',   mode: 'standard', baseDailyGmv: 24000, rooms: [21, 22] },
  { id: 17, platform: 'xiaohongshu', name: '小红书美妆种草号',   mode: 'standard', baseDailyGmv: 20000, rooms: [23] },
  { id: 18, platform: 'xiaohongshu', name: '小红书家居买手店',   mode: 'standard', baseDailyGmv: 17000, rooms: [24] }
];

// 归因窗口与投放工具字典映射（以 ad_tool_dict 为唯一真值源）
const platformAdConfig = {
  douyin:      { tool: 'qianchuan',       window: 168, cycle: 7 },
  taobao:      { tool: 'wanxiangtai',     window: 360, cycle: 10 },
  tmall:       { tool: 'wanxiangtai_tm',  window: 360, cycle: 7 },
  kuaishou:    { tool: 'cili_jinniu',     window: 168, cycle: 7 },
  wechat:      { tool: 'wechat_ad',       window: 168, cycle: 30 },
  xiaohongshu: { tool: 'juguang',         window: 168, cycle: 7 }
};

// 渠道定义：每个渠道带 (中文名, source_code, 占比权重)
// source_code 必须存在于 dim_traffic_source.code，保证渠道可归因
const platformChannels = {
  douyin: [
    { name: '直播推荐',   code: 'recommend_live',        w: 0.38 },
    { name: '短视频引流', code: 'content_short_video',   w: 0.30 },
    { name: '商城搜索',   code: 'natural_search',        w: 0.18 },
    { name: '付费千川',   code: 'paid_live',             w: 0.14 }
  ],
  kuaishou: [
    { name: '发现页',     code: 'recommend_live',        w: 0.32 },
    { name: '关注页',     code: 'private_follow',        w: 0.28 },
    { name: '粉丝团',     code: 'private_group',         w: 0.16 },
    { name: '短视频',     code: 'content_short_video',   w: 0.14 },
    { name: '付费金牛',   code: 'paid_live',             w: 0.10 }
  ],
  wechat: [
    { name: '视频号推荐', code: 'recommend_live',        w: 0.42 },
    { name: '朋友点赞',   code: 'external_social',       w: 0.24 },
    { name: '社群',       code: 'private_group',         w: 0.16 },
    { name: '朋友圈',     code: 'external_social',       w: 0.11 },
    { name: '公众号',     code: 'content',               w: 0.07 }
  ],
  taobao: [
    { name: '直播推荐',   code: 'recommend_live',        w: 0.36 },
    { name: '搜索',       code: 'natural_search',        w: 0.30 },
    { name: '店铺自运营', code: 'private_follow',        w: 0.20 },
    { name: '付费万相台', code: 'paid_feed',             w: 0.14 }
  ],
  tmall: [
    { name: '直播推荐',   code: 'recommend_live',        w: 0.34 },
    { name: '搜索',       code: 'natural_search',        w: 0.28 },
    { name: '官方立减会场', code: 'activity',            w: 0.22 },
    { name: '付费万相台', code: 'paid_feed',             w: 0.16 }
  ],
  xiaohongshu: [
    { name: '笔记引流',   code: 'content_community',     w: 0.34 },
    { name: '推荐',       code: 'recommend_home',        w: 0.28 },
    { name: '搜索',       code: 'natural_search',        w: 0.22 },
    { name: '付费聚光',   code: 'paid_feed',             w: 0.16 }
  ]
};

// 66 个 SKU 真实主档元数据（商品名同步自 dim_product.product_name）
// 格式: [id, skuCode, productName, category, retailPrice, unitCost, safetyStock]
const skuDefs = [
  [1, 'SKU-2026-001-BLK-M', '三防透气冲锋衣（曜石黑 / M）', '服饰鞋帽', 399.00, 138.00, 30],
  [2, 'SKU-2026-001-BLK-L', '三防透气冲锋衣（曜石黑 / L）', '服饰鞋帽', 399.00, 138.00, 35],
  [3, 'SKU-2026-001-KHK-L', '三防透气冲锋衣（山系卡其 / L）', '服饰鞋帽', 399.00, 138.00, 25],
  [4, 'SKU-2026-002-IVO-M', '100%美利奴羊毛打底衫（象牙白 / M）', '服饰鞋帽', 229.00, 88.00, 40],
  [5, 'SKU-2026-002-BLK-L', '100%美利奴羊毛打底衫（玄青黑 / L）', '服饰鞋帽', 229.00, 88.00, 35],
  [6, 'SKU-2026-003-GRY-F', '德绒自发热无缝阔腿裤（浅雾灰 / 均码）', '服饰鞋帽', 149.00, 48.00, 50],
  [7, 'SKU-2026-004-BLK-L', '90白鹅绒轻量抗寒羽绒服（深空黑 / L）', '服饰鞋帽', 799.00, 348.00, 20],
  [8, 'SKU-2026-004-WHT-M', '90白鹅绒轻量抗寒羽绒服（冰霜白 / M）', '服饰鞋帽', 799.00, 348.00, 15],
  [9, 'SKU-2026-005-WHT-41', '复古工装轻便低帮板鞋（经典白 / 41码）', '服饰鞋帽', 179.00, 68.00, 45],
  [10, 'SKU-2026-006-BLU-M', '重磅精梳棉复古休闲长袖衬衫（丹宁蓝 / M）', '服饰鞋帽', 189.00, 75.00, 30],
  [11, 'SKU-2026-011-BOX-10', '玻尿酸深层补水修护面膜（10片装）', '美妆个护', 89.00, 22.00, 60],
  [12, 'SKU-2026-011-BOX-20', '玻尿酸深层补水修护面膜（20片家庭装）', '美妆个护', 159.00, 38.00, 50],
  [13, 'SKU-2026-012-BOT-150', '温和氨基酸净透洁面乳（150ml）', '美妆个护', 69.00, 16.50, 70],
  [14, 'SKU-2026-013-SER-30', '二裂酵母抗老紧致赋活精华液（30ml）', '美妆个护', 269.00, 65.00, 30],
  [15, 'SKU-2026-014-CRM-50', '多肽抗皱滋养修护晚霜（50g）', '美妆个护', 239.00, 58.00, 25],
  [16, 'SKU-2026-015-SUN-50', '清透高倍防晒乳霜 SPF50+ PA++++（50ml）', '美妆个护', 99.00, 28.00, 80],
  [17, 'SKU-2026-016-LIP-RED', '丝绒哑光持色锁水唇釉（冷茶玫瑰红）', '美妆个护', 59.00, 14.00, 90],
  [18, 'SKU-2026-017-OIL-100', '摩洛哥坚果修护柔顺护发精油（100ml）', '美妆个护', 79.00, 21.00, 40],
  [19, 'SKU-2026-021-COF-40', '云南保山冷萃精品冻干咖啡粉（2g*40颗）', '食品生鲜', 89.00, 42.00, 50],
  [20, 'SKU-2026-022-BRD-10', '控卡全麦黑麦轻食代餐软欧包（85g*10袋）', '食品生鲜', 49.00, 24.00, 60],
  [21, 'SKU-2026-023-NUT-500', '原味无盐每日坚果礼盒装（25g*20包）', '食品生鲜', 99.00, 52.00, 40],
  [22, 'SKU-2026-024-BEE-500', '内蒙古原切安格斯谷饲原味牛肉干（500g）', '食品生鲜', 119.00, 68.00, 30],
  [23, 'SKU-2026-025-TEA-100', '武夷山核心产区金骏眉特级红茶（100g听装）', '食品生鲜', 149.00, 78.00, 25],
  [24, 'SKU-2026-026-OAT-1KG', '澳洲整粒生烤免煮即食纯燕麦片（1kg罐装）', '食品生鲜', 29.90, 16.00, 80],
  [25, 'SKU-2026-027-CRB-1KG', '深海大西洋鲜冻捕捞熟冻熟甜雪蟹腿（1kg）', '食品生鲜', 189.00, 115.00, 20],
  [26, 'SKU-2026-028-HON-500', '长白山椴树天然结晶原蜜（500g玻璃瓶）', '食品生鲜', 69.00, 32.00, 45],
  [27, 'SKU-2026-031-ANC-BLK', '双馈主动降噪头戴式无线蓝牙耳机（墨夜黑）', '数码3C', 399.00, 288.00, 25],
  [28, 'SKU-2026-031-ANC-SIL', '双馈主动降噪头戴式无线蓝牙耳机（晨曦银）', '数码3C', 399.00, 288.00, 25],
  [29, 'SKU-2026-032-WCH-BLK', 'AMOLED高清屏运动健康监测智能手表（耀岩黑）', '数码3C', 469.00, 345.00, 30],
  [30, 'SKU-2026-033-KBD-RGB', '三模无线客制化机械键盘（全键热插拔/茶轴）', '数码3C', 299.00, 218.00, 40],
  [31, 'SKU-2026-034-BNK-20K', '65W双向氮化镓超级快充移动电源（20000mAh）', '数码3C', 199.00, 145.00, 50],
  [32, 'SKU-2026-035-TAB-256', '11英寸2.8K超清护眼学习办公平板电脑（8G+256G）', '数码3C', 1999.00, 1580.00, 15],
  [33, 'SKU-2026-036-CAM-4K', '4K防抖云台户外运动全景相机套装', '数码3C', 2199.00, 1650.00, 12],
  [34, 'SKU-2026-037-HUB-10N', '十合一多功能铝合金拓展坞（双HDMI+PD100W）', '数码3C', 199.00, 148.00, 35],
  [35, 'SKU-2026-041-PLW-WHT', '天然泰国进口乳胶抑菌波浪曲线护颈枕', '家居日用', 169.00, 78.00, 40],
  [36, 'SKU-2026-042-SHT-QUE', '60支新疆长绒棉高密纯棉四件套（加大双人款）', '家居日用', 349.00, 165.00, 30],
  [37, 'SKU-2026-043-ROB-AUT', '全自动双旋擦地超薄静音拖扫一体扫地机', '家居日用', 899.00, 420.00, 15],
  [38, 'SKU-2026-044-CND-200', '植物大豆蜡法式沙龙香氛蜡烛礼盒装（200g）', '家居日用', 79.00, 36.00, 60],
  [39, 'SKU-2026-045-TWL-3PC', '抗菌吸水无捻纱加厚素色洗脸毛巾3条装', '家居日用', 39.90, 18.00, 80],
  [40, 'SKU-2026-046-ORG-5BX', '透明亚克力抽屉式桌面护肤品首饰收纳盒五件套', '家居日用', 69.00, 28.00, 50],
  [41, 'SKU-2026-051-DPR-L', '弱酸亲肤超薄透气婴儿纸尿裤（L码 84片）', '母婴用品', 119.00, 58.00, 60],
  [42, 'SKU-2026-051-DPR-XL', '弱酸亲肤超薄透气婴儿拉拉裤（XL码 76片）', '母婴用品', 119.00, 58.00, 50],
  [43, 'SKU-2026-052-WIP-80X5', '食品级纯水无香无酒精特厚婴儿湿巾（80抽*5包）', '母婴用品', 49.00, 22.00, 80],
  [44, 'SKU-2026-053-STR-F1', '轻量单手秒收高景观双向折叠婴儿手推车', '母婴用品', 599.00, 290.00, 18],
  [45, 'SKU-2026-054-BOT-240', 'PPSU仿母乳感宽口径耐高温防胀气奶瓶（240ml）', '母婴用品', 89.00, 42.00, 40],
  [46, 'SKU-2026-055-WSH-500', '植物基低泡无泪配方婴童二合一洗发沐浴露（500ml）', '母婴用品', 69.00, 31.00, 45],
  [47, 'SKU-2026-061-TNT-3P', '一秒全自动黑胶防晒野外露营速开帐篷（3-4人）', '运动户外', 499.00, 245.00, 20],
  [48, 'SKU-2026-062-TRD-SLM', '家用可折叠减震超静音走步机智能平板跑步机', '运动户外', 1299.00, 680.00, 10],
  [49, 'SKU-2026-063-MAT-8MM', '加宽加厚防滑高弹TPE环保双面专业瑜伽垫（8mm）', '运动户外', 99.00, 45.00, 60],
  [50, 'SKU-2026-064-BTL-1L', '户外双层真空316不锈钢运动保温保冷壶（1000ml）', '运动户外', 89.00, 42.00, 50],
  [51, 'SKU-2026-065-BAG-50L', '专业高承重轻量化户外登山徒步双肩包（50L）', '运动户外', 269.00, 135.00, 30],
  [52, 'SKU-2026-066-STK-2PC', '超轻三节外锁碳纤维徒步登山杖一对装（含泥托）', '运动户外', 189.00, 92.00, 35],
  [53, 'SKU-2026-071-CAT-2KG', '低温烘焙无谷高肉生骨肉全价冻干鲜肉猫粮（2kg）', '宠物用品', 169.00, 78.00, 45],
  [54, 'SKU-2026-072-LIT-6KG', '原味食品级结团吸臭无尘原生豆腐混合猫砂（6kg）', '宠物用品', 39.90, 18.00, 80],
  [55, 'SKU-2026-073-WTR-2L', '全静音循环过滤宠物智能感应自动饮水机（2.5L）', '宠物用品', 109.00, 52.00, 35],
  [56, 'SKU-2026-074-BED-OVAL', '加厚回弹记忆棉保暖深睡甜甜圈猫窝狗窝（中号）', '宠物用品', 79.00, 36.00, 50],
  [57, 'SKU-2026-075-FDG-BOX', '纯鲜肉多拼原切宠物补钙冻干零食全家桶（400g）', '宠物用品', 89.00, 38.00, 40],
  [58, 'SKU-2026-081-AIR-5L', '可视化大容量触控智能无油多功能空气炸锅（5.5L）', '小家电', 199.00, 115.00, 35],
  [59, 'SKU-2026-082-BLD-1L', '低音降噪免滤破壁机多功能家用加热豆浆料理机', '小家电', 279.00, 165.00, 25],
  [60, 'SKU-2026-083-FAN-WRL', '负离子除菌直流变频遥控摇头循环空气对流落地扇', '小家电', 229.00, 128.00, 30],
  [61, 'SKU-2026-084-KTL-GOO', '高精度温控恒温手冲咖啡长嘴细口电热水壶（0.8L）', '小家电', 249.00, 142.00, 30],
  [62, 'SKU-2026-085-IRN-MIN', '便携式折叠增压蒸汽手持挂烫机家用迷你电熨斗', '小家电', 119.00, 62.00, 45],
  [63, 'SKU-2026-091-VTC-100', '天然针叶樱桃高浓度维生素C咀嚼片（100片）', '医药健康', 59.00, 22.00, 60],
  [64, 'SKU-2026-092-BPM-VOX', '医用级一键精准全自动上臂式家用电子血压计', '医药健康', 199.00, 88.00, 30],
  [65, 'SKU-2026-093-GLC-50T', '免调码微量采血家用智能血糖仪测试仪试纸套装', '医药健康', 99.00, 45.00, 50],
  [66, 'SKU-2026-094-MSK-KN95', '医用五层防护KN95立体透气防尘无菌防护口罩（50只）', '医药健康', 49.00, 18.00, 100]
];
const skuList = skuDefs.map(([id, skuCode, productName, category, price, cost, safety]) => ({
  id, skuCode, productName, category, price, cost, safety
}));

console.log('Generating demo facts v2 SQL...');

const sqlChunks = [];
sqlChunks.push(`--
-- ============================================================================
-- Leyova 演示事实与流水数据集 V2
-- 文件：database/04b_demo_data_v2_facts.sql
-- 生成器：database/scripts/generate-demo-v2.mjs
-- 覆盖 7 平台、16 店铺、90 天（2026-08-15 ~ 2026-11-12）
-- 严格满足 14 条验收标准（AC1 ~ AC14）
-- ============================================================================

BEGIN;

SET LOCAL search_path = public;
SELECT setseed(0.4242);

-- 幂等关键：先重置所有 ID 序列为 1，保证重跑两次得到完全相同的 id
-- （否则 setval(MAX(id)) 会让下次重跑的 id 继续增长，md5 不一致）
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'S'
       AND c.relname IN (
         'fact_trade_daily_id_seq','fact_traffic_daily_id_seq','fact_ad_spend_daily_id_seq',
         'fact_content_daily_id_seq','content_attribution_ledger_id_seq','fact_search_keyword_daily_id_seq',
         'fact_settlement_cycles_id_seq','fact_inventory_ledger_id_seq','fact_inventory_stock_id_seq',
         'fact_kol_cooperation_id_seq','fact_cs_session_id_seq','fact_after_sale_tickets_id_seq',
         'fact_fulfillment_waybill_id_seq','platform_members_summary_id_seq','compliance_events_id_seq',
         'content_schedules_id_seq','live_sessions_id_seq','live_registrations_id_seq',
         'session_live_basic_info_id_seq','session_overview_metrics_id_seq',
         'session_short_video_traffic_id_seq','session_channel_metrics_id_seq',
         'session_anchor_metrics_id_seq','session_product_details_id_seq','session_product_skus_id_seq',
         'canonical_orders_id_seq','canonical_order_items_id_seq',
         'raw_records_id_seq','clean_records_id_seq','import_batches_id_seq'
       )
  LOOP
    EXECUTE format('ALTER SEQUENCE %I RESTART WITH 1', t);
  END LOOP;
END $$;
`);

function writeBatch(tableName, columns, rows, batchSize = 1000) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    sqlChunks.push(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n${chunk.join(',\n')}\nON CONFLICT DO NOTHING;\n`);
  }
}

// ── 1. 生成 fact_trade_daily 与 live_sessions 对账基准 ──
const shopDailyGrossPaid = new Map(); // key: `${shopId}_${date}`, value: total_gmv

console.log('Building fact_trade_daily...');
const tradeRows = [];

for (const date of dates) {
  const dayOfWeek = new Date(date).getUTCDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
  const weekendFactor = isWeekend ? 1.35 : 1.0;

  let promoFactor = 1.0;
  if (date >= '2026-10-25' && date <= '2026-11-11') {
    promoFactor = (date === '2026-11-11' || date === '2026-11-01') ? 2.4 : 1.8;
  } else if (date >= '2026-09-08' && date <= '2026-09-12') {
    promoFactor = 1.6;
  }

  for (const shop of shops) {
    const channels = platformChannels[shop.platform];
    const adCfg = platformAdConfig[shop.platform];

    const randomVar = 0.9 + prng.next() * 0.2;
    const targetShopDailyGmv = Math.round(shop.baseDailyGmv * weekendFactor * promoFactor * randomVar * 100) / 100;

    let shopSumGrossPaid = 0;

    for (const channel of channels) {
      const channelGmv = Math.round(targetShopDailyGmv * channel.w * 100) / 100;
      shopSumGrossPaid += channelGmv;

      const paidOrders = Math.max(1, Math.round(channelGmv / 180));
      const buyers = Math.max(1, Math.round(paidOrders * 0.92));
      const refundAmount = Math.round(channelGmv * 0.08 * 100) / 100;
      const refundOrders = Math.max(0, Math.round(paidOrders * 0.08));

      // 公共列: biz_date, platform_code, shop_id, channel_name, source_code, gmv, pay_amount,
      //         paid_order_count, paid_buyer_count, refund_amount, refund_count, amount_type,
      //         attribution_window_hours, is_demo, source
      // is_demo=true（本数据集是演示数据）+ source='demo'（来源诚实标注，不再是误导性的 'api'）
      const row = (gmv, amountType, ra, ro) =>
        `('${date}', '${shop.platform}', ${shop.id}, '${channel.name}', '${channel.code}', ${gmv}, ${gmv}, ${paidOrders}, ${buyers}, ${ra}, ${ro}, '${amountType}', ${adCfg.window}, true, 'demo')`;

      // 主口径：所有平台都有 gross_paid
      tradeRows.push(row(channelGmv, 'gross_paid', refundAmount, refundOrders));

      // 平台差异化附加口径（严格单调递减，AC: 多口径 0 违例）
      if (shop.platform === 'douyin') {
        tradeRows.push(row(Math.round(channelGmv * 0.90 * 100) / 100, 'gross_settled', refundAmount, refundOrders));
      } else if (shop.platform === 'kuaishou') {
        // 快手独有：间接成交 ≥ gross_paid（唯一允许放大的口径）
        tradeRows.push(row(Math.round(channelGmv * 1.15 * 100) / 100, 'indirect_included', 0, 0));
        tradeRows.push(row(Math.round(channelGmv * 0.85 * 100) / 100, 'net_settled', refundAmount, refundOrders));
      } else if (shop.platform === 'wechat') {
        // 视频号：单一实付口径 + 结算口径
        tradeRows.push(row(Math.round(channelGmv * 0.93 * 100) / 100, 'gross_settled', refundAmount, refundOrders));
      } else if (shop.platform === 'taobao') {
        tradeRows.push(row(Math.round(channelGmv * 0.92 * 100) / 100, 'gross_settled', refundAmount, refundOrders));
      } else if (shop.platform === 'tmall') {
        tradeRows.push(row(Math.round(channelGmv * 0.91 * 100) / 100, 'gross_settled', refundAmount, refundOrders));
        tradeRows.push(row(Math.round(channelGmv * 0.82 * 100) / 100, 'net_settled', refundAmount, refundOrders));
      } else if (shop.platform === 'xiaohongshu') {
        // 小红书：站内 ≤ 站外 ≤ gross_paid 的双口径结构
        tradeRows.push(row(Math.round(channelGmv * 0.85 * 100) / 100, 'onsite', refundAmount, refundOrders));
        tradeRows.push(row(Math.round(channelGmv * 0.65 * 100) / 100, 'offsite', 0, 0));
        tradeRows.push(row(Math.round(channelGmv * 0.80 * 100) / 100, 'net_settled', refundAmount, refundOrders));
      }
    }

    shopDailyGrossPaid.set(`${shop.id}_${date}`, shopSumGrossPaid);
  }
}

console.log(`fact_trade_daily total rows: ${tradeRows.length}`);
writeBatch('fact_trade_daily', [
  'biz_date', 'platform_code', 'shop_id', 'channel_name', 'source_code',
  'gmv', 'pay_amount', 'paid_order_count', 'paid_buyer_count',
  'refund_amount', 'refund_count', 'amount_type', 'attribution_window_hours',
  'is_demo', 'source'
], tradeRows);

// ── 2. 生成 fact_traffic_daily ──
console.log('Building fact_traffic_daily...');
const trafficRows = [];
for (const date of dates) {
  for (const shop of shops) {
    const channels = platformChannels[shop.platform];
    for (const ch of channels) {
      const visitors = prng.int(1200, 8500);
      const clicks = Math.round(visitors * prng.range(1.2, 2.5));
      const impressions = Math.round(clicks * prng.range(8, 25));
      let avgStay = prng.int(45, 95);
      if (shop.platform === 'douyin') avgStay = prng.int(75, 115);
      else if (shop.platform === 'wechat') avgStay = prng.int(85, 145);
      else if (shop.platform === 'xiaohongshu') avgStay = prng.int(60, 100);

      trafficRows.push(`('${date}', '${shop.platform}', ${shop.id}, '${ch.name}', '${ch.code}', ${impressions}, ${clicks}, ${visitors}, ${avgStay}, true)`);
    }
  }
}
console.log(`fact_traffic_daily rows: ${trafficRows.length}`);
writeBatch('fact_traffic_daily', [
  'biz_date', 'platform_code', 'shop_id', 'channel_name', 'source_code',
  'impressions', 'clicks', 'visitors', 'avg_stay_seconds', 'is_demo'
], trafficRows);

// ── 3. 生成 fact_ad_spend_daily (>= 1,500 rows) ──
console.log('Building fact_ad_spend_daily...');
const adSpendRows = [];
for (const date of dates) {
  for (const shop of shops) {
    const adCfg = platformAdConfig[shop.platform];
    const tools = [adCfg.tool];
    if (shop.platform === 'xiaohongshu') {
      tools.push('putongying');
    } else if (shop.platform === 'kuaishou') {
      tools.push('cili_juxing');
    }

    for (const toolCode of tools) {
      const adSpend = prng.range(1200, 6800);
      const impressions = Math.round(adSpend * prng.range(45, 110));
      const clicks = Math.round(impressions * prng.range(0.03, 0.08));
      const orders = Math.max(5, Math.round(clicks * prng.range(0.04, 0.12)));
      const roas = prng.range(2.2, 4.5);
      const grossGmv = Math.round(adSpend * roas * 100) / 100;
      const directGmv = Math.round(grossGmv * 0.72 * 100) / 100;
      const indirectGmv = Math.round(grossGmv * 0.22 * 100) / 100;
      const netGmv = Math.round(directGmv * 0.90 * 100) / 100;
      const settledGmv = Math.round(grossGmv * 0.88 * 100) / 100;
      const refundReserve = Math.round(grossGmv * 0.08 * 100) / 100;
      
      const settleDateObj = new Date(new Date(date).getTime() + adCfg.cycle * 86400000);
      const settleDate = settleDateObj.toISOString().slice(0, 10);

      adSpendRows.push(`(1, '${shop.platform}', ${shop.id}, '${date}', '${toolCode}', ${adCfg.window}, ${adSpend.toFixed(2)}, ${impressions}, ${clicks}, ${orders}, ${grossGmv.toFixed(2)}, ${settledGmv.toFixed(2)}, ${refundReserve.toFixed(2)}, ${adCfg.cycle}, '${settleDate}', ${directGmv.toFixed(2)}, ${indirectGmv.toFixed(2)}, ${netGmv.toFixed(2)}, true)`);
    }
  }
}
console.log(`fact_ad_spend_daily rows: ${adSpendRows.length}`);
writeBatch('fact_ad_spend_daily', [
  'tenant_id', 'platform_code', 'shop_id', 'biz_date', 'ad_tool_code',
  'attribution_window_hours', 'ad_spend', 'impressions', 'clicks',
  'attributed_orders', 'attributed_gross_gmv', 'attributed_settled_gmv',
  'refund_reserve_amount', 'settlement_cycle_days', 'estimated_settle_date',
  'direct_gmv', 'indirect_gmv', 'net_gmv', 'is_demo'
], adSpendRows);

// ── 4. 生成 fact_content_daily 与 content_attribution_ledger (>= 900 rows) ──
console.log('Building content facts...');
const contentDailyRows = [];
const contentLedgerRows = [];
let contentSeq = 1;

for (const date of dates) {
  for (const shop of shops) {
    if (prng.next() < 0.6) {
      const contentId = `CNT-${shop.platform.slice(0, 2).toUpperCase()}-${shop.id}-${contentSeq++}`;
      const contentType = shop.platform === 'xiaohongshu' ? 'note' : (shop.platform === 'douyin' ? 'short_video' : 'live_replay');
      const views = prng.int(2500, 48000);
      const likes = Math.round(views * prng.range(0.04, 0.12));
      const comments = Math.round(likes * prng.range(0.08, 0.25));
      const shares = Math.round(likes * prng.range(0.05, 0.18));
      const collects = Math.round(likes * prng.range(0.15, 0.45));
      const attrGmv = Math.round(views * prng.range(0.05, 0.25) * 100) / 100;

      contentDailyRows.push(`('${date}', '${shop.platform}', ${shop.id}, '${contentId}', '精选引流内容', '${contentType}', ${views}, ${likes}, ${comments}, ${shares}, ${collects}, ${attrGmv})`);

      const adCfg = platformAdConfig[shop.platform];
      let channel = 'in_site';
      if (shop.platform === 'douyin') channel = 'qianchuan';
      else if (shop.platform === 'xiaohongshu') {
        const xhsChs = ['hongmao', 'hongjing', 'honglian', 'juguang'];
        channel = prng.choice(xhsChs);
      }

      contentLedgerRows.push(`(1, '${contentId}', '${shop.platform}', ${shop.id}, '${date}', '${channel}', ${adCfg.window}, ${views}, ${likes + comments}, ${Math.round(comments * 0.4)}, ${Math.round(shares * 0.3)}, ${attrGmv}, ${(attrGmv * 0.9).toFixed(2)}, ${(attrGmv * 0.1).toFixed(2)})`);

      if (prng.next() < 0.45) {
        contentLedgerRows.push(`(1, '${contentId}', '${shop.platform}', ${shop.id}, '${date}', 'organic_search', ${adCfg.window}, ${Math.round(views * 0.3)}, ${Math.round((likes + comments) * 0.3)}, ${Math.round(comments * 0.2)}, ${Math.round(shares * 0.1)}, ${(attrGmv * 0.25).toFixed(2)}, ${(attrGmv * 0.22).toFixed(2)}, 0.00)`);
      }
    }
  }
}
console.log(`fact_content_daily rows: ${contentDailyRows.length}`);
console.log(`content_attribution_ledger rows: ${contentLedgerRows.length}`);

writeBatch('fact_content_daily', [
  'biz_date', 'platform_code', 'shop_id', 'content_id', 'title',
  'content_type', 'views', 'likes', 'comments', 'shares', 'collects', 'attributed_gmv'
], contentDailyRows);

writeBatch('content_attribution_ledger', [
  'tenant_id', 'content_id', 'platform_code', 'shop_id', 'biz_date',
  'attribution_channel', 'attribution_window_hours', 'views', 'engagements',
  'search_back_count', 'attributed_orders', 'attributed_gmv', 'settled_gmv', 'ad_spend'
], contentLedgerRows);

// ── 5. 生成 fact_search_keyword_daily (>= 3,500 rows) ──
console.log('Building fact_search_keyword_daily...');
const kwRows = [];
const kwDict = ['冲锋衣防风透气', '玻尿酸修护补水面膜', '云南精品冷萃咖啡', '头戴式主动降噪蓝牙耳机', '泰国天然纯乳胶枕', '一秒速开全自动帐篷', '无谷高肉全价猫粮', '触控空气炸锅家用大容量'];

for (const date of dates) {
  for (const shop of shops) {
    for (let k = 0; k < 3; k++) {
      const kw = kwDict[(shop.id + k) % kwDict.length];
      const prod = skuList[(shop.id * 3 + k) % skuList.length];
      const impressions = prng.int(500, 6800);
      const clicks = Math.round(impressions * prng.range(0.04, 0.12));
      const rank = prng.int(1, 25);
      const sharePct = prng.range(2.5, 18.0);
      const orders = Math.max(1, Math.round(clicks * prng.range(0.03, 0.09)));
      const searchGmv = Math.round(orders * prod.price * 100) / 100;
      const cvr = prng.range(2.5, 8.5);

      kwRows.push(`(1, '${shop.platform}', ${shop.id}, '${date}', '${kw}', ${prod.id}, '${prod.skuCode}', 'manual', ${impressions}, ${clicks}, ${rank}, ${sharePct.toFixed(2)}, ${orders}, ${searchGmv.toFixed(2)}, ${cvr.toFixed(2)})`);
    }
  }
}
console.log(`fact_search_keyword_daily rows: ${kwRows.length}`);
writeBatch('fact_search_keyword_daily', [
  'tenant_id', 'platform_code', 'shop_id', 'biz_date', 'keyword',
  'product_id', 'sku_code', 'source', 'impressions', 'clicks',
  'search_rank', 'search_share_pct', 'orders', 'search_gmv', 'cvr'
], kwRows);

// ── 6. 生成 fact_settlement_cycles (AC2: 京东自营 30~60d vs POP 1~2d) ──
console.log('Building fact_settlement_cycles...');
const cycleRows = [];
for (const date of dates) {
  for (const shop of shops) {
    let cycleDays = 7;
    let businessMode = shop.mode;
    
    // 6 平台差异化账期（无 jd/pdd）
    if (shop.platform === 'tmall') {
      cycleDays = 7;        // 天猫 T+7
    } else if (shop.platform === 'taobao') {
      cycleDays = 10;       // 淘宝 T+10
    } else if (shop.platform === 'douyin') {
      cycleDays = 7;        // 抖音 T+7
    } else if (shop.platform === 'kuaishou') {
      cycleDays = 7;        // 快手 T+7
    } else if (shop.platform === 'wechat') {
      cycleDays = 30;       // 视频号 T+30（微信小店结算较慢）
    } else if (shop.platform === 'xiaohongshu') {
      cycleDays = 15;       // 小红书 T+15
    }

    const orderDateObj = new Date(date);
    const settleDateObj = new Date(orderDateObj.getTime() + cycleDays * 86400000);
    const settleDate = settleDateObj.toISOString().slice(0, 10);

    const gross = prng.range(12000, 65000);
    const settled = Math.round(gross * 0.88 * 100) / 100;
    const refund = Math.round(gross * 0.08 * 100) / 100;
    const reserve = Math.round(gross * 0.02 * 100) / 100;
    const fee = Math.round(gross * 0.03 * 100) / 100;
    const ad = Math.round(gross * 0.12 * 100) / 100;
    const netProfit = Math.round((settled - fee - ad - reserve) * 100) / 100;

    const status = settleDate <= BASE_DATE_STR ? 'settled' : (prng.next() < 0.5 ? 'partial' : 'pending');

    cycleRows.push(`(1, '${shop.platform}', ${shop.id}, '${date}', '${settleDate}', ${cycleDays}, ${gross.toFixed(2)}, ${settled.toFixed(2)}, ${refund.toFixed(2)}, ${reserve.toFixed(2)}, ${fee.toFixed(2)}, ${ad.toFixed(2)}, ${netProfit.toFixed(2)}, '${status}', '${businessMode}')`);
  }
}
console.log(`fact_settlement_cycles rows: ${cycleRows.length}`);
writeBatch('fact_settlement_cycles', [
  'tenant_id', 'platform_code', 'shop_id', 'order_date', 'settle_date',
  'settlement_cycle_days', 'gross_gmv', 'settled_gmv', 'refund_deducted',
  'reserve_held', 'platform_fee', 'ad_spend', 'net_profit', 'settlement_status', 'business_mode'
], cycleRows);

// ── 7. 生成 live_sessions 与 session_* (>= 4,500 场，AC6/AC10) ──
console.log('Building live_sessions & session_* ...');
const sessionRows = [];
const sessionRegRows = [];
// 供 session_channel_metrics 复用：记录每个场次的关键维度
const sessionMetaList = [];
const sessionInfoRows = [];
const sessionMetricRows = [];
const sessionProdRows = [];
const sessionSkuRows = [];
const sessionShortVideoRows = [];

const roomDateBasicInserted = new Set();
let sessionId = 1;
let spdSeq = 1;
let spSkuSeq = 1;

for (const date of dates) {
  for (const shop of shops) {
    const shopGrossPaid = shopDailyGrossPaid.get(`${shop.id}_${date}`) || shop.baseDailyGmv;
    const roomList = shop.rooms;
    
    // 62 场/天 * 90 天 = 5,580 场（满足 >= 4,500）
    const sessionsToday = roomList.length === 1 ? 3 : (roomList.length === 2 ? 5 : 6);
    const baseGmvPerSession = Math.round((shopGrossPaid / sessionsToday) * 100) / 100;
    
    for (let sIdx = 0; sIdx < sessionsToday; sIdx++) {
      const curSessionId = sessionId++;
      const roomId = roomList[sIdx % roomList.length];
      const anchorId = ((curSessionId * 7) % 32) + 1;
      const operatorId = ((curSessionId * 3) % 24) + 1;
      const durationMin = prng.int(150, 240);
      
      // AC10: 最后一场调平，使场次 GMV 和完全等于 fact_trade_daily.gross_paid
      const gmvPerSession = (sIdx === sessionsToday - 1)
        ? Math.round((shopGrossPaid - baseGmvPerSession * (sessionsToday - 1)) * 100) / 100
        : baseGmvPerSession;

      const orders = Math.max(10, Math.round(gmvPerSession / 160));
      const refund = Math.round(gmvPerSession * 0.08 * 100) / 100;
      const views = prng.int(4500, 28000);
      const peak = prng.int(300, 1800);

      // 关键修复：platform_code 必填（原 4050/4078 为 NULL）
      sessionRows.push(`(${curSessionId}, ${roomId}, ${anchorId}, '日常直播 ${date}', '${date}', '18:00:00', '21:30:00', 'completed', ${gmvPerSession.toFixed(2)}, ${orders}, ${peak}, ${durationMin}, ${operatorId}, ${refund.toFixed(2)}, ${(gmvPerSession - refund).toFixed(2)}, '${shop.platform}', 'legacy')`);

      // 供渠道指标与后续表复用
      sessionMetaList.push({
        id: curSessionId, roomId, shopId: shop.id, platform: shop.platform,
        date, gmv: gmvPerSession, orders, views, peak, durationMin, anchorId, operatorId
      });

      // live_registrations
      // 关键修复：补 duration_min（原 3037/3037 全 NULL）
      sessionRegRows.push(`(${curSessionId}, ${roomId}, ${anchorId}, '${date}', '18:00:00', '21:30:00', ${durationMin}, 'completed', ${gmvPerSession.toFixed(2)}, ${orders}, ${Math.round(orders * 0.92)}, ${refund.toFixed(2)}, 'legacy')`);

      // session_live_basic_info & session_overview_metrics 有 (room_id, business_date) UNIQUE 约束
      const roomDateKey = `${roomId}_${date}`;
      if (!roomDateBasicInserted.has(roomDateKey)) {
        roomDateBasicInserted.add(roomDateKey);
        // GPM = 每千次观看成交额（GMV / views × 1000）
        // 修复：原实现写死 85.00，导致 2160 行 GPM 全同，按平台下钻时 6 个平台 GPM 完全一样
        const trueGpm = views > 0 ? Math.round((gmvPerSession / views) * 1000 * 100) / 100 : 0;
        sessionInfoRows.push(`(${roomId * 1000 + dates.indexOf(date)}, ${curSessionId}, ${roomId}, '${date}', 12000, '${date}', '18:00:00', '21:30:00', ${durationMin}, '${shop.platform}', ${gmvPerSession.toFixed(2)}, ${trueGpm.toFixed(2)}, ${orders})`);
        sessionMetricRows.push(`(${roomId * 1000 + dates.indexOf(date)}, ${curSessionId}, ${roomId}, '${date}', ${views}, 18.50, 450, ${peak}, 350, 8.50, 75, 120, 1.80, 5.50, 3.20, 4.50, 18.50, 165.00, ${refund.toFixed(2)}, 12, 11, ${views * 2}, ${views}, ${Math.round(views * 0.7)}, 350, ${orders})`);
      }

      if (prng.next() < 0.5) {
        sessionShortVideoRows.push(`(${curSessionId}, ${roomId}, '${date}', '引流短视频 ${curSessionId}', '${date} 15:00:00', ${views * 2}, ${Math.round(views * 0.25)}, 12.50)`);
      }

      // AC6: session_product_details.product_id 存 dim_product.sku_code，满足 100% 命中
      // 保持 (room_id, business_date, product_id) UNIQUE
      for (let pIdx = 0; pIdx < 3; pIdx++) {
        const prod = skuList[(shop.id * 4 + sIdx * 3 + pIdx) % skuList.length];
        const pShare = pIdx === 0 ? 0.5 : (pIdx === 1 ? 0.3 : 0.2);
        const pGmv = Math.round(gmvPerSession * pShare * 100) / 100;
        const pSold = Math.max(1, Math.round(pGmv / prod.price));
        const curSpdId = spdSeq++;

        // 关键修复：product_id 存 sku_code（供 join dim_product），product_name 存真实商品名
        const safeName = prod.productName.replace(/'/g, "''");
        sessionProdRows.push(`(${curSpdId}, ${curSessionId}, ${roomId}, '${date}', ${pIdx + 1}, '${prod.skuCode}', '${safeName}', ${pGmv.toFixed(2)}, ${pSold}, ${Math.round(pSold * 0.9)}, ${pSold})`);

        // session_product_skus (子表)
        sessionSkuRows.push(`(${spSkuSeq++}, ${curSpdId}, '标准款', ${pGmv.toFixed(2)}, ${pSold}, ${Math.round(pSold * 0.9)}, ${pSold})`);
      }
    }
  }
}

console.log(`live_sessions rows: ${sessionRows.length}`);
console.log(`session_product_details rows: ${sessionProdRows.length}`);
console.log(`session_product_skus rows: ${sessionSkuRows.length}`);

writeBatch('live_sessions', [
  'id', 'room_id', 'anchor_id', 'title', 'date', 'start_time', 'end_time',
  'status', 'gmv', 'orders', 'online_peak', 'duration_min', 'operator_id',
  'return_amount', 'gsv', 'platform_code', 'data_source'
], sessionRows);

sqlChunks.push(`SELECT setval('live_sessions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM live_sessions));\n`);

writeBatch('live_registrations', [
  'id', 'room_id', 'anchor_id', 'biz_date', 'start_time', 'end_time',
  'duration_min', 'status', 'gmv', 'orders', 'buyer_count', 'return_amount', 'entry_source'
], sessionRegRows);

sqlChunks.push(`SELECT setval('live_registrations_id_seq', (SELECT COALESCE(MAX(id), 1) FROM live_registrations));\n`);

writeBatch('session_live_basic_info', [
  'id', 'session_id', 'room_id', 'business_date', 'fans_before_broadcast',
  'live_date', 'live_start_time', 'live_end_time', 'live_duration_min', 'live_platform',
  'payment_amount', 'gpm', 'disposal_count'
], sessionInfoRows);

sqlChunks.push(`SELECT setval('session_live_basic_info_id_seq', (SELECT COALESCE(MAX(id), 1) FROM session_live_basic_info));\n`);

writeBatch('session_overview_metrics', [
  'id', 'session_id', 'room_id', 'business_date', 'viewers', 'exposure_view_rate',
  'avg_online', 'peak_online', 'product_click_users', 'product_exposure_click_rate',
  'avg_watch_seconds', 'new_followers', 'view_follow_rate', 'interaction_rate',
  'avg_comments_per_person', 'conversion_rate', 'product_click_deal_rate',
  'avg_order_value', 'refund_amount', 'refund_orders', 'refund_users',
  'exposure_users', 'enter_users', 'product_exposure_users', 'product_click_persons', 'deal_users'
], sessionMetricRows);

sqlChunks.push(`SELECT setval('session_overview_metrics_id_seq', (SELECT COALESCE(MAX(id), 1) FROM session_overview_metrics));\n`);

writeBatch('session_short_video_traffic', [
  'session_id', 'room_id', 'business_date', 'video_name', 'post_time',
  'live_entry_impressions', 'traffic_to_live', 'entry_click_rate'
], sessionShortVideoRows);

sqlChunks.push(`SELECT setval('session_short_video_traffic_id_seq', (SELECT COALESCE(MAX(id), 1) FROM session_short_video_traffic));\n`);

writeBatch('session_product_details', [
  'id', 'session_id', 'room_id', 'business_date', 'product_order',
  'product_id', 'product_name', 'payment_amount', 'sold_count', 'buyer_count', 'order_count'
], sessionProdRows);

sqlChunks.push(`SELECT setval('session_product_details_id_seq', (SELECT COALESCE(MAX(id), 1) FROM session_product_details));\n`);

writeBatch('session_product_skus', [
  'id', 'product_id', 'sku_name', 'payment_amount', 'sold_count', 'buyer_count', 'order_count'
], sessionSkuRows);

sqlChunks.push(`SELECT setval('session_product_skus_id_seq', (SELECT COALESCE(MAX(id), 1) FROM session_product_skus));\n`);

// ── session_channel_metrics：场次 × 渠道（6 平台全覆盖）──
// 关键修复：原版是 360 行硬编码常量且无 session_id → 100% 孤儿
// 现改为按每个场次 × 该平台渠道逐个生成，带 session_id / platform_code / source_code / shop_id
console.log('Building session_channel_metrics...');
const channelMetricRows = [];

// 需要复用 session 生成时记录的场次信息，因此在 session 循环中同步收集
for (const sess of sessionMetaList) {
  const channels = platformChannels[sess.platform];
  for (const ch of channels) {
    const chGmv = Math.round(sess.gmv * ch.w * 100) / 100;
    const chOrders = Math.max(1, Math.round(sess.orders * ch.w));
    const chBuyers = Math.max(1, Math.round(chOrders * 0.92));
    const views = Math.max(50, Math.round(sess.views * ch.w));
    const impressions = Math.round(views * prng.range(4, 9));
    const clicks = Math.max(10, Math.round(views * prng.range(0.08, 0.18)));
    const interactions = Math.round(views * prng.range(0.05, 0.15));

    // 平台差异化停留时长
    let avgWatch = prng.int(50, 100);
    if (sess.platform === 'douyin') avgWatch = prng.int(75, 120);
    else if (sess.platform === 'wechat') avgWatch = prng.int(85, 150);
    else if (sess.platform === 'kuaishou') avgWatch = prng.int(80, 130);
    else if (sess.platform === 'xiaohongshu') avgWatch = prng.int(60, 105);
    else if (sess.platform === 'tmall') avgWatch = prng.int(70, 120);

    const newFans = Math.round(views * 0.012);
    const gpm = views > 0 ? Math.round((chGmv / views) * 1000 * 100) / 100 : 0;
    const aov = chOrders > 0 ? Math.round((chGmv / chOrders) * 100) / 100 : 0;
    const adSpend = ch.code.startsWith('paid') ? Math.round(chGmv * 0.12 * 100) / 100 : 0;

    channelMetricRows.push(
      `(${sess.id}, '${ch.name}', '${sess.platform}', '${ch.code}', ${sess.shopId}, '${sess.date}', ` +
      `${avgWatch}, ${impressions}, ${views}, ${(100 * views / Math.max(impressions,1)).toFixed(2)}, ` +
      `${interactions}, ${(100 * interactions / Math.max(views,1)).toFixed(2)}, ${newFans}, ` +
      `${impressions}, ${clicks}, ${(100 * clicks / Math.max(views,1)).toFixed(2)}, ${(100 * chOrders / Math.max(clicks,1)).toFixed(2)}, ` +
      `${chOrders}, ${chBuyers}, ${chGmv.toFixed(2)}, ${chOrders}, ${gpm.toFixed(2)}, ${aov.toFixed(2)}, ${adSpend.toFixed(2)})`
    );
  }
}
console.log(`session_channel_metrics rows: ${channelMetricRows.length}`);

writeBatch('session_channel_metrics', [
  'session_id', 'channel', 'platform_code', 'source_code', 'shop_id', 'period_date',
  'avg_watch_sec', 'impressions', 'views', 'exposure_view_rate',
  'interactions', 'view_interaction_rate', 'new_fans',
  'product_impressions', 'product_clicks', 'product_click_rate', 'product_deal_rate',
  'orders', 'buyer_count', 'gmv', 'item_count', 'gpm', 'avg_order_value', 'ad_spend'
], channelMetricRows);

sqlChunks.push(`SELECT setval('session_channel_metrics_id_seq', (SELECT COALESCE(MAX(id), 1) FROM session_channel_metrics));\n`);

// ── session_anchor_metrics (32 主播 x 30 天 = 960 行) ──
const anchorMetricRows = [];
for (let d = 0; d < 30; d++) {
  const date = dates[dates.length - 1 - d];
  for (let a = 1; a <= 32; a++) {
    const gmv = prng.range(12000, 38000);
    anchorMetricRows.push(`('${date}', ${a}, ${((a % 24) + 1)}, 180, ${gmv.toFixed(2)}, ${(gmv / 3).toFixed(2)}, 800, 450, 165.00, 18.50, 12.00, 6.50, 120, 2.50, 30, 22.50, 180, '日常复盘')`);
  }
}
writeBatch('session_anchor_metrics', [
  'date', 'anchor_id', 'room_id', 'duration_min', 'gmv', 'gmv_per_hour',
  'online_peak', 'avg_online', 'avg_item_price', 'exposure_view_rate',
  'retention_rate', 'interaction_rate', 'new_fans', 'view_follow_rate',
  'new_group_members', 'uv_value', 'buyer_count', 'title'
], anchorMetricRows);

sqlChunks.push(`SELECT setval('session_anchor_metrics_id_seq', (SELECT COALESCE(MAX(id), 1) FROM session_anchor_metrics));\n`);

// ── 8. 生成 canonical_orders 与 items (AC7/AC8/AC9/AC11) ──
console.log('Building canonical orders & items...');
const orderDates = dates.slice(60); // 最近 30 天
const orderRows = [];
const itemRows = [];
const refundRows = [];

let orderSeq = 1;
let subOrderSeq = 1;

for (const date of orderDates) {
  for (const shop of shops) {
    for (let o = 1; o <= 60; o++) {
      const orderIdStr = `${shop.platform.slice(0, 2).toUpperCase()}-ORD-${date.replace(/-/g, '')}-${String(orderSeq).padStart(6, '0')}`;
      
      const prod1 = skuList[((orderSeq * 3) % 66)];
      const prod2 = skuList[((orderSeq * 3 + 1) % 66)];
      
      const qty1 = 1;
      const qty2 = (orderSeq % 5 === 0) ? 2 : 1;
      
      const amount1 = prod1.price * qty1;
      const amount2 = prod2.price * qty2;
      const totalPaid = Math.round((amount1 + amount2) * 100) / 100;

      const platformSku1 = `${shop.platform.slice(0, 2).toUpperCase()}-SKU-${prod1.id}`;
      const platformSku2 = `${shop.platform.slice(0, 2).toUpperCase()}-SKU-${prod2.id}`;

      orderRows.push(`('${date}', '${shop.platform}', ${shop.id}, '${orderIdStr}', 'completed', 'CNY', ${totalPaid.toFixed(2)}, 0.00, 0.00, 'BUYER-${orderSeq % 5000}', 'FINAL')`);

      const sub1 = `SUB-${subOrderSeq++}`;
      const sub2 = `SUB-${subOrderSeq++}`;

      itemRows.push(`('${date}', '${shop.platform}', ${shop.id}, '${orderIdStr}', '${sub1}', '${platformSku1}', ${prod1.id}, '${prod1.skuCode}', ${qty1}, ${amount1.toFixed(2)}, 0.00, 'FINAL')`);
      itemRows.push(`('${date}', '${shop.platform}', ${shop.id}, '${orderIdStr}', '${sub2}', '${platformSku2}', ${prod2.id}, '${prod2.skuCode}', ${qty2}, ${amount2.toFixed(2)}, 0.00, 'FINAL')`);

      if (orderSeq % 10 === 0) {
        refundRows.push(`('${date}', '${shop.platform}', ${shop.id}, 'REF-${orderSeq}', '${orderIdStr}', '${sub1}', 'only_refund', ${amount1.toFixed(2)}, 'completed', 'FINAL')`);
      }

      orderSeq++;
    }
  }
}

console.log(`canonical_orders rows: ${orderRows.length}`);
console.log(`canonical_order_items rows: ${itemRows.length}`);

writeBatch('canonical_orders', [
  'biz_date', 'source_platform', 'store_id', 'source_order_id', 'order_status',
  'currency_code', 'paid_amount', 'total_discount', 'freight_fee', 'buyer_user_id', 'maturity_status'
], orderRows);

writeBatch('canonical_order_items', [
  'biz_date', 'source_platform', 'store_id', 'source_order_id', 'source_sub_order_id',
  'platform_sku_id', 'internal_sku_id', 'product_name', 'quantity', 'item_paid_amount',
  'item_discount_allocated', 'maturity_status'
], itemRows);

writeBatch('canonical_refund_events', [
  'biz_date', 'source_platform', 'store_id', 'source_refund_id', 'source_order_id',
  'source_sub_order_id', 'refund_type', 'refund_amount', 'refund_status', 'maturity_status'
], refundRows);

// ── 9. 生成 fact_inventory_stock 与 fact_inventory_ledger (AC12) ──
console.log('Building inventory facts...');
const stockRows = [];
const ledgerRows = [];

for (const prod of skuList) {
  for (const wh of [{ code: 'MAIN_WH', name: '华东中心仓' }, { code: 'NORTH_WH', name: '华北中心仓' }]) {
    const isLow = (prod.id % 12 === 0);
    const onHand = isLow ? 8 : prng.int(60, 280);
    const locked = Math.round(onHand * 0.1);

    stockRows.push(`(${prod.id}, '${wh.code}', '${wh.name}', ${onHand}, ${locked}, 20)`);

    let curStock = onHand;
    for (let l = 0; l < 36; l++) {
      const delta = (l % 3 === 0) ? prng.int(20, 60) : -prng.int(5, 25);
      const before = curStock;
      const after = before + delta;
      curStock = Math.max(10, after);
      const changeType = delta > 0 ? 'inbound' : 'outbound';

      ledgerRows.push(`(${prod.id}, '${wh.code}', '${changeType}', ${delta}, ${before}, ${after}, 'sale', 'ORD-REF-${l}', '流水自动记录')`);
    }
  }
}

writeBatch('fact_inventory_stock', [
  'product_id', 'warehouse_code', 'warehouse_name', 'on_hand_qty', 'locked_qty', 'safety_stock'
], stockRows);

writeBatch('fact_inventory_ledger', [
  'product_id', 'warehouse_code', 'change_type', 'delta_qty', 'before_on_hand',
  'after_on_hand', 'ref_type', 'ref_id', 'remark'
], ledgerRows);

// ── 10. 售后工单与履约运单 ──
console.log('Building tickets & waybills...');
const ticketRows = [];
const waybillRows = [];
let ticketSeq = 1;
let waybillSeq = 1;

for (let dIdx = 0; dIdx < dates.length; dIdx += 2) {
  const date = dates[dIdx];
  for (const shop of shops) {
    const reasonCat = prng.choice(['size_mismatch', 'quality_defect', 'logistics_slow', 'not_as_described', 'buyer_remorse']);
    const refundType = prng.choice(['only_refund', 'return_refund', 'exchange']);
    const ticketNo = `TKT-${shop.platform.slice(0, 2).toUpperCase()}-${String(ticketSeq++).padStart(6, '0')}`;
    const prod = skuList[ticketSeq % skuList.length];

    ticketRows.push(`('${ticketNo}', '${shop.platform}', ${shop.id}, 'ORD-MOCK', 'REF-MOCK', ${prod.id}, '${refundType}', ${prod.price}, '${reasonCat}', 'pending_audit', 4.85, false, '${date} 10:00:00', '${date} 10:00:00')`);

    const orderNo = `WAY-${shop.platform.slice(0, 2).toUpperCase()}-${String(waybillSeq++).padStart(6, '0')}`;
    waybillRows.push(`('${shop.platform}', ${shop.id}, '${orderNo}', 'SF${waybillSeq}888', 'SF', ${prod.id}, ${prod.price}, '${date} 12:00:00', '${date} 12:00:00'::timestamptz + interval '48 hour', 'pending_ship', false, false, 0.00)`);
  }
}

writeBatch('fact_after_sale_tickets', [
  'ticket_no', 'platform_code', 'shop_id', 'source_order_id', 'source_refund_id',
  'product_id', 'refund_type', 'refund_amount', 'reason_category', 'ticket_status',
  'shop_experience_score', 'autonomy_protected', 'applied_at', 'created_at'
], ticketRows);

writeBatch('fact_fulfillment_waybill', [
  'platform_code', 'shop_id', 'order_no', 'waybill_no', 'carrier_code',
  'product_id', 'order_amount', 'paid_at', 'ship_deadline_at', 'fulfillment_status',
  'is_ship_delayed', 'is_fake_ship_risk', 'estimated_penalty_amount'
], waybillRows);

// ── 11. 客服会话、达人合作、会员总结、合规事件、成本 ──
const csRows = [];
for (const date of dates) {
  for (let agentId = 1; agentId <= 8; agentId++) {
    const shift = agentId % 2 === 0 ? 'night' : 'day';
    const shopId = ((agentId - 1) % 8) + 1;
    const shop = shops.find(s => s.id === shopId) || shops[0];
    const totalSess = prng.int(45, 120);
    const respSess = Math.round(totalSess * 0.98);
    const convertedGmv = prng.int(1800, 8500);

    csRows.push(`('${date}', ${agentId}, '${shop.platform}', ${shop.id}, '${shift}', ${totalSess}, ${respSess}, 1, 14.50, 40, 18, ${convertedGmv}, 98.50)`);
  }
}
writeBatch('fact_cs_session', [
  'session_date', 'agent_id', 'platform_code', 'shop_id', 'shift_type',
  'total_sessions', 'responded_sessions', 'timeout_sessions', 'avg_first_response_sec',
  'inquiry_buyers', 'converted_buyers', 'converted_gmv', 'satisfaction_rate'
], csRows);

const kolRows = [];
for (let k = 1; k <= 240; k++) {
  const kolId = ((k - 1) % 12) + 1;
  const shopId = ((k * 3) % 16) + 1;
  const shop = shops.find(s => s.id === shopId) || shops[0];
  const prod = skuList[k % skuList.length];
  const date = dates[k % dates.length];
  const coopType = prng.choice(['live_slot', 'short_video', 'xhs_note', 'cps_only']);
  const pitFee = coopType === 'live_slot' ? prng.int(5000, 20000) : 0;
  const commRate = 0.1500;
  const gmv = prng.int(15000, 85000);
  const refund = Math.round(gmv * 0.08 * 100) / 100;
  const commAmount = Math.round(gmv * commRate * 100) / 100;

  kolRows.push(`(${kolId}, '${shop.platform}', ${shop.id}, ${prod.id}, '${coopType}', '达人专项推广 ${k}', '${date}', ${pitFee}, ${commRate}, ${gmv}, ${refund}, ${commAmount}, 'confirmed')`);
}
writeBatch('fact_kol_cooperation', [
  'kol_id', 'platform_code', 'shop_id', 'product_id', 'coop_type', 'campaign_name',
  'publish_date', 'pit_fee', 'commission_rate', 'gmv', 'refund_amount',
  'commission_amount', 'settlement_status'
], kolRows);

const memberRows = [];
for (const date of dates) {
  for (const shop of shops) {
    for (const tier of ['all', 'vip', 'svip']) {
      const totalMem = tier === 'all' ? 45000 : (tier === 'vip' ? 8500 : 1200);
      const repRate = shop.platform === 'tmall' ? 32.50 : (shop.platform === 'wechat' ? 26.80 : 18.50);
      const fGmvShare = shop.platform === 'kuaishou' ? 42.00 : 25.00;

      memberRows.push(`(1, '${shop.platform}', ${shop.id}, '${date}', '${tier}', ${totalMem}, 45, 320, 150, ${repRate}, ${fGmvShare}, 6.50)`);
    }
  }
}
writeBatch('platform_members_summary', [
  'tenant_id', 'platform_code', 'shop_id', 'biz_date', 'member_tier',
  'total_members', 'new_members', 'active_buyers', 'repurchase_orders',
  'repurchase_rate', 'followers_gmv_share', 'private_domain_cvr'
], memberRows);

const complianceRows = [];
for (let c = 1; c <= 360; c++) {
  const shopId = ((c * 3) % 16) + 1;
  const shop = shops.find(s => s.id === shopId) || shops[0];
  const date = dates[c % dates.length];
  const sev = prng.choice(['info', 'warning', 'critical']);
  const status = prng.choice(['open', 'remediating', 'resolved']);

  complianceRows.push(`(1, '${shop.platform}', ${shop.id}, 'AD_LAW_S9', '违禁词提示', '${sev}', 0, false, false, true, '短视频文案含绝对化表述预警', '${status}', '${date} 14:00:00')`);
}
writeBatch('compliance_events', [
  'tenant_id', 'platform_code', 'shop_id', 'regulation_code', 'event_type',
  'severity', 'credit_points_deducted', 'traffic_restricted', 'auto_price_follow_risk',
  'entity_consistency_ok', 'summary', 'status', 'occurred_at'
], complianceRows);

// cost_entries 表已在 S4（财务板块清理）中删除，不再生成

const scheduleRows = [];
for (let s = 1; s <= 240; s++) {
  const shopId = (s % shops.length) + 1;
  const shop = shops.find(s => s.id === shopId) || shops[0];
  const date = dates[s % dates.length];
  const stage = prng.choice(['topic_planned', 'script_drafted', 'shooting', 'approved', 'published']);

  scheduleRows.push(`(1, '短视频排期专案 ${s}', '商品测评', '${stage}', '${shop.platform}', '短视频脚本文案概要', '${date} 16:00:00')`);
}
writeBatch('content_schedules', [
  'tenant_id', 'title', 'topic_category', 'stage', 'platform_code', 'script_summary', 'planned_publish_at'
], scheduleRows);

// agency_anchor_assignments 表已在 S3（代运营清理）中删除，不再生成

// ── 12. 批次与双轨接入 raw_records / clean_records ──
console.log('Building raw & clean records...');
const batchRows = [];
for (const shop of shops) {
  // 不用显式 id：交给序列，避免与运行时创建的批次撞键
  batchRows.push(`('BATCH-${shop.platform.slice(0, 2).toUpperCase()}-${shop.id}', '${shop.platform}', ${shop.id}, 'orders', 'api', 'completed', 'HASH-${shop.id}', 270, 270, 270, 270)`);
}
writeBatch('import_batches', [
  'batch_no', 'source_platform', 'store_id', 'dataset_type', 'source_channel', 'status',
  'file_hash', 'total_raw_rows', 'clean_candidate_rows', 'validated_rows', 'published_rows'
], batchRows);

const rawRows = [];
const cleanRows = [];
let rawSeq = 1;

for (let dIdx = 0; dIdx < 30; dIdx++) {
  const date = dates[dates.length - 1 - dIdx];
  for (const shop of shops) {
    for (let r = 1; r <= 9; r++) {
      const curRawId = rawSeq++;
      const orderId = `${shop.platform.slice(0, 2).toUpperCase()}-RAW-${date.replace(/-/g, '')}-${r}`;
      const amount = prng.range(89, 499);

      rawRows.push(`(${shop.id}, '${date}', 'Sheet1', ${r}, '{"order_id":"${orderId}","amount":${amount.toFixed(2)}}'::jsonb, 'HASH-${curRawId}', '${orderId}')`);
      cleanRows.push(`('${date}', ${shop.id}, ${curRawId}, '${shop.platform}', ${shop.id}, '${orderId}', '0', ${amount.toFixed(2)}, 'CNY', 'PUBLISHED', '{"order_id":"${orderId}"}'::jsonb)`);
    }
  }
}
console.log(`raw_records rows: ${rawRows.length}`);
console.log(`clean_records rows: ${cleanRows.length}`);

writeBatch('raw_records', [
  'batch_id', 'biz_date', 'sheet_name', 'row_no', 'raw_payload', 'payload_hash', 'source_business_key'
], rawRows);

writeBatch('clean_records', [
  'biz_date', 'batch_id', 'raw_record_id', 'source_platform', 'store_id',
  'source_order_id', 'source_sub_order_id', 'paid_amount', 'currency_code',
  'cleaning_status', 'canonical_payload'
], cleanRows);

// ── 13. 场次排期与抖音日报 ──
const sessionPlanRows = [];
const sessionPlanProdRows = [];
let planProdSeq = 1;

for (let r = 1; r <= 24; r++) {
  for (let p = 1; p <= 3; p++) {
    const planId = (r - 1) * 3 + p;
    sessionPlanRows.push(`(${planId}, ${r}, '2026-11-${12 + p}', ${(planId % 32) + 1}, '大促排期预案')`);
    for (let l = 0; l < 4; l++) {
      sessionPlanProdRows.push(`(${planProdSeq++}, ${planId}, '${['A','B','C','D'][l]}', 'SKU-2026-001', 199.00)`);
    }
  }
}
writeBatch('session_plans', ['id', 'room_id', 'plan_date', 'anchor_id', 'notes'], sessionPlanRows);
sqlChunks.push(`SELECT setval('session_plans_id_seq', (SELECT COALESCE(MAX(id), 1) FROM session_plans));\n`);

writeBatch('session_plan_products', ['id', 'plan_id', 'group_letter', 'product_code', 'price'], sessionPlanProdRows);
sqlChunks.push(`SELECT setval('session_plan_products_id_seq', (SELECT COALESCE(MAX(id), 1) FROM session_plan_products));\n`);

const dyChannelRows = [];
for (let d = 0; d < 30; d++) {
  const date = dates[dates.length - 1 - d];
  for (const c of ['自然流量', '付费流量', '短视频', '搜索']) {
    dyChannelRows.push(`('${date}', '${c}', 7200, 65, 25000, 9500, 1500, 65, 18000, 1650, 65, 55, 16800.00, 6, 2500.00, 1800.00)`);
  }
}
writeBatch('douyin_channel_daily_metrics', [
  'business_date', 'channel_name', 'live_duration_seconds', 'avg_watch_seconds',
  'impressions', 'viewers', 'interactions', 'new_followers', 'product_impressions',
  'product_clicks', 'order_count', 'buyer_count', 'payment_amount', 'item_count',
  'ad_cost_bound', 'ad_cost_promoted'
], dyChannelRows);
sqlChunks.push(`SELECT setval('douyin_channel_daily_metrics_id_seq', (SELECT COALESCE(MAX(id), 1) FROM douyin_channel_daily_metrics));\n`);

const dyAnchorRows = [];
for (let d = 0; d < 30; d++) {
  const date = dates[dates.length - 1 - d];
  for (let a = 1; a <= 10; a++) {
    const anchorName = ['沈知夏','林清和','苏沐春','陆星野','叶南音','顾清欢','唐不言','温以宁','程霜降','许知意'][a - 1];
    dyAnchorRows.push(`('${date}', '云梭官方账号', '${anchorName}', ${a}, 7200, 15500.00, 5160.00, 650, 320, 165.00, 0.185000, 0.120000, 0.055000, 45, 0.025000, 15)`);
  }
}
writeBatch('douyin_anchor_daily_metrics', [
  'business_date', 'account_name', 'anchor_name', 'anchor_id', 'live_duration_seconds',
  'payment_amount', 'hourly_payment', 'peak_online', 'avg_online', 'avg_item_price',
  'exposure_view_rate', 'retention_rate', 'interaction_rate', 'new_followers',
  'watch_follow_rate', 'group_joiners'
], dyAnchorRows);
sqlChunks.push(`SELECT setval('douyin_anchor_daily_metrics_id_seq', (SELECT COALESCE(MAX(id), 1) FROM douyin_anchor_daily_metrics));\n`);

sqlChunks.push(`COMMIT;\n`);

const outPath = path.resolve('database/04b_demo_data_v2_facts.sql');
fs.writeFileSync(outPath, sqlChunks.join('\n'), 'utf8');
console.log(`Successfully generated ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB)`);
