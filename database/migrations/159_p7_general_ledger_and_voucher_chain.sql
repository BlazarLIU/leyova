-- database/migrations/159_p7_general_ledger_and_voucher_chain.sql
-- Master Plan §5.2 #11: 总账/凭证层（复式记账流水与单场/月度净利凭证链追溯）
BEGIN;

-- 1. 会计科目主档表 dim_accounting_subject
CREATE TABLE IF NOT EXISTS public.dim_accounting_subject (
  account_code VARCHAR(32) PRIMARY KEY,
  account_name VARCHAR(64) NOT NULL,
  category VARCHAR(32) NOT NULL CHECK (category IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('debit', 'credit')),
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 初始化电商经营标准会计科目
INSERT INTO public.dim_accounting_subject (account_code, account_name, category, direction, description) VALUES
  ('1001', '货币资金-银行/账户可用余额', 'asset', 'debit', '企业银行或第三方支付/渠道账户可用结算资金'),
  ('1122', '应收账款-平台待结算款', 'asset', 'debit', '各电商平台已发货但处于 T+N 账期内的待结算款项'),
  ('1405', '库存商品-在库货值成本', 'asset', 'debit', '主仓及渠道配额在库实物商品的采购入库结存成本'),
  ('2202', '应付账款-供应商及外部达人款', 'liability', 'credit', '待支付给供货商采购应付款及达人带货服务费'),
  ('5001', '主营业务收入-直播及店铺商品销售', 'revenue', 'credit', '直播场次或店铺确认的商品含税销售 GMV 净收入'),
  ('5401', '主营业务成本-商品销售出库成本', 'expense', 'debit', '伴随销售订单出库结转的商品采购与加价成本 COGS'),
  ('5601', '销售费用-全域投流推广支出', 'expense', 'debit', '千川/磁力金牛/引力魔方/聚光等平台商业化广告实际消耗'),
  ('5602', '销售费用-平台扣点与技术服务费', 'expense', 'debit', '平台基础服务费提成、软件服务费及达人佣金扣款'),
  ('5603', '销售费用-仓储物流与履约包装费', 'expense', 'debit', '快递面单费、干线物流、入仓操作与退件揽收运费'),
  ('6051', '营业外支出-售后折让与退货货损', 'expense', 'debit', '客诉补偿、不可二次销售商品报废货损')
ON CONFLICT (account_code) DO UPDATE SET
  account_name = EXCLUDED.account_name,
  category = EXCLUDED.category,
  direction = EXCLUDED.direction,
  description = EXCLUDED.description;

-- 2. 总账会计凭证头表 fact_gl_voucher
CREATE TABLE IF NOT EXISTS public.fact_gl_voucher (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  voucher_no VARCHAR(64) NOT NULL UNIQUE,
  biz_date DATE NOT NULL,
  period VARCHAR(7) NOT NULL, -- YYYY-MM
  voucher_type VARCHAR(32) NOT NULL CHECK (voucher_type IN ('session_settle', 'ad_spend', 'order_revenue', 'inventory_cogs', 'refund_loss', 'logistics_fee', 'commission_fee', 'manual_adjust')),
  shop_id BIGINT REFERENCES public.dim_shop(id) ON DELETE SET NULL,
  platform_code VARCHAR(32) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL,
  session_id INT REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  ref_type VARCHAR(32) NOT NULL DEFAULT '',
  ref_id VARCHAR(64) NOT NULL DEFAULT '',
  total_debit NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_balanced BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(20) NOT NULL DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'voided')),
  created_by VARCHAR(64) NOT NULL DEFAULT 'system',
  posted_at TIMESTAMPTZ DEFAULT now(),
  summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_voucher_balanced CHECK (status != 'posted' OR (total_debit = total_credit AND total_debit > 0))
);

CREATE INDEX IF NOT EXISTS idx_gl_voucher_date_period ON public.fact_gl_voucher(biz_date, period);
CREATE INDEX IF NOT EXISTS idx_gl_voucher_session ON public.fact_gl_voucher(session_id);
CREATE INDEX IF NOT EXISTS idx_gl_voucher_shop_plat ON public.fact_gl_voucher(shop_id, platform_code);
CREATE INDEX IF NOT EXISTS idx_gl_voucher_ref ON public.fact_gl_voucher(ref_type, ref_id);

-- 3. 复式记账分录明细表 fact_gl_entry
CREATE TABLE IF NOT EXISTS public.fact_gl_entry (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  voucher_id BIGINT NOT NULL REFERENCES public.fact_gl_voucher(id) ON DELETE CASCADE,
  voucher_no VARCHAR(64) NOT NULL,
  line_no INT NOT NULL,
  account_code VARCHAR(32) NOT NULL REFERENCES public.dim_accounting_subject(account_code),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('debit', 'credit')),
  debit_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
  credit_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  shop_id BIGINT REFERENCES public.dim_shop(id) ON DELETE SET NULL,
  platform_code VARCHAR(32) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL,
  session_id INT REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  remark TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_entry_amount CHECK (
    (direction = 'debit' AND debit_amount > 0 AND credit_amount = 0) OR
    (direction = 'credit' AND credit_amount > 0 AND debit_amount = 0)
  ),
  CONSTRAINT uq_voucher_line UNIQUE (voucher_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_gl_entry_voucher ON public.fact_gl_entry(voucher_id, line_no);
CREATE INDEX IF NOT EXISTS idx_gl_entry_account ON public.fact_gl_entry(account_code);
CREATE INDEX IF NOT EXISTS idx_gl_entry_session ON public.fact_gl_entry(session_id);
CREATE INDEX IF NOT EXISTS idx_gl_entry_shop_date ON public.fact_gl_entry(shop_id, created_at);

-- 4. RLS 强制隔离策略
ALTER TABLE public.dim_accounting_subject ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_accounting_subject FORCE ROW LEVEL SECURITY;

ALTER TABLE public.fact_gl_voucher ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_gl_voucher FORCE ROW LEVEL SECURITY;

ALTER TABLE public.fact_gl_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_gl_entry FORCE ROW LEVEL SECURITY;

-- 允许所有认证用户读取科目字典
DROP POLICY IF EXISTS p_dim_accounting_subject_select ON public.dim_accounting_subject;
CREATE POLICY p_dim_accounting_subject_select ON public.dim_accounting_subject
  FOR SELECT TO leyova_app
  USING (rls_user_id() IS NOT NULL);

-- 科目字典维护权限
DROP POLICY IF EXISTS p_dim_accounting_subject_write ON public.dim_accounting_subject;
CREATE POLICY p_dim_accounting_subject_write ON public.dim_accounting_subject
  FOR ALL TO leyova_app
  USING (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin', 'admin']))
  WITH CHECK (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin', 'admin']));

-- fact_gl_voucher 租户/平台/店铺级数据隔离策略
DROP POLICY IF EXISTS p_gl_voucher_select ON public.fact_gl_voucher;
CREATE POLICY p_gl_voucher_select ON public.fact_gl_voucher
  FOR SELECT TO leyova_app
  USING (
    rls_user_id() IS NOT NULL AND
    (platform_code IS NULL OR rls_has_platform(platform_code)) AND
    (shop_id IS NULL OR rls_can_access_shop(shop_id))
  );

DROP POLICY IF EXISTS p_gl_voucher_write ON public.fact_gl_voucher;
CREATE POLICY p_gl_voucher_write ON public.fact_gl_voucher
  FOR ALL TO leyova_app
  USING (
    rls_is_agency_staff() AND
    rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ad_buyer', 'operator']) AND
    (platform_code IS NULL OR rls_has_platform(platform_code)) AND
    (shop_id IS NULL OR rls_can_access_shop(shop_id))
  )
  WITH CHECK (
    rls_is_agency_staff() AND
    rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ad_buyer', 'operator']) AND
    (platform_code IS NULL OR rls_has_platform(platform_code)) AND
    (shop_id IS NULL OR rls_can_access_shop(shop_id))
  );

-- fact_gl_entry 租户/平台/店铺级数据隔离策略
DROP POLICY IF EXISTS p_gl_entry_select ON public.fact_gl_entry;
CREATE POLICY p_gl_entry_select ON public.fact_gl_entry
  FOR SELECT TO leyova_app
  USING (
    rls_user_id() IS NOT NULL AND
    (platform_code IS NULL OR rls_has_platform(platform_code)) AND
    (shop_id IS NULL OR rls_can_access_shop(shop_id))
  );

DROP POLICY IF EXISTS p_gl_entry_write ON public.fact_gl_entry;
CREATE POLICY p_gl_entry_write ON public.fact_gl_entry
  FOR ALL TO leyova_app
  USING (
    rls_is_agency_staff() AND
    rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ad_buyer', 'operator']) AND
    (platform_code IS NULL OR rls_has_platform(platform_code)) AND
    (shop_id IS NULL OR rls_can_access_shop(shop_id))
  )
  WITH CHECK (
    rls_is_agency_staff() AND
    rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ad_buyer', 'operator']) AND
    (platform_code IS NULL OR rls_has_platform(platform_code)) AND
    (shop_id IS NULL OR rls_can_access_shop(shop_id))
  );

-- 5. 初始化关联真实场次的样本复式记账凭证 (直播场次 101 的全套凭证链)
DO $$
DECLARE
  v_session_id INT;
  v_shop_id BIGINT;
  v_plat VARCHAR(32);
  v_vouch_id BIGINT;
BEGIN
  SELECT id, platform_code INTO v_session_id, v_plat FROM public.live_sessions ORDER BY id LIMIT 1;
  SELECT id INTO v_shop_id FROM public.dim_shop WHERE platform_code = v_plat LIMIT 1;
  IF v_shop_id IS NULL THEN
    SELECT id INTO v_shop_id FROM public.dim_shop LIMIT 1;
  END IF;

  IF v_session_id IS NOT NULL AND v_shop_id IS NOT NULL THEN
    -- 凭证 1: 场次销售收入确认 (借: 应收账款 12800 / 贷: 主营业务收入 12800)
    INSERT INTO public.fact_gl_voucher (
      voucher_no, biz_date, period, voucher_type, shop_id, platform_code, session_id,
      ref_type, ref_id, total_debit, total_credit, is_balanced, status, summary
    ) VALUES (
      'VOU-202611-S01-REV', CURRENT_DATE - 1, to_char(CURRENT_DATE - 1, 'YYYY-MM'), 'session_settle',
      v_shop_id, v_plat, v_session_id, 'live_session', v_session_id::text,
      12800.00, 12800.00, true, 'posted', '直播场次 #' || v_session_id || ' 商品销售收入全额结转'
    ) ON CONFLICT (voucher_no) DO NOTHING
    RETURNING id INTO v_vouch_id;

    IF v_vouch_id IS NOT NULL THEN
      INSERT INTO public.fact_gl_entry (voucher_id, voucher_no, line_no, account_code, direction, debit_amount, credit_amount, shop_id, platform_code, session_id, remark)
      VALUES
        (v_vouch_id, 'VOU-202611-S01-REV', 1, '1122', 'debit', 12800.00, 0.00, v_shop_id, v_plat, v_session_id, '计提平台待结算销售款'),
        (v_vouch_id, 'VOU-202611-S01-REV', 2, '5001', 'credit', 0.00, 12800.00, v_shop_id, v_plat, v_session_id, '确认主营业务收入');
    END IF;

    -- 凭证 2: 场次销货成本 COGS 结转 (借: 主营业务成本 5200 / 贷: 库存商品 5200)
    INSERT INTO public.fact_gl_voucher (
      voucher_no, biz_date, period, voucher_type, shop_id, platform_code, session_id,
      ref_type, ref_id, total_debit, total_credit, is_balanced, status, summary
    ) VALUES (
      'VOU-202611-S01-COG', CURRENT_DATE - 1, to_char(CURRENT_DATE - 1, 'YYYY-MM'), 'inventory_cogs',
      v_shop_id, v_plat, v_session_id, 'live_session', v_session_id::text,
      5200.00, 5200.00, true, 'posted', '直播场次 #' || v_session_id || ' 出库商品采购成本结转'
    ) ON CONFLICT (voucher_no) DO NOTHING
    RETURNING id INTO v_vouch_id;

    IF v_vouch_id IS NOT NULL THEN
      INSERT INTO public.fact_gl_entry (voucher_id, voucher_no, line_no, account_code, direction, debit_amount, credit_amount, shop_id, platform_code, session_id, remark)
      VALUES
        (v_vouch_id, 'VOU-202611-S01-COG', 1, '5401', 'debit', 5200.00, 0.00, v_shop_id, v_plat, v_session_id, '结转商品销售成本 COGS'),
        (v_vouch_id, 'VOU-202611-S01-COG', 2, '1405', 'credit', 0.00, 5200.00, v_shop_id, v_plat, v_session_id, '扣减实物库存货值');
    END IF;

    -- 凭证 3: 场次千川投流消耗扣款 (借: 销售费用-投流 1850 / 贷: 货币资金 1850)
    INSERT INTO public.fact_gl_voucher (
      voucher_no, biz_date, period, voucher_type, shop_id, platform_code, session_id,
      ref_type, ref_id, total_debit, total_credit, is_balanced, status, summary
    ) VALUES (
      'VOU-202611-S01-ADV', CURRENT_DATE - 1, to_char(CURRENT_DATE - 1, 'YYYY-MM'), 'ad_spend',
      v_shop_id, v_plat, v_session_id, 'live_session', v_session_id::text,
      1850.00, 1850.00, true, 'posted', '直播场次 #' || v_session_id || ' 商业化投流推广消耗支出'
    ) ON CONFLICT (voucher_no) DO NOTHING
    RETURNING id INTO v_vouch_id;

    IF v_vouch_id IS NOT NULL THEN
      INSERT INTO public.fact_gl_entry (voucher_id, voucher_no, line_no, account_code, direction, debit_amount, credit_amount, shop_id, platform_code, session_id, remark)
      VALUES
        (v_vouch_id, 'VOU-202611-S01-ADV', 1, '5601', 'debit', 1850.00, 0.00, v_shop_id, v_plat, v_session_id, '直播投流推广费用支出'),
        (v_vouch_id, 'VOU-202611-S01-ADV', 2, '1001', 'credit', 0.00, 1850.00, v_shop_id, v_plat, v_session_id, '账户推广资金划扣');
    END IF;

    -- 凭证 4: 平台技术服务费与佣金 (借: 销售费用-扣点 640 / 贷: 应收账款 640)
    INSERT INTO public.fact_gl_voucher (
      voucher_no, biz_date, period, voucher_type, shop_id, platform_code, session_id,
      ref_type, ref_id, total_debit, total_credit, is_balanced, status, summary
    ) VALUES (
      'VOU-202611-S01-COM', CURRENT_DATE - 1, to_char(CURRENT_DATE - 1, 'YYYY-MM'), 'commission_fee',
      v_shop_id, v_plat, v_session_id, 'live_session', v_session_id::text,
      640.00, 640.00, true, 'posted', '直播场次 #' || v_session_id || ' 平台佣金与技术服务费扣减'
    ) ON CONFLICT (voucher_no) DO NOTHING
    RETURNING id INTO v_vouch_id;

    IF v_vouch_id IS NOT NULL THEN
      INSERT INTO public.fact_gl_entry (voucher_id, voucher_no, line_no, account_code, direction, debit_amount, credit_amount, shop_id, platform_code, session_id, remark)
      VALUES
        (v_vouch_id, 'VOU-202611-S01-COM', 1, '5602', 'debit', 640.00, 0.00, v_shop_id, v_plat, v_session_id, '平台服务费与佣金支出'),
        (v_vouch_id, 'VOU-202611-S01-COM', 2, '1122', 'credit', 0.00, 640.00, v_shop_id, v_plat, v_session_id, '直接从结算款中扣减');
    END IF;
  END IF;
END $$;

COMMIT;
