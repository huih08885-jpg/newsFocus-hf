/**
 * 测试 AI 分析模块功能
 * 运行: tsx scripts/test-ai-analysis.ts
 */

import { PrismaClient } from '@prisma/client'
import { AIAnalysisService } from '../lib/services/ai-analysis'
import { CorpusGenerator } from '../lib/services/corpus-generator'

const prisma = new PrismaClient()

async function testAIAnalysis() {
  try {
    console.log('🧪 开始测试 AI 分析模块...\n')

    // 1. 测试数据库连接
    console.log('1️⃣ 测试数据库连接...')
    const userCount = await prisma.user.count()
    console.log(`✅ 数据库连接正常，当前用户数: ${userCount}\n`)

    // 2. 检查表是否存在
    console.log('2️⃣ 检查表结构...')
    const tables = [
      'analysis_tasks',
      'analysis_shares',
      'analysis_comments',
      'analysis_likes',
      'user_subscriptions',
    ]

    for (const table of tables) {
      try {
        const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT COUNT(*) as count FROM ${table}`
        )
        console.log(`  ✅ ${table}: 存在 (记录数: ${result[0]?.count || 0})`)
      } catch (error) {
        console.log(`  ❌ ${table}: 不存在或无法访问`)
        console.error(`     错误: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }
    console.log()

    // 3. 测试 CorpusGenerator
    console.log('3️⃣ 测试语料生成服务...')
    const corpusGenerator = new CorpusGenerator(prisma)
    
    // 检查是否有关键词组
    const keywordGroups = await prisma.keywordGroup.findMany({
      where: { enabled: true },
      take: 1,
    })

    if (keywordGroups.length > 0) {
      console.log(`  📝 找到关键词组: ${keywordGroups[0].name || keywordGroups[0].id}`)
      try {
        const corpus = await corpusGenerator.generateFromKeywordGroup(keywordGroups[0].id, {
          maxItems: 5,
        })
        console.log(`  ✅ 语料生成成功: ${corpus.itemCount} 条数据`)
        console.log(`  📊 语料长度: ${corpus.corpus.length} 字符`)
      } catch (error) {
        console.log(`  ⚠️  语料生成失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    } else {
      console.log('  ⚠️  没有找到可用的关键词组')
    }
    console.log()

    // 4. 测试 AIAnalysisService
    console.log('4️⃣ 测试 AI 分析服务...')
    const analysisService = new AIAnalysisService(prisma)

    // 检查是否有用户
    const users = await prisma.user.findMany({ take: 1 })
    if (users.length > 0) {
      const testUser = users[0]
      console.log(`  👤 使用测试用户: ${testUser.email}`)

      // 测试配额检查
      const quota = await analysisService.getUserSubscription(testUser.id)
      console.log(`  📊 用户配额: ${quota.remaining} / ${quota.quota} (计划: ${quota.plan})`)

      // 测试获取分析列表
      const analyses = await analysisService.getUserAnalyses(testUser.id, {
        page: 1,
        pageSize: 5,
      })
      console.log(`  📋 用户分析任务数: ${analyses.total}`)
    } else {
      console.log('  ⚠️  没有找到可用的用户')
    }
    console.log()

    // 5. 测试环境变量
    console.log('5️⃣ 检查环境变量...')
    const deepseekKey = process.env.DEEPSEEK_API_KEY
    if (deepseekKey) {
      console.log(`  ✅ DEEPSEEK_API_KEY: 已设置 (长度: ${deepseekKey.length})`)
    } else {
      console.log(`  ⚠️  DEEPSEEK_API_KEY: 未设置 (AI 分析功能需要此配置)`)
    }
    console.log()

    console.log('✅ 测试完成！')
    console.log('\n📝 下一步:')
    console.log('  1. 确保 DEEPSEEK_API_KEY 已配置')
    console.log('  2. 访问 /analysis 页面创建分析任务')
    console.log('  3. 查看分析结果')

  } catch (error) {
    console.error('❌ 测试失败:', error)
    if (error instanceof Error) {
      console.error('   错误信息:', error.message)
      console.error('   堆栈:', error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

testAIAnalysis()

