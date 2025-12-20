-- 为 keyword_groups 表添加 customWebsites 字段
-- 适用于开发环境和生产环境

-- 检查并添加 customWebsites 列（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'keyword_groups' 
        AND column_name = 'customWebsites'
    ) THEN
        ALTER TABLE keyword_groups
        ADD COLUMN "customWebsites" JSONB NULL;
        
        RAISE NOTICE '已成功添加 customWebsites 列';
    ELSE
        RAISE NOTICE 'customWebsites 列已存在，跳过';
    END IF;
END $$;

-- 验证列是否存在
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'keyword_groups'
AND column_name = 'customWebsites';

