-- 福利彩票预测和分析相关表（生产环境）
-- 执行日期: 2024-12-XX
-- 说明: 本脚本可安全重复执行，所有操作都包含存在性检查
-- 注意: Neon PostgreSQL 已内置支持 gen_random_uuid()，无需手动创建扩展

-- 创建预测结果表
CREATE TABLE IF NOT EXISTS public.lottery_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period TEXT,
    red_balls TEXT[] NOT NULL DEFAULT '{}',
    blue_ball TEXT NOT NULL,
    confidence FLOAT NOT NULL DEFAULT 0,
    strategy TEXT NOT NULL,
    reasoning TEXT,
    sources TEXT[] NOT NULL DEFAULT '{}',
    analysis_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建分析结果表
CREATE TABLE IF NOT EXISTS public.lottery_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    periods INT NOT NULL,
    config JSONB,
    result JSONB NOT NULL,
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建对比结果表
CREATE TABLE IF NOT EXISTS public.lottery_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id UUID NOT NULL,
    result_id UUID,
    period TEXT,
    red_balls_hit INT NOT NULL DEFAULT 0,
    blue_ball_hit BOOLEAN NOT NULL DEFAULT false,
    prize_level TEXT,
    prize_amount FLOAT DEFAULT 0,
    accuracy FLOAT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_lottery_predictions_period ON public.lottery_predictions(period);
CREATE INDEX IF NOT EXISTS idx_lottery_predictions_created_at ON public.lottery_predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lottery_predictions_analysis_id ON public.lottery_predictions(analysis_id);

CREATE INDEX IF NOT EXISTS idx_lottery_analysis_type ON public.lottery_analysis(type);
CREATE INDEX IF NOT EXISTS idx_lottery_analysis_created_at ON public.lottery_analysis(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lottery_comparisons_prediction_id ON public.lottery_comparisons(prediction_id);
CREATE INDEX IF NOT EXISTS idx_lottery_comparisons_result_id ON public.lottery_comparisons(result_id);
CREATE INDEX IF NOT EXISTS idx_lottery_comparisons_period ON public.lottery_comparisons(period);
CREATE INDEX IF NOT EXISTS idx_lottery_comparisons_prize_level ON public.lottery_comparisons(prize_level);
CREATE INDEX IF NOT EXISTS idx_lottery_comparisons_created_at ON public.lottery_comparisons(created_at DESC);

-- 添加外键约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_lottery_predictions_analysis'
    ) THEN
        ALTER TABLE public.lottery_predictions
        ADD CONSTRAINT fk_lottery_predictions_analysis
        FOREIGN KEY (analysis_id) REFERENCES public.lottery_analysis(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_lottery_comparisons_prediction'
    ) THEN
        ALTER TABLE public.lottery_comparisons
        ADD CONSTRAINT fk_lottery_comparisons_prediction
        FOREIGN KEY (prediction_id) REFERENCES public.lottery_predictions(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_lottery_comparisons_result'
    ) THEN
        ALTER TABLE public.lottery_comparisons
        ADD CONSTRAINT fk_lottery_comparisons_result
        FOREIGN KEY (result_id) REFERENCES public.lottery_results(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 添加注释
COMMENT ON TABLE public.lottery_predictions IS '福利彩票预测结果表';
COMMENT ON TABLE public.lottery_analysis IS '福利彩票分析结果表';
COMMENT ON TABLE public.lottery_comparisons IS '福利彩票预测对比表';

COMMENT ON COLUMN public.lottery_predictions.period IS '预测的期号';
COMMENT ON COLUMN public.lottery_predictions.red_balls IS '预测的红球号码数组';
COMMENT ON COLUMN public.lottery_predictions.blue_ball IS '预测的蓝球号码';
COMMENT ON COLUMN public.lottery_predictions.confidence IS '预测置信度（0-1）';
COMMENT ON COLUMN public.lottery_predictions.strategy IS '预测策略（保守型/平衡型/激进型）';
COMMENT ON COLUMN public.lottery_predictions.sources IS '数据来源（statistical/ai/ml）';

COMMENT ON COLUMN public.lottery_analysis.type IS '分析类型（frequency/omission/distribution/pattern/comprehensive）';
COMMENT ON COLUMN public.lottery_analysis.periods IS '使用的历史数据期数';
COMMENT ON COLUMN public.lottery_analysis.config IS '分析配置参数（JSON）';
COMMENT ON COLUMN public.lottery_analysis.result IS '分析结果（JSON）';

COMMENT ON COLUMN public.lottery_comparisons.red_balls_hit IS '红球命中数（0-6）';
COMMENT ON COLUMN public.lottery_comparisons.blue_ball_hit IS '蓝球是否命中';
COMMENT ON COLUMN public.lottery_comparisons.prize_level IS '中奖等级';
COMMENT ON COLUMN public.lottery_comparisons.accuracy IS '准确度（0-1）';

-- 创建自动更新 updated_at 的触发器函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 lottery_predictions 表创建触发器
DROP TRIGGER IF EXISTS trigger_update_lottery_predictions_updated_at ON public.lottery_predictions;
CREATE TRIGGER trigger_update_lottery_predictions_updated_at
    BEFORE UPDATE ON public.lottery_predictions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 为 lottery_analysis 表创建触发器
DROP TRIGGER IF EXISTS trigger_update_lottery_analysis_updated_at ON public.lottery_analysis;
CREATE TRIGGER trigger_update_lottery_analysis_updated_at
    BEFORE UPDATE ON public.lottery_analysis
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 为 lottery_comparisons 表创建触发器
DROP TRIGGER IF EXISTS trigger_update_lottery_comparisons_updated_at ON public.lottery_comparisons;
CREATE TRIGGER trigger_update_lottery_comparisons_updated_at
    BEFORE UPDATE ON public.lottery_comparisons
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 添加更多字段注释
COMMENT ON COLUMN public.lottery_predictions.analysis_id IS '关联的分析ID';
COMMENT ON COLUMN public.lottery_predictions.reasoning IS '预测理由说明';
COMMENT ON COLUMN public.lottery_comparisons.prediction_id IS '关联的预测ID';
COMMENT ON COLUMN public.lottery_comparisons.result_id IS '关联的开奖结果ID';
COMMENT ON COLUMN public.lottery_comparisons.prize_amount IS '奖金金额';

-- 执行完成提示
DO $$
BEGIN
    RAISE NOTICE '彩票预测表创建完成！';
    RAISE NOTICE '已创建表: lottery_predictions, lottery_analysis, lottery_comparisons';
    RAISE NOTICE '已创建索引和触发器';
    RAISE NOTICE '注意: 请确保 lottery_results 表已存在（通过 add_lottery_results_table_prod.sql 创建）';
END $$;

