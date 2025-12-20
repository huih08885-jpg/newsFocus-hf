-- 为彩票预测和分析表添加用户ID字段（开发环境）
-- 执行前请确保已创建lottery_predictions和lottery_analysis表

-- 1. 为lottery_predictions表添加user_id字段
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lottery_predictions' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.lottery_predictions 
    ADD COLUMN user_id TEXT;
    
    -- 为现有数据设置默认用户（如果有的话，需要根据实际情况调整）
    -- UPDATE public.lottery_predictions SET user_id = 'default_user_id' WHERE user_id IS NULL;
    
    -- 添加非空约束（在数据迁移后）
    -- ALTER TABLE public.lottery_predictions ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- 2. 为lottery_analysis表添加user_id字段
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lottery_analysis' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.lottery_analysis 
    ADD COLUMN user_id TEXT;
    
    -- 为现有数据设置默认用户（如果有的话，需要根据实际情况调整）
    -- UPDATE public.lottery_analysis SET user_id = 'default_user_id' WHERE user_id IS NULL;
    
    -- 添加非空约束（在数据迁移后）
    -- ALTER TABLE public.lottery_analysis ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- 3. 添加外键约束
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'lottery_predictions_user_id_fkey'
  ) THEN
    ALTER TABLE public.lottery_predictions
    ADD CONSTRAINT lottery_predictions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'lottery_analysis_user_id_fkey'
  ) THEN
    ALTER TABLE public.lottery_analysis
    ADD CONSTRAINT lottery_analysis_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. 添加索引
CREATE INDEX IF NOT EXISTS idx_lottery_predictions_user_id 
ON public.lottery_predictions(user_id);

CREATE INDEX IF NOT EXISTS idx_lottery_predictions_user_created 
ON public.lottery_predictions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lottery_analysis_user_id 
ON public.lottery_analysis(user_id);

CREATE INDEX IF NOT EXISTS idx_lottery_analysis_user_created 
ON public.lottery_analysis(user_id, created_at DESC);

-- 5. 创建用户配置表
CREATE TABLE IF NOT EXISTS public.lottery_user_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  method TEXT NOT NULL, -- statistical, ai, ml, comprehensive
  config JSONB NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT lottery_user_configs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- 6. 为用户配置表添加索引
CREATE INDEX IF NOT EXISTS idx_lottery_user_config_user_id 
ON public.lottery_user_configs(user_id);

CREATE INDEX IF NOT EXISTS idx_lottery_user_config_method 
ON public.lottery_user_configs(method);

-- 7. 创建updated_at触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 为用户配置表添加updated_at触发器
DROP TRIGGER IF EXISTS update_lottery_user_configs_updated_at ON public.lottery_user_configs;
CREATE TRIGGER update_lottery_user_configs_updated_at
BEFORE UPDATE ON public.lottery_user_configs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

