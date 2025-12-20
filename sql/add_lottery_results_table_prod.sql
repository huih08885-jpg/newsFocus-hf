-- 福利彩票开奖结果表（生产环境）
-- 执行日期: 2024-12-XX
-- 说明: 本脚本可安全重复执行，所有操作都包含存在性检查
-- 注意: Neon PostgreSQL 已内置支持 gen_random_uuid()，无需手动创建扩展

-- 创建开奖结果表
CREATE TABLE IF NOT EXISTS public.lottery_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period TEXT NOT NULL UNIQUE,
    date TIMESTAMPTZ NOT NULL,
    red_balls TEXT[] NOT NULL DEFAULT '{}',
    blue_ball TEXT NOT NULL,
    url TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_lottery_results_period ON public.lottery_results(period);
CREATE INDEX IF NOT EXISTS idx_lottery_results_date ON public.lottery_results(date DESC);

-- 添加注释
COMMENT ON TABLE public.lottery_results IS '福利彩票开奖结果表';
COMMENT ON COLUMN public.lottery_results.period IS '期号';
COMMENT ON COLUMN public.lottery_results.date IS '开奖日期';
COMMENT ON COLUMN public.lottery_results.red_balls IS '红球号码数组';
COMMENT ON COLUMN public.lottery_results.blue_ball IS '蓝球号码';
COMMENT ON COLUMN public.lottery_results.url IS '详情页URL';

-- 创建自动更新 updated_at 的触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 lottery_results 表创建触发器
DROP TRIGGER IF EXISTS trigger_update_lottery_results_updated_at ON public.lottery_results;
CREATE TRIGGER trigger_update_lottery_results_updated_at
    BEFORE UPDATE ON public.lottery_results
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 执行完成提示
DO $$
BEGIN
    RAISE NOTICE '彩票开奖结果表创建完成！';
    RAISE NOTICE '已创建表: lottery_results';
    RAISE NOTICE '已创建索引和触发器';
END $$;

