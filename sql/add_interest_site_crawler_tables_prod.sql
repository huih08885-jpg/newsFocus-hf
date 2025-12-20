-- 生产环境（PostgreSQL / Neon 等）兴趣站点爬虫模块数据库迁移脚本
-- 本脚本可安全重复执行，所有操作都包含存在性检查

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 清理可能存在的失败表（如果之前执行失败）
DROP TABLE IF EXISTS public.site_crawl_results CASCADE;
DROP TABLE IF EXISTS public.site_crawl_tasks CASCADE;

-- 1. 站点分组表
CREATE TABLE IF NOT EXISTS public.site_groups (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_groups_order ON public.site_groups ("order");

-- 2. 扩展 site_candidates 表
DO $$
BEGIN
  -- 添加分组ID
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'site_candidates' 
    AND column_name = 'group_id'
  ) THEN
    ALTER TABLE public.site_candidates ADD COLUMN group_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_site_candidates_group_id ON public.site_candidates (group_id);
  END IF;

  -- 添加分析状态
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'site_candidates' 
    AND column_name = 'analysis_status'
  ) THEN
    ALTER TABLE public.site_candidates ADD COLUMN analysis_status TEXT DEFAULT 'pending';
  END IF;

  -- 添加分析结果
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'site_candidates' 
    AND column_name = 'analysis_result'
  ) THEN
    ALTER TABLE public.site_candidates ADD COLUMN analysis_result JSONB;
  END IF;

  -- 添加分析错误信息
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'site_candidates' 
    AND column_name = 'analysis_error'
  ) THEN
    ALTER TABLE public.site_candidates ADD COLUMN analysis_error TEXT;
  END IF;

  -- 添加最后分析时间
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'site_candidates' 
    AND column_name = 'last_analyzed_at'
  ) THEN
    ALTER TABLE public.site_candidates ADD COLUMN last_analyzed_at TIMESTAMPTZ;
  END IF;

  -- 添加最后爬取时间
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'site_candidates' 
    AND column_name = 'last_crawled_at'
  ) THEN
    ALTER TABLE public.site_candidates ADD COLUMN last_crawled_at TIMESTAMPTZ;
  END IF;

  -- 添加是否启用爬虫
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'site_candidates' 
    AND column_name = 'crawl_enabled'
  ) THEN
    ALTER TABLE public.site_candidates ADD COLUMN crawl_enabled BOOLEAN DEFAULT true;
  END IF;

  -- 添加站点名称（用于显示）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'site_candidates' 
    AND column_name = 'name'
  ) THEN
    ALTER TABLE public.site_candidates ADD COLUMN name TEXT;
  END IF;
END $$;

-- 3. 站点爬虫任务表
CREATE TABLE IF NOT EXISTS public.site_crawl_tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  site_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'today' or 'range'
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  result_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_site_crawl_tasks_site FOREIGN KEY (site_id) 
    REFERENCES public.site_candidates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_site_crawl_tasks_site_id ON public.site_crawl_tasks (site_id);
CREATE INDEX IF NOT EXISTS idx_site_crawl_tasks_status ON public.site_crawl_tasks (status);
CREATE INDEX IF NOT EXISTS idx_site_crawl_tasks_created_at ON public.site_crawl_tasks (created_at);

-- 4. 站点爬虫结果表
CREATE TABLE IF NOT EXISTS public.site_crawl_results (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  task_id TEXT NOT NULL,
  site_id UUID NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  summary TEXT,
  published_at TIMESTAMPTZ,
  crawled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  
  CONSTRAINT fk_site_crawl_results_task FOREIGN KEY (task_id) 
    REFERENCES public.site_crawl_tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_site_crawl_results_site FOREIGN KEY (site_id) 
    REFERENCES public.site_candidates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_site_crawl_results_task_id ON public.site_crawl_results (task_id);
CREATE INDEX IF NOT EXISTS idx_site_crawl_results_site_id ON public.site_crawl_results (site_id);
CREATE INDEX IF NOT EXISTS idx_site_crawl_results_crawled_at ON public.site_crawl_results (crawled_at);
CREATE INDEX IF NOT EXISTS idx_site_crawl_results_published_at ON public.site_crawl_results (published_at);

