-- AI 分析模块数据库表（生产环境）
-- 执行日期: 2024-12-05
-- 说明: 本脚本可安全重复执行，所有操作都包含存在性检查
-- 注意: Neon PostgreSQL 已内置支持 gen_random_uuid()，无需手动创建扩展

-- 1. AI 分析任务表
CREATE TABLE IF NOT EXISTS public.analysis_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('personal', 'trend', 'business')),
    source_type TEXT NOT NULL CHECK (source_type IN ('keyword', 'site_group')),
    source_id TEXT NOT NULL,
    corpus TEXT NOT NULL,
    prompt TEXT,
    result JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    token_usage INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CONSTRAINT fk_analysis_tasks_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analysis_tasks_user_created ON public.analysis_tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_tasks_status ON public.analysis_tasks(status);
CREATE INDEX IF NOT EXISTS idx_analysis_tasks_source ON public.analysis_tasks(source_type, source_id);

-- 2. 分析结果分享表
CREATE TABLE IF NOT EXISTS public.analysis_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT false,
    view_count INT NOT NULL DEFAULT 0,
    like_count INT NOT NULL DEFAULT 0,
    comment_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_analysis_shares_task FOREIGN KEY (task_id) REFERENCES public.analysis_tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_analysis_shares_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analysis_shares_public_created ON public.analysis_shares(is_public, created_at DESC) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_analysis_shares_user ON public.analysis_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_shares_task ON public.analysis_shares(task_id);

-- 3. 评论表
CREATE TABLE IF NOT EXISTS public.analysis_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    parent_id UUID,
    like_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_analysis_comments_share FOREIGN KEY (share_id) REFERENCES public.analysis_shares(id) ON DELETE CASCADE,
    CONSTRAINT fk_analysis_comments_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_analysis_comments_parent FOREIGN KEY (parent_id) REFERENCES public.analysis_comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analysis_comments_share_created ON public.analysis_comments(share_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_comments_user ON public.analysis_comments(user_id);

-- 4. 点赞表
CREATE TABLE IF NOT EXISTS public.analysis_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_analysis_likes_share FOREIGN KEY (share_id) REFERENCES public.analysis_shares(id) ON DELETE CASCADE,
    CONSTRAINT fk_analysis_likes_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT uk_analysis_likes_share_user UNIQUE (share_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_analysis_likes_share ON public.analysis_likes(share_id);
CREATE INDEX IF NOT EXISTS idx_analysis_likes_user ON public.analysis_likes(user_id);

-- 5. 用户订阅表
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    analysis_quota INT NOT NULL DEFAULT 3,
    used_quota INT NOT NULL DEFAULT 0,
    quota_reset_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_subscriptions_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan ON public.user_subscriptions(plan);

-- 更新分享表的点赞数和评论数触发器
CREATE OR REPLACE FUNCTION public.update_analysis_share_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF TG_TABLE_NAME = 'analysis_likes' THEN
            UPDATE public.analysis_shares SET like_count = like_count + 1 WHERE id = NEW.share_id;
        ELSIF TG_TABLE_NAME = 'analysis_comments' THEN
            UPDATE public.analysis_shares SET comment_count = comment_count + 1 WHERE id = NEW.share_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'analysis_likes' THEN
            UPDATE public.analysis_shares SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.share_id;
        ELSIF TG_TABLE_NAME = 'analysis_comments' THEN
            UPDATE public.analysis_shares SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.share_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_share_like_count
    AFTER INSERT OR DELETE ON public.analysis_likes
    FOR EACH ROW EXECUTE FUNCTION public.update_analysis_share_counts();

CREATE TRIGGER trigger_update_share_comment_count
    AFTER INSERT OR DELETE ON public.analysis_comments
    FOR EACH ROW EXECUTE FUNCTION public.update_analysis_share_counts();

