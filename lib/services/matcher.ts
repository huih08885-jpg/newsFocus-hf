import { PrismaClient } from '@prisma/client'

interface KeywordGroup {
  id: string
  name?: string | null
  words: string[]
  requiredWords: string[]
  excludedWords: string[]
  priority: number
  enabled: boolean
}

interface MatchResult {
  matched: boolean
  keywordGroup?: KeywordGroup
  matchedWords?: string[]
}

export class MatcherService {
  private prisma: PrismaClient
  private keywordGroupsCache: KeywordGroup[] | null = null
  private cacheExpiry = 0
  private CACHE_TTL = 60000 // 1分钟

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * 获取所有启用的关键词组
   */
  async getEnabledKeywordGroups(): Promise<KeywordGroup[]> {
    const now = Date.now()

    // 使用内存缓存
    if (this.keywordGroupsCache && now < this.cacheExpiry) {
      return this.keywordGroupsCache
    }

    const groups = await this.prisma.keywordGroup.findMany({
      where: { enabled: true },
      orderBy: { priority: 'asc' },
    })

    this.keywordGroupsCache = groups.map(g => ({
      id: g.id,
      name: g.name,
      words: g.words,
      requiredWords: g.requiredWords,
      excludedWords: g.excludedWords,
      priority: g.priority,
      enabled: g.enabled,
    }))
    this.cacheExpiry = now + this.CACHE_TTL

    return this.keywordGroupsCache
  }

  /**
   * 匹配新闻标题
   */
  async matchTitle(
    title: string,
    keywordGroups?: KeywordGroup[]
  ): Promise<MatchResult | null> {
    const groups = keywordGroups || await this.getEnabledKeywordGroups()

    for (const group of groups) {
      const result = this.matchesGroup(title, group)
      if (result.matched) {
        return result
      }
    }

    return null
  }

  /**
   * 批量匹配新闻
   */
  async matchNewsItems(
    newsItems: Array<{ id: string; title: string }>
  ): Promise<Map<string, KeywordGroup[]>> {
    const groups = await this.getEnabledKeywordGroups()
    const matches = new Map<string, KeywordGroup[]>()

    for (const item of newsItems) {
      const matchedGroups: KeywordGroup[] = []

      for (const group of groups) {
        const result = this.matchesGroup(item.title, group)
        if (result.matched && result.keywordGroup) {
          matchedGroups.push(result.keywordGroup)
        }
      }

      if (matchedGroups.length > 0) {
        matches.set(item.id, matchedGroups)
      }
    }

    return matches
  }

  /**
   * 测试单个关键词组匹配（用于测试功能）
   */
  testKeywordGroup(title: string, group: KeywordGroup): MatchResult {
    return this.matchesGroup(title, group)
  }

  /**
   * 检查标题是否匹配词组
   */
  private matchesGroup(
    title: string,
    group: KeywordGroup
  ): MatchResult {
    const titleLower = title.toLowerCase()

    // 1. 检查普通词匹配
    const matchedWords: string[] = []
    let hasMatchedWord = false

    for (const word of group.words) {
      if (titleLower.includes(word.toLowerCase())) {
        matchedWords.push(word)
        hasMatchedWord = true
      }
    }

    if (!hasMatchedWord) {
      return { matched: false }
    }

    // 2. 检查必须词（如果存在）
    if (group.requiredWords.length > 0) {
      const requiredWordsLower = group.requiredWords.map(w => 
        w.replace(/^\+/, '').toLowerCase()
      )
      
      for (const requiredWord of requiredWordsLower) {
        if (!titleLower.includes(requiredWord)) {
          return { matched: false }
        }
      }
    }

    // 3. 检查过滤词（如果包含则排除）
    if (group.excludedWords.length > 0) {
      const excludedWordsLower = group.excludedWords.map(w => 
        w.replace(/^!/, '').toLowerCase()
      )
      
      for (const excludedWord of excludedWordsLower) {
        if (titleLower.includes(excludedWord)) {
          return { matched: false }
        }
      }
    }

    return {
      matched: true,
      keywordGroup: group,
      matchedWords,
    }
  }
}

