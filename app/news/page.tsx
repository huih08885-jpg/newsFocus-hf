"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, RefreshCw } from "lucide-react"
import Link from "next/link"
import { formatRelativeTime } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { CrawlProgressDialog } from "@/components/crawl/crawl-progress-dialog"

interface NewsItem {
  id: string
  title: string
  url?: string | null
  mobileUrl?: string | null
  rank: number
  crawledAt: string
  platform: {
    name: string
    platformId: string
  }
  matches: Array<{
    keywordGroup: {
      name?: string | null
    }
    weight: number
    matchCount: number
  }>
}

export default function NewsListPage() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all")
  const [selectedKeywordGroup, setSelectedKeywordGroup] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("crawledAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [platforms, setPlatforms] = useState<any[]>([])
  const [keywordGroups, setKeywordGroups] = useState<any[]>([])
  const limit = 20
  const { toast } = useToast()

  // 爬取按钮组件
  function CrawlButton() {
    const [crawlLoading, setCrawlLoading] = useState(false)
    const [taskId, setTaskId] = useState<string | null>(null)
    const [showProgress, setShowProgress] = useState(false)

    // 当taskId设置后，自动显示对话框
    useEffect(() => {
      if (taskId) {
        console.log("taskId已设置，显示对话框:", taskId)
        setShowProgress(true)
      }
    }, [taskId])

    const handleCrawl = async () => {
      console.log("开始爬取...")
      setCrawlLoading(true)
      try {
        console.log("发送爬取请求...")
        
        // 添加超时处理
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时
        
        const res = await fetch("/api/crawl", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeoutId)
        })

        console.log("收到响应，状态:", res.status, res.statusText)
        
        if (!res.ok) {
          throw new Error(`HTTP错误: ${res.status} ${res.statusText}`)
        }
        
        const data = await res.json()
        console.log("响应数据:", data)

        if (data.success) {
          const newTaskId = data.data?.taskId
          console.log("获取到taskId:", newTaskId)
          if (newTaskId) {
            setTaskId(newTaskId)
          } else {
            throw new Error("未获取到taskId")
          }
        } else {
          console.error("API返回失败:", data)
          throw new Error(data.error?.message || "爬取失败")
        }
      } catch (error) {
        console.error("爬取错误:", error)
        toast({
          title: "爬取失败",
          description: error instanceof Error ? error.message : "未知错误",
          variant: "destructive",
        })
        setShowProgress(false)
        setCrawlLoading(false)
        setTaskId(null)
      }
    }

    const handleComplete = () => {
      setShowProgress(false)
      setCrawlLoading(false)
      setTaskId(null)
      // 刷新列表
      loadNews()
    }

    const handleDialogClose = (open: boolean) => {
      if (!open && crawlLoading) {
        // 如果正在爬取，不允许关闭
        return
      }
      setShowProgress(open)
      if (!open) {
        setCrawlLoading(false)
        setTaskId(null)
      }
    }

    console.log("CrawlButton渲染:", { taskId, showProgress, crawlLoading })

    return (
      <>
        <Button onClick={handleCrawl} disabled={crawlLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${crawlLoading ? "animate-spin" : ""}`} />
          {crawlLoading ? "爬取中..." : "立即爬取"}
        </Button>
        {taskId && (
          <CrawlProgressDialog
            open={showProgress}
            onOpenChange={handleDialogClose}
            taskId={taskId}
            onComplete={handleComplete}
          />
        )}
      </>
    )
  }

  // 加载平台列表
  useEffect(() => {
    fetch("/api/config/platforms")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPlatforms(data.data.items || [])
        }
      })
  }, [])

  // 加载关键词组列表
  useEffect(() => {
    fetch("/api/config/keywords")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setKeywordGroups(data.data.items || [])
        }
      })
  }, [])

  // 加载新闻列表
  const loadNews = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString(),
        sortBy,
        sortOrder,
        ...(selectedPlatform !== "all" && { platforms: selectedPlatform }),
        ...(selectedKeywordGroup !== "all" && { keywordGroupId: selectedKeywordGroup }),
      })

      const res = await fetch(`/api/news?${params}`)
      const data = await res.json()

      if (data.success) {
        setNewsItems(data.data.items || [])
        setTotal(data.data.total || 0)
      }
    } catch (error) {
      console.error("Error loading news:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNews()
  }, [page, sortBy, sortOrder, selectedPlatform, selectedKeywordGroup])

  const handleRefresh = () => {
    loadNews()
  }

  const getRankBadgeVariant = (rank: number) => {
    if (rank <= 3) return "success"
    if (rank <= 5) return "warning"
    return "secondary"
  }

  const filteredNews = newsItems.filter((item) => {
    if (!searchQuery) return true
    return item.title.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">新闻列表</h1>
          <p className="text-muted-foreground mt-1">
            查看所有匹配的新闻热点
          </p>
        </div>
        <div className="flex gap-2">
          <CrawlButton />
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新列表
          </Button>
        </div>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="搜索新闻标题..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="平台" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部平台</SelectItem>
                {platforms.map((platform) => (
                  <SelectItem key={platform.id} value={platform.platformId}>
                    {platform.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedKeywordGroup} onValueChange={setSelectedKeywordGroup}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="关键词组" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部词组</SelectItem>
                {keywordGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name || "未命名"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="crawledAt">时间</SelectItem>
                <SelectItem value="rank">排名</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            >
              {sortOrder === "desc" ? "↓" : "↑"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 新闻列表 */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredNews.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <p>暂无新闻数据</p>
            <Button className="mt-4" onClick={handleRefresh}>
              刷新数据
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredNews.map((news) => (
            <Card key={news.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant={getRankBadgeVariant(news.rank)}>
                        #{news.rank}
                      </Badge>
                      <Badge variant="secondary">{news.platform.name}</Badge>
                      {news.matches.map((match, idx) => (
                        <Badge key={idx} variant="outline">
                          {match.keywordGroup.name || "未命名"}
                        </Badge>
                      ))}
                      <span className="text-sm text-muted-foreground">
                        {formatRelativeTime(news.crawledAt)}
                      </span>
                    </div>
                    <Link href={`/news/${news.id}`}>
                      <h2 className="text-lg font-semibold hover:text-primary cursor-pointer mb-2">
                        {news.title}
                      </h2>
                    </Link>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {news.matches.length > 0 && (
                        <span>权重: {news.matches[0].weight.toFixed(1)}</span>
                      )}
                      {news.matches.length > 0 && (
                        <span>出现次数: {news.matches[0].matchCount}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link href={`/news/${news.id}`}>
                      <Button variant="outline" size="sm">
                        查看详情
                      </Button>
                    </Link>
                    {news.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(news.url!, "_blank")}
                      >
                        打开链接
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (page <= 3) {
                pageNum = i + 1
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? "default" : "outline"}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>
          <Button
            variant="outline"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
          <span className="text-sm text-muted-foreground ml-4">
            共 {total} 条，第 {page} / {totalPages} 页
          </span>
        </div>
      )}
    </div>
  )
}
