-- 活动管理表
CREATE TABLE IF NOT EXISTS promotions (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL DEFAULT '',
    type            VARCHAR(100) NOT NULL DEFAULT '',
    content         TEXT NOT NULL DEFAULT '',
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    applicable_rooms  JSONB NOT NULL DEFAULT '[]',
    applicable_anchors JSONB NOT NULL DEFAULT '[]',
    status          VARCHAR(20) NOT NULL DEFAULT 'preparing',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE promotions IS '活动管理';
COMMENT ON COLUMN promotions.name IS '活动名称';
COMMENT ON COLUMN promotions.type IS '活动类型';
COMMENT ON COLUMN promotions.content IS '活动内容';
COMMENT ON COLUMN promotions.start_date IS '开始日期';
COMMENT ON COLUMN promotions.end_date IS '结束日期';
COMMENT ON COLUMN promotions.applicable_rooms IS '适用直播间ID列表';
COMMENT ON COLUMN promotions.applicable_anchors IS '适用主播ID列表';
COMMENT ON COLUMN promotions.status IS '状态: preparing/active/ended';