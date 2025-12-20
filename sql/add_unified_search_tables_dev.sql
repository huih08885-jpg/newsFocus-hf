-- 开发环境（PostgreSQL / Windows）统一搜索相关表
-- 本脚本可安全重复执行，所有操作都包含存在性检查

-- 需要 pgcrypto 扩展以支持 gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- search_results 表
CREATE TABLE IF NOT EXISTS search_results (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  keywords TEXT[] NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  snippet TEXT,
  confidence NUMERIC(5, 2),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- search_results 表的索引
CREATE INDEX IF NOT EXISTS idx_search_results_source_created_at
  ON search_results (source, created_at);

CREATE INDEX IF NOT EXISTS idx_search_results_created_at
  ON search_results (created_at);

-- site_candidates 表
CREATE TABLE IF NOT EXISTS site_candidates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  keyword_group_id TEXT,
  last_discovered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  config_json JSONB,
  stats_json JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- site_candidates 表的索引
CREATE INDEX IF NOT EXISTS idx_site_candidates_domain
  ON site_candidates (domain);

CREATE INDEX IF NOT EXISTS idx_site_candidates_status
  ON site_candidates (status);

CREATE INDEX IF NOT EXISTS idx_site_candidates_keyword_group_id
  ON site_candidates (keyword_group_id);

-- keyword_groups 表增加 discovered_websites 字段（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'keyword_groups' 
    AND column_name = 'discovered_websites'
  ) THEN
    ALTER TABLE keyword_groups
      ADD COLUMN discovered_websites JSONB;
  END IF;
END $$;

