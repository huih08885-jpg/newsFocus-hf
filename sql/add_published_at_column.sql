-- 添加 publishedAt 列到 news_items 表
-- 适用于开发环境和生产环境

-- 检查并添加 publishedAt 列（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'news_items' 
        AND column_name = 'publishedAt'
    ) THEN
        ALTER TABLE news_items
        ADD COLUMN "publishedAt" TIMESTAMP NULL;
        
        RAISE NOTICE '已成功添加 publishedAt 列';
    ELSE
        RAISE NOTICE 'publishedAt 列已存在，跳过';
    END IF;
END $$;

-- 验证列是否存在
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'news_items'
AND column_name = 'publishedAt';

