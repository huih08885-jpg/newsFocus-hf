#!/usr/bin/env tsx
/**
 * 关键词匹配测试脚本
 * 用于诊断关键词匹配是否正常工作
 */

import { PrismaClient } from '@prisma/client'
import { MatcherService } from '../lib/services/matcher'

const prisma = new PrismaClient()

async function testKeywordMatching() {
  console.log('='.repeat(60))
  console.log('关键词匹配诊断工具')
  console.log('='.repeat(60))

  try {
    // 1. 检查关键词组
    console.log('\n[步骤 1] 检查关键词组...')
    const keywordGroups = await prisma.keywordGroup.findMany({
      orderBy: { priority: 'asc' },
    })

    console.log(`找到 ${keywordGroups.length} 个关键词组:`)
    keywordGroups.forEach((group, index) => {
      console.log(`\n  ${index + 1}. ${group.name || '未命名'} (ID: ${group.id})`)
      console.log(`     状态: ${group.enabled ? '✅ 启用' : '❌ 禁用'}`)
      console.log(`     优先级: ${group.priority}`)
      console.log(`     普通词: ${group.words.length > 0 ? group.words.join(', ') : '无'}`)
      console.log(`     必须词: ${group.requiredWords.length > 0 ? group.requiredWords.map(w => w.replace(/^\+/, '')).join(', ') : '无'}`)
      console.log(`     过滤词: ${group.excludedWords.length > 0 ? group.excludedWords.map(w => w.replace(/^!/, '')).join(', ') : '无'}`)
    })

    if (keywordGroups.length === 0) {
      console.log('\n⚠️  警告: 没有找到任何关键词组！')
      console.log('   请访问 /settings/keywords 创建关键词组')
      return
    }

    const enabledGroups = keywordGroups.filter(g => g.enabled)
    console.log(`\n启用的关键词组: ${enabledGroups.length} 个`)
    if (enabledGroups.length === 0) {
      console.log('⚠️  警告: 没有启用的关键词组！')
      console.log('   请启用至少一个关键词组')
      return
    }

    // 2. 检查新闻数据
    console.log('\n[步骤 2] 检查新闻数据...')
    const totalNews = await prisma.newsItem.count()
    const recentNews = await prisma.newsItem.findMany({
      where: {
        crawledAt: {
          gte: new Date(Date.now() - 3600000), // 最近1小时
        },
      },
      take: 10,
      orderBy: { crawledAt: 'desc' },
    })

    console.log(`数据库中的新闻总数: ${totalNews}`)
    console.log(`最近1小时的新闻: ${recentNews.length} 条`)

    if (recentNews.length === 0) {
      console.log('\n⚠️  警告: 最近1小时内没有新闻数据！')
      console.log('   请运行爬取任务获取最新新闻')
      console.log('   或者检查爬取任务是否成功')
    } else {
      console.log('\n最近10条新闻预览:')
      recentNews.forEach((news, index) => {
        console.log(`  ${index + 1}. [${news.platformId}] ${news.title.substring(0, 50)}...`)
      })
    }

    // 3. 检查匹配记录
    console.log('\n[步骤 3] 检查匹配记录...')
    const matchCount = await prisma.newsMatch.count()
    const recentMatches = await prisma.newsMatch.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        newsItem: true,
        keywordGroup: true,
      },
    })

    console.log(`数据库中的匹配记录总数: ${matchCount}`)
    if (recentMatches.length > 0) {
      console.log('\n最近10条匹配记录:')
      recentMatches.forEach((match, index) => {
        console.log(`  ${index + 1}. [${match.keywordGroup.name || '未命名'}] ${match.newsItem.title.substring(0, 50)}...`)
        console.log(`     权重: ${match.weight}, 匹配次数: ${match.matchCount}`)
      })
    } else {
      console.log('\n⚠️  警告: 没有找到任何匹配记录！')
    }

    // 4. 测试匹配功能
    console.log('\n[步骤 4] 测试匹配功能...')
    const matcher = new MatcherService(prisma)
    
    if (recentNews.length > 0) {
      console.log('\n测试匹配最近爬取的新闻...')
      const testNews = recentNews.slice(0, 5)
      const matches = await matcher.matchNewsItems(
        testNews.map(n => ({ id: n.id, title: n.title }))
      )

      console.log(`测试了 ${testNews.length} 条新闻，匹配到 ${matches.size} 条`)
      
      if (matches.size > 0) {
        console.log('\n匹配结果:')
        matches.forEach((groups, newsId) => {
          const news = testNews.find(n => n.id === newsId)
          if (news) {
            console.log(`\n  📰 ${news.title.substring(0, 60)}...`)
            groups.forEach(group => {
              console.log(`     ✓ 匹配到: ${group.name || '未命名'}`)
            })
          }
        })
      } else {
        console.log('\n⚠️  警告: 测试的新闻中没有匹配到任何关键词组！')
        console.log('\n可能的原因:')
        console.log('  1. 关键词组设置不正确')
        console.log('  2. 新闻标题不包含关键词')
        console.log('  3. 必须词或过滤词设置太严格')
        console.log('\n建议:')
        console.log('  1. 使用关键词测试功能验证关键词组')
        console.log('  2. 检查关键词拼写是否正确')
        console.log('  3. 调整必须词和过滤词设置')
      }
    }

    // 5. 诊断建议
    console.log('\n' + '='.repeat(60))
    console.log('诊断建议')
    console.log('='.repeat(60))

    if (enabledGroups.length === 0) {
      console.log('\n❌ 问题: 没有启用的关键词组')
      console.log('   解决: 访问 /settings/keywords 启用关键词组')
    }

    if (recentNews.length === 0) {
      console.log('\n❌ 问题: 最近1小时内没有新闻数据')
      console.log('   解决: 运行爬取任务获取最新新闻')
    }

    if (matchCount === 0 && recentNews.length > 0 && enabledGroups.length > 0) {
      console.log('\n❌ 问题: 有新闻和关键词组，但没有匹配记录')
      console.log('   可能原因:')
      console.log('   1. 关键词组不匹配任何新闻标题')
      console.log('   2. 匹配逻辑有问题')
      console.log('   解决:')
      console.log('   1. 使用测试功能验证关键词组')
      console.log('   2. 检查关键词拼写')
      console.log('   3. 运行爬取任务，确保匹配流程执行')
    }

    if (matchCount > 0) {
      console.log('\n✅ 匹配功能正常工作')
      console.log(`   已有 ${matchCount} 条匹配记录`)
    }

  } catch (error) {
    console.error('\n❌ 诊断过程出错:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testKeywordMatching().catch(console.error)

