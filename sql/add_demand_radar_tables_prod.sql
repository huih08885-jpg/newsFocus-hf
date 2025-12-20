-- 需求雷达模块数据库表（生产环境）
-- 执行日期: 2024-12-XX
-- 说明: 本脚本可安全重复执行，所有操作都包含存在性检查
-- 注意: Neon PostgreSQL 已内置支持 gen_random_uuid()，无需手动创建扩展

-- 1. 原始数据源表（从各平台抓取的原始内容）
CREATE TABLE IF NOT EXISTS public.demand_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    source_id TEXT,
    title TEXT,
    content TEXT NOT NULL,
    url TEXT,
    author TEXT,
    upvotes INT DEFAULT 0,
    comments INT DEFAULT 0,
    metadata JSONB,
    crawled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_demand_sources_platform_crawled ON public.demand_sources(platform, crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_demand_sources_crawled_at ON public.demand_sources(crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_demand_sources_platform ON public.demand_sources(platform);

-- 2. 提取的需求表（从原始内容中提取的需求句子）
CREATE TABLE IF NOT EXISTS public.extracted_demands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL,
    original_text TEXT NOT NULL,
    cleaned_text TEXT NOT NULL,
    keywords TEXT[] DEFAULT '{}',
    category TEXT,
    frequency INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_extracted_demands_source FOREIGN KEY (source_id) REFERENCES public.demand_sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_extracted_demands_source ON public.extracted_demands(source_id);
CREATE INDEX IF NOT EXISTS idx_extracted_demands_category ON public.extracted_demands(category);
CREATE INDEX IF NOT EXISTS idx_extracted_demands_frequency ON public.extracted_demands(frequency DESC);
CREATE INDEX IF NOT EXISTS idx_extracted_demands_created_at ON public.extracted_demands(created_at DESC);

-- 3. 每日需求榜单表
CREATE TABLE IF NOT EXISTS public.demand_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demand_id UUID NOT NULL,
    ranking_date TIMESTAMPTZ NOT NULL,
    rank INT NOT NULL,
    frequency INT NOT NULL,
    trend TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_demand_rankings_demand FOREIGN KEY (demand_id) REFERENCES public.extracted_demands(id) ON DELETE CASCADE,
    CONSTRAINT uk_demand_rankings_date_rank UNIQUE (ranking_date, rank)
);

CREATE INDEX IF NOT EXISTS idx_demand_rankings_date ON public.demand_rankings(ranking_date DESC);
CREATE INDEX IF NOT EXISTS idx_demand_rankings_demand ON public.demand_rankings(demand_id);

-- 4. 需求雷达任务表（记录每次抓取任务）
CREATE TABLE IF NOT EXISTS public.demand_radar_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    platforms TEXT[] DEFAULT '{}',
    sources_count INT NOT NULL DEFAULT 0,
    demands_count INT NOT NULL DEFAULT 0,
    rankings_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_demand_radar_tasks_status ON public.demand_radar_tasks(status);
CREATE INDEX IF NOT EXISTS idx_demand_radar_tasks_created_at ON public.demand_radar_tasks(created_at DESC);

