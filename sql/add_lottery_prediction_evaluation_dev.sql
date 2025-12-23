-- 彩票预测评估表（开发环境）
-- 用于追踪预测结果的中奖情况，支持自我学习和优化

-- 创建表
CREATE TABLE IF NOT EXISTS lottery_prediction_evaluations (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  prediction_id UUID NOT NULL,
  actual_result_id UUID,
  
  -- 评估指标
  red_balls_hit INTEGER NOT NULL DEFAULT 0,  -- 红球命中数
  blue_ball_hit INTEGER NOT NULL DEFAULT 0,  -- 蓝球是否命中（0或1）
  prize_level VARCHAR(10),                   -- 中奖等级（0-6）
  accuracy DECIMAL(5, 4) DEFAULT 0,         -- 准确率（0-1）
  score DECIMAL(10, 4) DEFAULT 0,           -- 综合得分
  
  -- 策略信息
  strategy VARCHAR(50),                      -- 使用的策略（保守型/平衡型/激进型/智能型）
  method VARCHAR(50),                       -- 预测方法（statistical/ai/ml/comprehensive）
  
  -- 时间戳
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 外键约束
  CONSTRAINT fk_lottery_prediction_evaluations_prediction 
    FOREIGN KEY (prediction_id) 
    REFERENCES lottery_predictions(id) 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION,
    
  CONSTRAINT fk_lottery_prediction_evaluations_result 
    FOREIGN KEY (actual_result_id) 
    REFERENCES lottery_results(id) 
    ON UPDATE NO ACTION
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_lottery_prediction_evaluations_prediction_id 
  ON lottery_prediction_evaluations(prediction_id);

CREATE INDEX IF NOT EXISTS idx_lottery_prediction_evaluations_strategy 
  ON lottery_prediction_evaluations(strategy);

CREATE INDEX IF NOT EXISTS idx_lottery_prediction_evaluations_method 
  ON lottery_prediction_evaluations(method);

CREATE INDEX IF NOT EXISTS idx_lottery_prediction_evaluations_prize_level 
  ON lottery_prediction_evaluations(prize_level);

CREATE INDEX IF NOT EXISTS idx_lottery_prediction_evaluations_created_at 
  ON lottery_prediction_evaluations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lottery_prediction_evaluations_method_strategy 
  ON lottery_prediction_evaluations(method, strategy);

-- 添加注释
COMMENT ON TABLE lottery_prediction_evaluations IS '彩票预测评估表，用于追踪预测结果的中奖情况';
COMMENT ON COLUMN lottery_prediction_evaluations.red_balls_hit IS '红球命中数（0-6）';
COMMENT ON COLUMN lottery_prediction_evaluations.blue_ball_hit IS '蓝球是否命中（0=未命中，1=命中）';
COMMENT ON COLUMN lottery_prediction_evaluations.prize_level IS '中奖等级（0=未中奖，1-6=对应奖级）';
COMMENT ON COLUMN lottery_prediction_evaluations.accuracy IS '准确率（命中号码数/总号码数）';
COMMENT ON COLUMN lottery_prediction_evaluations.score IS '综合得分（用于排序和优化）';
COMMENT ON COLUMN lottery_prediction_evaluations.strategy IS '使用的策略（保守型/平衡型/激进型/智能型）';
COMMENT ON COLUMN lottery_prediction_evaluations.method IS '预测方法（statistical/ai/ml/comprehensive）';

