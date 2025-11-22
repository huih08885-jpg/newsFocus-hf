import { PrismaClient } from '@prisma/client'
import { prisma } from '../lib/db/prisma'

async function main() {
  // 创建默认平台
  const platforms = [
    { platformId: 'zhihu', name: '知乎' },
    { platformId: 'weibo', name: '微博' },
    { platformId: 'douyin', name: '抖音' },
    { platformId: 'bilibili', name: 'B站' },
    { platformId: 'baidu', name: '百度' },
    { platformId: 'toutiao', name: '今日头条' },
    { platformId: 'redbook', name: '小红书' },
    { platformId: 'netease', name: '网易' },
    { platformId: 'sina', name: '新浪' },
    { platformId: 'qq', name: '腾讯' },
    { platformId: 'douban', name: '豆瓣' },
  ]

  for (const platform of platforms) {
    await prisma.platform.upsert({
      where: { platformId: platform.platformId },
      update: {},
      create: platform,
    })
  }

  // 创建示例关键词组
  const keywordGroups = [
    {
      name: 'AI 人工智能',
      words: ['AI', '人工智能', '机器学习', '深度学习'],
      requiredWords: [],
      excludedWords: [],
      priority: 0,
      enabled: true,
    },
    {
      name: '华为 手机',
      words: ['华为', 'OPPO', 'vivo', '小米'],
      requiredWords: ['手机'],
      excludedWords: [],
      priority: 1,
      enabled: true,
    },
  ]

  for (const group of keywordGroups) {
    await prisma.keywordGroup.create({
      data: group,
    })
  }

  console.log('Seed data created successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

// 导出 seed 函数供 Prisma 使用
export default main

