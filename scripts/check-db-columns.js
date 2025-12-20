// 检查数据库列是否存在的脚本
// 运行: node scripts/check-db-columns.js

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkColumns() {
  try {
    console.log('🔍 检查数据库连接...')
    
    // 检查 DATABASE_URL
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      console.error('❌ DATABASE_URL 未设置')
      process.exit(1)
    }
    
    // 隐藏密码显示连接信息
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@')
    console.log('📊 数据库连接:', maskedUrl)
    
    // 尝试查询数据库中的列
    const result = await prisma.$queryRaw`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'news_items'
      AND column_name IN ('publishedAt', 'content')
      ORDER BY column_name;
    `
    
    console.log('\n📋 news_items 表的相关列:')
    if (result.length === 0) {
      console.log('  ⚠️  未找到 publishedAt 或 content 列')
    } else {
      result.forEach(col => {
        console.log(`  ✅ ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
      })
    }
    
    // 检查所有列
    const allColumns = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'news_items'
      ORDER BY ordinal_position;
    `
    
    console.log('\n📋 news_items 表的所有列:')
    allColumns.forEach(col => {
      console.log(`  - ${col.column_name}`)
    })
    
    // 检查是否有 publishedAt
    const hasPublishedAt = allColumns.some(col => col.column_name === 'publishedAt')
    const hasContent = allColumns.some(col => col.column_name === 'content')
    
    console.log('\n📊 检查结果:')
    console.log(`  publishedAt: ${hasPublishedAt ? '✅ 存在' : '❌ 不存在'}`)
    console.log(`  content: ${hasContent ? '✅ 存在' : '❌ 不存在'}`)
    
    if (!hasPublishedAt) {
      console.log('\n⚠️  需要执行 SQL 添加 publishedAt 列:')
      console.log('   运行: psql $DATABASE_URL -f sql/add_published_at_column.sql')
      console.log('   或执行: ALTER TABLE news_items ADD COLUMN "publishedAt" TIMESTAMP NULL;')
    }
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message)
    if (error.message.includes('publishedAt')) {
      console.error('\n💡 提示: 数据库中没有 publishedAt 列，需要执行 SQL 添加')
    }
  } finally {
    await prisma.$disconnect()
  }
}

checkColumns()

