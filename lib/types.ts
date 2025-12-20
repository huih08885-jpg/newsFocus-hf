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
  customWebsites?: any // JSON类型，存储自定义网站配置
  discoveredWebsites?: any // JSON类型，存储候选站点
}

