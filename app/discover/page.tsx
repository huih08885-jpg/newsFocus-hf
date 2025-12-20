"use client"

import { useState, useEffect } from "react"
import { UnifiedSearchPanel } from "@/components/search/unified-search-panel"

interface KeywordGroupOption {
  id: string
  name?: string | null
}

export default function DiscoverPage() {
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroupOption[]>([])

  useEffect(() => {
    // 获取关键词组列表
    const fetchKeywordGroups = async () => {
      try {
        const res = await fetch("/api/config/keywords")
        const data = await res.json()
        if (data.success && data.data?.items) {
          setKeywordGroups(data.data.items)
        }
      } catch (error) {
        console.error("获取关键词组失败:", error)
      }
    }
    fetchKeywordGroups()
  }, [])

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">发现新站点</h1>
        <p className="text-muted-foreground mt-2">
          使用搜索引擎发现新的新闻站点，自动推断配置，一键添加到关键词组
        </p>
      </div>
      <UnifiedSearchPanel keywordGroups={keywordGroups} />
    </div>
  )
}

