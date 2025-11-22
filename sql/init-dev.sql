-- ============================================
-- 开发环境数据库初始化脚本 (PostgreSQL 11)
-- ============================================
-- 数据库: newsfocus_dev
-- PostgreSQL版本: 11+
-- 用途: 开发环境数据库初始化
-- ============================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 创建表结构
-- ============================================

-- 平台表
CREATE TABLE IF NOT EXISTS "platforms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platformId" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- 新闻项表
CREATE TABLE IF NOT EXISTS "news_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platformId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "mobileUrl" TEXT,
    "rank" INTEGER NOT NULL,
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "news_items_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "platforms"("platformId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "news_items_platformId_title_crawledAt_key" UNIQUE ("platformId", "title", "crawledAt")
);

-- 关键词组表
CREATE TABLE IF NOT EXISTS "keyword_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "words" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "requiredWords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "excludedWords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- 新闻匹配记录表
CREATE TABLE IF NOT EXISTS "news_matches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "newsItemId" TEXT NOT NULL,
    "keywordGroupId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "matchCount" INTEGER NOT NULL DEFAULT 1,
    "firstMatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "news_matches_newsItemId_fkey" FOREIGN KEY ("newsItemId") REFERENCES "news_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "news_matches_keywordGroupId_fkey" FOREIGN KEY ("keywordGroupId") REFERENCES "keyword_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "news_matches_newsItemId_keywordGroupId_key" UNIQUE ("newsItemId", "keywordGroupId")
);

-- 新闻出现记录表
CREATE TABLE IF NOT EXISTS "news_appearances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "newsItemId" TEXT NOT NULL,
    "matchId" TEXT,
    "rank" INTEGER NOT NULL,
    "appearedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "news_appearances_newsItemId_fkey" FOREIGN KEY ("newsItemId") REFERENCES "news_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "news_appearances_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "news_matches"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 推送记录表
CREATE TABLE IF NOT EXISTS "push_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "pushedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_records_channel_reportDate_reportType_key" UNIQUE ("channel", "reportDate", "reportType")
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS "system_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 爬取任务记录表
CREATE TABLE IF NOT EXISTS "crawl_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- 用户表
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- 会话表
CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================
-- 2. 创建索引
-- ============================================

-- 平台表索引
CREATE INDEX IF NOT EXISTS "platforms_platformId_idx" ON "platforms"("platformId");
CREATE INDEX IF NOT EXISTS "platforms_enabled_idx" ON "platforms"("enabled");

-- 新闻项表索引
CREATE INDEX IF NOT EXISTS "news_items_platformId_crawledAt_idx" ON "news_items"("platformId", "crawledAt");
CREATE INDEX IF NOT EXISTS "news_items_title_idx" ON "news_items"("title");
CREATE INDEX IF NOT EXISTS "news_items_crawledAt_idx" ON "news_items"("crawledAt");

-- 关键词组表索引
CREATE INDEX IF NOT EXISTS "keyword_groups_priority_idx" ON "keyword_groups"("priority");
CREATE INDEX IF NOT EXISTS "keyword_groups_enabled_idx" ON "keyword_groups"("enabled");

-- 新闻匹配记录表索引
CREATE INDEX IF NOT EXISTS "news_matches_weight_idx" ON "news_matches"("weight");
CREATE INDEX IF NOT EXISTS "news_matches_keywordGroupId_weight_idx" ON "news_matches"("keywordGroupId", "weight");
CREATE INDEX IF NOT EXISTS "news_matches_lastMatchedAt_idx" ON "news_matches"("lastMatchedAt");

-- 新闻出现记录表索引
CREATE INDEX IF NOT EXISTS "news_appearances_newsItemId_appearedAt_idx" ON "news_appearances"("newsItemId", "appearedAt");
CREATE INDEX IF NOT EXISTS "news_appearances_matchId_idx" ON "news_appearances"("matchId");
CREATE INDEX IF NOT EXISTS "news_appearances_appearedAt_idx" ON "news_appearances"("appearedAt");

-- 推送记录表索引
CREATE INDEX IF NOT EXISTS "push_records_reportDate_idx" ON "push_records"("reportDate");
CREATE INDEX IF NOT EXISTS "push_records_channel_reportDate_idx" ON "push_records"("channel", "reportDate");
CREATE INDEX IF NOT EXISTS "push_records_pushedAt_idx" ON "push_records"("pushedAt");

-- 系统配置表索引
CREATE INDEX IF NOT EXISTS "system_configs_key_idx" ON "system_configs"("key");

-- 爬取任务记录表索引
CREATE INDEX IF NOT EXISTS "crawl_tasks_status_idx" ON "crawl_tasks"("status");
CREATE INDEX IF NOT EXISTS "crawl_tasks_createdAt_idx" ON "crawl_tasks"("createdAt");

-- 用户表索引
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");

-- 会话表索引
CREATE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions"("token");
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX IF NOT EXISTS "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- ============================================
-- 3. 创建触发器（自动更新 updatedAt）
-- ============================================

-- 创建更新 updatedAt 的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要的表添加触发器
CREATE TRIGGER update_platforms_updated_at BEFORE UPDATE ON "platforms"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_news_items_updated_at BEFORE UPDATE ON "news_items"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_keyword_groups_updated_at BEFORE UPDATE ON "keyword_groups"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_news_matches_updated_at BEFORE UPDATE ON "news_matches"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON "system_configs"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crawl_tasks_updated_at BEFORE UPDATE ON "crawl_tasks"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "users"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. 插入初始数据
-- ============================================

-- 插入平台数据（PostgreSQL 11 使用 uuid_generate_v4()）
INSERT INTO "platforms" ("id", "platformId", "name", "enabled", "createdAt", "updatedAt")
VALUES
    (uuid_generate_v4()::text, 'zhihu', '知乎', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (uuid_generate_v4()::text, 'weibo', '微博', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (uuid_generate_v4()::text, 'douyin', '抖音', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (uuid_generate_v4()::text, 'bilibili', 'B站', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (uuid_generate_v4()::text, 'baidu', '百度', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (uuid_generate_v4()::text, 'toutiao', '今日头条', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (uuid_generate_v4()::text, 'redbook', '小红书', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (uuid_generate_v4()::text, 'netease', '网易', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (uuid_generate_v4()::text, 'sina', '新浪', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (uuid_generate_v4()::text, 'qq', '腾讯', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (uuid_generate_v4()::text, 'douban', '豆瓣', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("platformId") DO NOTHING;

-- 插入示例关键词组数据（PostgreSQL 11 使用 uuid_generate_v4()）
INSERT INTO "keyword_groups" ("id", "name", "words", "requiredWords", "excludedWords", "priority", "enabled", "createdAt", "updatedAt")
VALUES
    (
        uuid_generate_v4()::text,
        'AI 人工智能',
        ARRAY['AI', '人工智能', '机器学习', '深度学习']::TEXT[],
        ARRAY[]::TEXT[],
        ARRAY[]::TEXT[],
        0,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        uuid_generate_v4()::text,
        '华为 手机',
        ARRAY['华为', 'OPPO', 'vivo', '小米']::TEXT[],
        ARRAY['手机']::TEXT[],
        ARRAY[]::TEXT[],
        1,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. 完成提示
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '开发环境数据库初始化完成！';
    RAISE NOTICE '已创建所有表、索引、触发器和初始数据。';
    RAISE NOTICE '包括用户认证相关的表（users, sessions）。';
END $$;
