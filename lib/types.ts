/**
 * 共享类型定义
 */

// 关键词组类型（与 Prisma KeywordGroup 模型对应）
export interface KeywordGroup {
  id: string
  name?: string | null
  words: string[]
  requiredWords: string[]
  excludedWords: string[]
  priority: number
  enabled: boolean
}

