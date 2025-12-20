# 关键词配置规则详解

## 📋 概述

关键词配置系统是新闻聚合系统的核心功能，用于：
1. **搜索阶段**：从关键词组中提取关键词，用于搜索引擎查询
2. **匹配阶段**：对爬取到的新闻标题进行智能匹配，筛选相关新闻

## 🎯 关键词配置的三种类型

### 1. **普通词（words）**

**作用**：用于搜索和匹配的基础关键词

**搜索阶段**：
- 从关键词组中提取所有 `words`，合并后用于搜索引擎查询
- 例如：关键词组A有 `["AI", "人工智能"]`，关键词组B有 `["机器学习"]`
- 合并后用于搜索：`["AI", "人工智能", "机器学习"]`

**匹配阶段**：
- 标题包含**任意一个**普通词即通过第一步检查
- 匹配是**不区分大小写**的

**示例**：
```typescript
words: ["AI", "人工智能", "机器学习"]

// 搜索阶段：使用这些词去搜索引擎查询
// 匹配阶段：
✅ "华为发布新款AI手机"  // 包含 "AI"
✅ "人工智能技术突破"      // 包含 "人工智能"
✅ "机器学习算法优化"      // 包含 "机器学习"
❌ "今日天气晴朗"          // 不包含任何词
```

### 2. **必须词（requiredWords，以 `+` 开头）**

**作用**：进一步精确匹配，标题必须包含所有必须词

**搜索阶段**：
- **不参与搜索**，只用于匹配阶段
- 必须词不会发送给搜索引擎

**匹配阶段**：
- 如果配置了必须词，标题必须**同时包含所有必须词**才能匹配
- 格式：以 `+` 开头，如 `+手机`、`+芯片`
- 匹配时会自动去除 `+` 前缀

**示例**：
```typescript
words: ["华为", "苹果"]
requiredWords: ["+手机", "+芯片"]

// 搜索阶段：只使用 words = ["华为", "苹果"] 去搜索
// 匹配阶段：
✅ "华为发布新款手机，搭载自研芯片"  // 包含"华为"和"手机"和"芯片"
✅ "苹果手机芯片性能提升"            // 包含"苹果"和"手机"和"芯片"
❌ "华为发布新款手机"                // 缺少"芯片"
❌ "苹果芯片性能提升"                // 缺少"手机"
❌ "华为发布新款电脑"                // 不包含"手机"
```

### 3. **过滤词（excludedWords，以 `!` 开头）**

**作用**：排除不相关的新闻，即使包含普通词也会被过滤

**搜索阶段**：
- **不参与搜索**，只用于匹配阶段
- 过滤词不会发送给搜索引擎

**匹配阶段**：
- 如果标题包含**任意一个**过滤词，则**不匹配**
- 格式：以 `!` 开头，如 `!水果`、`!价格`
- 匹配时会自动去除 `!` 前缀

**示例**：
```typescript
words: ["苹果"]
excludedWords: ["!水果", "!价格"]

// 搜索阶段：使用 words = ["苹果"] 去搜索
// 匹配阶段：
✅ "苹果公司发布新款iPhone"  // 包含"苹果"，不包含过滤词
✅ "苹果手机销量创新高"      // 包含"苹果"，不包含过滤词
❌ "苹果水果价格下跌"        // 包含"水果"（过滤词）
❌ "苹果手机价格公布"        // 包含"价格"（过滤词）
```

## 🔄 完整工作流程

### 阶段1：搜索阶段（爬取前）

```typescript
// 1. 用户选择关键词组（例如：选择了关键词组A和B）
keywordGroupIds: ["group-a", "group-b"]

// 2. 从数据库查询关键词组
const groups = await prisma.keywordGroup.findMany({
  where: { id: { in: keywordGroupIds }, enabled: true },
  select: { id: true, words: true }
})

// 3. 提取所有普通词，合并去重
const searchKeywords = groups.flatMap(g => g.words)
// 结果：["AI", "人工智能", "机器学习", "深度学习"]

// 4. 使用这些关键词去搜索引擎查询
// 注意：requiredWords 和 excludedWords 不参与搜索
await searchEngine.search(searchKeywords)
```

**代码位置**：
- `app/api/crawl/route.ts` (159-179行)：提取关键词组的关键词
- `lib/services/crawler.ts` (336-346行)：使用关键词进行搜索

### 阶段2：匹配阶段（爬取后）

```typescript
// 1. 爬取到新闻标题
const newsTitle = "华为发布新款AI手机，搭载自研芯片"

// 2. 遍历所有启用的关键词组（按优先级排序）
const groups = await matcherService.getEnabledKeywordGroups()

// 3. 对每个关键词组执行匹配
for (const group of groups) {
  const result = matchesGroup(newsTitle, group)
  if (result.matched) {
    // 匹配成功，创建 NewsMatch 记录
    break
  }
}
```

**匹配算法**（`lib/services/matcher.ts` 115-167行）：

```typescript
private matchesGroup(title: string, group: KeywordGroup): MatchResult {
  const titleLower = title.toLowerCase()
  
  // 步骤1：检查普通词匹配（OR逻辑）
  let hasMatchedWord = false
  for (const word of group.words) {
    if (titleLower.includes(word.toLowerCase())) {
      hasMatchedWord = true
      break  // 只要有一个匹配即可
    }
  }
  if (!hasMatchedWord) {
    return { matched: false }  // 第一步失败，直接返回
  }
  
  // 步骤2：检查必须词（AND逻辑）
  if (group.requiredWords.length > 0) {
    for (const requiredWord of group.requiredWords) {
      const word = requiredWord.replace(/^\+/, '').toLowerCase()
      if (!titleLower.includes(word)) {
        return { matched: false }  // 缺少必须词，不匹配
      }
    }
  }
  
  // 步骤3：检查过滤词（排除逻辑）
  if (group.excludedWords.length > 0) {
    for (const excludedWord of group.excludedWords) {
      const word = excludedWord.replace(/^!/, '').toLowerCase()
      if (titleLower.includes(word)) {
        return { matched: false }  // 包含过滤词，不匹配
      }
    }
  }
  
  // 所有检查通过，匹配成功
  return { matched: true, keywordGroup: group, matchedWords: [...] }
}
```

## 📊 实际应用示例

### 示例1：AI 人工智能关键词组

**配置**：
```json
{
  "name": "AI 人工智能",
  "words": ["AI", "人工智能", "机器学习", "深度学习"],
  "requiredWords": [],
  "excludedWords": ["!水果", "!价格"],
  "priority": 0,
  "enabled": true
}
```

**工作流程**：

1. **搜索阶段**：
   - 提取关键词：`["AI", "人工智能", "机器学习", "深度学习"]`
   - 使用这些词去搜索引擎查询
   - 可能搜索到：100条新闻

2. **匹配阶段**（对每条新闻标题）：
   - ✅ "AI技术突破，机器学习算法优化" → 匹配（包含"AI"和"机器学习"，不包含过滤词）
   - ✅ "人工智能助力医疗诊断" → 匹配（包含"人工智能"，不包含过滤词）
   - ❌ "苹果AI水果价格下跌" → 不匹配（包含"水果"过滤词）
   - ❌ "今日天气晴朗" → 不匹配（不包含任何普通词）

### 示例2：手机芯片关键词组

**配置**：
```json
{
  "name": "手机芯片",
  "words": ["华为", "苹果", "小米"],
  "requiredWords": ["+手机", "+芯片"],
  "excludedWords": [],
  "priority": 1,
  "enabled": true
}
```

**工作流程**：

1. **搜索阶段**：
   - 提取关键词：`["华为", "苹果", "小米"]`
   - 使用这些词去搜索引擎查询
   - 注意：`+手机` 和 `+芯片` **不参与搜索**

2. **匹配阶段**：
   - ✅ "华为发布新款手机，搭载自研芯片" → 匹配（包含"华为"、"手机"、"芯片"）
   - ✅ "苹果手机芯片性能提升50%" → 匹配（包含"苹果"、"手机"、"芯片"）
   - ❌ "华为发布新款手机" → 不匹配（缺少"芯片"必须词）
   - ❌ "苹果芯片性能提升" → 不匹配（缺少"手机"必须词）
   - ❌ "小米发布新款电脑" → 不匹配（不包含"手机"必须词）

## 🔍 关键代码位置

### 1. 关键词提取（搜索阶段）

**文件**：`app/api/crawl/route.ts`
```typescript:159:179:app/api/crawl/route.ts
// 使用关键词组
const groups = await prisma.keywordGroup.findMany({
  where: {
    id: { in: keywordGroupIds },
    enabled: true,
  },
  select: {
    id: true,
    words: true,  // 只提取 words，不提取 requiredWords 和 excludedWords
  },
})
keywordGroups = groups.map(g => ({
  id: g.id,
  words: g.words,
}))
// 提取所有关键词组的关键词，合并为关键词列表
customKeywordsList = groups.flatMap(g => g.words)
```

**文件**：`lib/services/crawler.ts`
```typescript:336:346:lib/services/crawler.ts
// 否则使用关键词组的关键词
keywords = []
for (const group of keywordGroups) {
  keywords.push(...group.words)  // 只使用 words
}
// 去重
keywords = [...new Set(keywords)]
useSearchMode = keywords.length > 0
```

### 2. 关键词匹配（匹配阶段）

**文件**：`lib/services/matcher.ts`
```typescript:115:167:lib/services/matcher.ts
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
```

### 3. 实时匹配应用

**文件**：`lib/services/crawler.ts`
```typescript:536:560:lib/services/crawler.ts
// 实时匹配关键词（如果启用）
if (this.enableRealtimeMatching && this.matcherService && this.calculatorService) {
  try {
    // 获取要匹配的关键词组
    let keywordGroups = await this.matcherService.getEnabledKeywordGroups()
    
    // 如果指定了关键词组ID，只匹配这些组
    if (keywordGroupIds && keywordGroupIds.length > 0) {
      keywordGroups = keywordGroups.filter(g => keywordGroupIds.includes(g.id))
    }

    // 匹配标题
    const matchResult = await this.matcherService.matchTitle(item.title, keywordGroups)
    
    if (matchResult && matchResult.matched && matchResult.keywordGroup) {
      // 创建 NewsMatch 记录
      // ...
    }
  }
}
```

## ⚠️ 重要注意事项

1. **搜索 vs 匹配的区别**：
   - **搜索阶段**：只使用 `words`（普通词）去搜索引擎查询
   - **匹配阶段**：使用 `words` + `requiredWords` + `excludedWords` 进行完整匹配

2. **必须词和过滤词不参与搜索**：
   - 它们只在匹配阶段起作用
   - 如果只配置了必须词/过滤词而没有普通词，搜索阶段会找不到任何结果

3. **优先级的作用**：
   - 匹配时按优先级排序，优先级高的先匹配
   - 一条新闻可能匹配多个关键词组，但会优先使用高优先级的标签

4. **实时匹配 vs 手动匹配**：
   - **实时匹配**：爬取时自动匹配（需要启用 `enableRealtimeMatching`）
   - **手动匹配**：通过 `/api/news/match` 接口手动触发

## 📝 总结

关键词配置规则分为两个阶段：

1. **搜索阶段**：从关键词组中提取 `words`，用于搜索引擎查询
2. **匹配阶段**：使用 `words`（OR）+ `requiredWords`（AND）+ `excludedWords`（排除）进行三层过滤

这种设计允许：
- 搜索时使用较宽泛的关键词，获取更多结果
- 匹配时使用精确的规则，筛选出真正相关的新闻

