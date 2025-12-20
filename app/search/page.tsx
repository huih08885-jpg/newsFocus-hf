"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { formatRelativeTime } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { CollectButton } from "@/components/news/collect-button"
import { ExternalLink, Search as SearchIcon } from "lucide-react"
import { SearchBox } from "@/components/search/search-box"
import { useToast } from "@/hooks/use-toast"

interface SearchResultItem {
  id: string
  title: string
  url: string | null
  mobileUrl: string | null
  platformId: string
  platformName: string
  rank: number
  crawledAt: string
  sentiment: string | null
  sentimentScore: number | null
  keywordGroup: string | null
  weight: number
  relevanceScore: number
  highlights: string[]
}

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [limit] = useState(20)
  const [offset, setOffset] = useState(0)
  const [sortBy, setSortBy] = useState<"relevance" | "crawledAt" | "weight" | "rank">("relevance")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const query = searchParams.get("q") || ""

  useEffect(() => {
    if (query) {
      performSearch()
    }
  }, [query, sortBy, sortOrder])

  const performSearch = async (newOffset = 0) => {
    if (!query.trim()) {
      setResults([])
      setTotal(0)
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
        offset: newOffset.toString(),
        sortBy,
        sortOrder,
      })

      const res = await fetch(`/api/search?${params.toString()}`)
      const data = await res.json()

      if (data.success) {
        if (newOffset === 0) {
          setResults(data.data.items)
        } else {
          setResults([...results, ...data.data.items])
        }
        setTotal(data.data.total)
        setOffset(newOffset + data.data.items.length)
      } else {
        toast({
          title: "搜索失败",
          description: data.error?.message || "请稍后重试",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error searching:", error)
      toast({
        title: "搜索失败",
        description: "网络错误，请稍后重试",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLoadMore = () => {
    performSearch(offset)
  }

  const handleSortChange = (value: string) => {
    const [newSortBy, newSortOrder] = value.split("-")
    setSortBy(newSortBy as typeof sortBy)
    setSortOrder(newSortOrder as typeof sortOrder)
    setOffset(0)
  }

  const handleClick = async (newsId: string) => {
    try {
      await fetch(`/api/news/${newsId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "click" }),
      })
    } catch (error) {
      // 忽略行为记录错误
    }
  }

  if (!query) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>搜索新闻</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-2xl mx-auto py-12">
              <SearchBox
                className="w-full"
                placeholder="输入关键词搜索新闻..."
                autoFocus
              />
              <p className="text-center text-sm text-muted-foreground mt-4">
                支持搜索新闻标题，支持多关键词搜索
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <SearchBox
          className="max-w-2xl"
          placeholder="搜索新闻..."
          showSuggestions={true}
        />
      </div>

      {loading && results.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>搜索结果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>搜索结果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <SearchIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">未找到相关结果</p>
              <p className="text-sm">请尝试使用其他关键词搜索</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              找到 {total} 条结果
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={`${sortBy}-${sortOrder}`}
                onValueChange={handleSortChange}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance-desc">相关性</SelectItem>
                  <SelectItem value="crawledAt-desc">最新</SelectItem>
                  <SelectItem value="crawledAt-asc">最旧</SelectItem>
                  <SelectItem value="weight-desc">权重最高</SelectItem>
                  <SelectItem value="rank-asc">排名最高</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            {results.map((item) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/news/${item.id}`}
                        onClick={() => handleClick(item.id)}
                        className="block"
                      >
                        <h3 className="text-lg font-semibold mb-2 line-clamp-2 hover:text-primary transition-colors">
                          {item.title}
                        </h3>
                      </Link>
                      {item.highlights.length > 0 && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                          {item.highlights[0]}
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{item.platformName}</Badge>
                        <span className="text-xs text-muted-foreground">
                          排名 #{item.rank}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(item.crawledAt)}
                        </span>
                        {item.sentiment && (
                          <Badge
                            variant={
                              item.sentiment === "positive"
                                ? "success"
                                : item.sentiment === "negative"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {item.sentiment === "positive"
                              ? "积极"
                              : item.sentiment === "negative"
                              ? "负面"
                              : "中性"}
                          </Badge>
                        )}
                        {item.keywordGroup && (
                          <Badge variant="outline" className="text-xs">
                            {item.keywordGroup}
                          </Badge>
                        )}
                        {item.relevanceScore > 0 && (
                          <Badge variant="outline" className="text-xs">
                            相关性: {item.relevanceScore.toFixed(0)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleClick(item.id)}
                        >
                          <Button size="sm" variant="outline">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            打开
                          </Button>
                        </a>
                      )}
                      <CollectButton newsId={item.id} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {offset < total && (
            <div className="mt-6 text-center">
              <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
                {loading ? "加载中..." : "加载更多"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

