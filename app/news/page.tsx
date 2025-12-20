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
import { CrawlConfigDialog } from "@/components/crawl/crawl-config-dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface NewsItem {
  id: string
  title: string
  url?: string | null
  mobileUrl?: string | null
  content?: string | null
  publishedAt?: string | null
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("crawledAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [platforms, setPlatforms] = useState<any[]>([])
  const [keywordGroups, setKeywordGroups] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<string>("all") // "all" 或关键词组ID
  const [groupStats, setGroupStats] = useState<any[]>([]) // 关键词组统计
  const [totalNewsCount, setTotalNewsCount] = useState<number>(0) // 全量新闻数量
  const [statsLoading, setStatsLoading] = useState(true)
  const [timeFilterType, setTimeFilterType] = useState<"publishedAt" | "crawledAt">("crawledAt") // 时间筛选类型
  const [dateFrom, setDateFrom] = useState<string>("") // 开始日期
  const [dateTo, setDateTo] = useState<string>("") // 结束日期
  const limit = 20
  const { toast } = useToast()

  // 爬取按钮组件
  function CrawlButton() {
    const [crawlLoading, setCrawlLoading] = useState(false)
    const [taskId, setTaskId] = useState<string | null>(null)
    const [showProgress, setShowProgress] = useState(false)
    const [showConfig, setShowConfig] = useState(false)
    const [showCleanupDialog, setShowCleanupDialog] = useState(false)
    // 检查是否已有任务在执行，刷新页面后也能恢复进度弹窗
    useEffect(() => {
      const fetchLatestTask = async () => {
        try {
          const res = await fetch("/api/crawl")
          const data = await res.json()
          if (
            data.success &&
            data.data &&
            (data.data.status === "running" || data.data.status === "pending")
          ) {
            setTaskId(data.data.id)
            setShowProgress(true)
          }
        } catch (error) {
          console.warn("检查爬虫任务状态失败:", error)
        }
      }
      fetchLatestTask()
    }, [])

    const [conflictTask, setConflictTask] = useState<any>(null)
    const [cleanupLoading, setCleanupLoading] = useState(false)

    // 当taskId设置后，自动显示对话框
    useEffect(() => {
      if (taskId) {
        console.log("taskId已设置，显示对话框:", taskId)
        setShowProgress(true)
      }
    }, [taskId])

    const handleCleanupAndRetry = async () => {
      setCleanupLoading(true)
      try {
        const cleanupRes = await fetch("/api/crawl/cleanup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ olderThanMinutes: 5 }), // 清理5分钟前的卡住任务
        })
        const cleanupData = await cleanupRes.json()
        if (cleanupData.success) {
          toast({
            title: "已清理卡住的任务",
            description: `清理了 ${cleanupData.data.cleanedCount} 个任务`,
          })
          setShowCleanupDialog(false)
          setConflictTask(null)
          // 重新打开配置对话框
          setTimeout(() => {
            setShowConfig(true)
          }, 500)
        } else {
          throw new Error(cleanupData.error?.message || "清理失败")
        }
      } catch (cleanupError) {
        console.error("清理任务失败:", cleanupError)
        toast({
          title: "清理失败",
          description: cleanupError instanceof Error ? cleanupError.message : "未知错误",
          variant: "destructive",
        })
      } finally {
        setCleanupLoading(false)
      }
    }

    const handleStartCrawl = async (config: {
      platforms?: string[]
      keywordGroupIds?: string[]
      keywords?: string[]
      enableRealtimeMatching: boolean
      useWebSearch?: boolean
    }) => {
      console.log("开始爬取，配置:", config)
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
          body: JSON.stringify({
            platforms: config.platforms,
            keywordGroupIds: config.keywordGroupIds,
            keywords: config.keywords,
            enableRealtimeMatching: config.enableRealtimeMatching,
          }),
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeoutId)
        })

        console.log("收到响应，状态:", res.status, res.statusText)
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          // 如果是409冲突错误，显示清理对话框
          if (res.status === 409 && errorData.error?.code === 'TASK_RUNNING') {
            setConflictTask(errorData.error.details)
            setShowCleanupDialog(true)
            setCrawlLoading(false)
            return
          }
          throw new Error(errorData.error?.message || `HTTP错误: ${res.status} ${res.statusText}`)
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

    const handlePrimaryAction = () => {
      if (crawlLoading) return
      if (taskId) {
        setShowProgress(true)
        return
      }
      setShowConfig(true)
    }

    return (
      <>
        <Button onClick={handlePrimaryAction} disabled={crawlLoading} variant={taskId ? "secondary" : "default"}>
          <RefreshCw className={`h-4 w-4 mr-2 ${crawlLoading || taskId ? "animate-spin" : ""}`} />
          {crawlLoading
            ? "准备任务..."
            : taskId
            ? "查看进度"
            : "立即爬取"}
        </Button>
        {taskId && (
          <div className="text-xs text-muted-foreground text-right">
            已有爬取任务在执行，点击“查看进度”可随时回到对话框。
          </div>
        )}
        <CrawlConfigDialog
          open={showConfig}
          onOpenChange={setShowConfig}
          onStart={handleStartCrawl}
        />
        {taskId && (
          <CrawlProgressDialog
            open={showProgress}
            onOpenChange={handleDialogClose}
            taskId={taskId}
            onComplete={handleComplete}
          />
        )}
        <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>发现正在进行的爬取任务</AlertDialogTitle>
              <AlertDialogDescription>
                检测到有一个状态为 <strong>{conflictTask?.status || 'unknown'}</strong> 的爬取任务正在进行中。
                {conflictTask?.startedAt && (
                  <span>
                    <br />
                    开始时间: {new Date(conflictTask.startedAt).toLocaleString('zh-CN')}
                  </span>
                )}
                <br />
                <br />
                如果该任务已卡住，您可以清理它并重新开始爬取。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cleanupLoading}>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCleanupAndRetry}
                disabled={cleanupLoading}
              >
                {cleanupLoading ? "清理中..." : "清理并重新开始"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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

  // 加载统计数据（根据时间筛选更新）
  const loadStats = async () => {
    setStatsLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedPlatform !== "all") {
        params.append("platforms", selectedPlatform)
      }
      if (dateFrom) {
        params.append("dateFrom", new Date(dateFrom + "T00:00:00").toISOString())
      }
      if (dateTo) {
        params.append("dateTo", new Date(dateTo + "T23:59:59").toISOString())
      }
      if (timeFilterType) {
        params.append("timeFilterType", timeFilterType)
      }

      const res = await fetch(`/api/news/stats?${params}`)
      const data = await res.json()
      if (data.success) {
        setGroupStats(data.data.keywordGroups || [])
        setTotalNewsCount(data.data.totalNews || 0)
        console.log('[News Page] 统计数据已更新:', {
          totalNews: data.data.totalNews,
          groups: data.data.keywordGroups.length,
        })
      }
    } catch (error) {
      console.error("Error loading stats:", error)
    } finally {
      setStatsLoading(false)
    }
  }

  // 初始加载和当筛选条件改变时重新加载统计
  useEffect(() => {
    loadStats()
  }, [selectedPlatform, dateFrom, dateTo, timeFilterType])

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
        // 如果当前标签不是"all"，使用标签对应的关键词组ID
        ...(activeTab !== "all" && { keywordGroupId: activeTab }),
        // 时间筛选
        ...(timeFilterType && { timeFilterType }),
        ...(dateFrom && { dateFrom: new Date(dateFrom + "T00:00:00").toISOString() }),
        ...(dateTo && { dateTo: new Date(dateTo + "T23:59:59").toISOString() }),
      })

      const res = await fetch(`/api/news?${params}`)
      const data = await res.json()

      if (data.success) {
        setNewsItems(data.data.items || [])
        setTotal(data.data.total || 0)
      } else {
        // API 返回失败，显示错误提示
        console.error("API 返回失败:", data.error)
        toast({
          title: "加载新闻失败",
          description: data.error?.message || "未知错误",
          variant: "destructive",
        })
        setNewsItems([])
        setTotal(0)
      }
    } catch (error) {
      console.error("Error loading news:", error)
      toast({
        title: "加载新闻失败",
        description: error instanceof Error ? error.message : "网络错误",
        variant: "destructive",
      })
      setNewsItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNews()
  }, [page, sortBy, sortOrder, selectedPlatform, activeTab, timeFilterType, dateFrom, dateTo])

  // 当切换标签时，重置到第一页
  useEffect(() => {
    setPage(1)
  }, [activeTab])

  const handleRefresh = async () => {
    // 刷新统计数据
    await loadStats()
    // 刷新新闻列表（跳过缓存）
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString(),
        sortBy,
        sortOrder,
        skipCache: 'true', // 跳过缓存
        ...(selectedPlatform !== "all" && { platforms: selectedPlatform }),
        ...(activeTab !== "all" && { keywordGroupId: activeTab }),
      })

      const res = await fetch(`/api/news?${params}`)
      const data = await res.json()

      if (data.success) {
        setNewsItems(data.data.items || [])
        setTotal(data.data.total || 0)
      } else {
        console.error("API 返回失败:", data.error)
        toast({
          title: "加载新闻失败",
          description: data.error?.message || "未知错误",
          variant: "destructive",
        })
        setNewsItems([])
        setTotal(0)
      }
    } catch (error) {
      console.error("Error loading news:", error)
      toast({
        title: "加载新闻失败",
        description: error instanceof Error ? error.message : "网络错误",
        variant: "destructive",
      })
      setNewsItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const getRankBadgeVariant = (rank: number) => {
    if (rank <= 3) return "success"
    if (rank <= 5) return "warning"
    return "secondary"
  }

  const filteredNews = newsItems.filter((item) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      item.title.toLowerCase().includes(query) ||
      item.content?.toLowerCase().includes(query)
    )
  })
  const formatPublishedTime = (publishedAt?: string | null) => {
    if (!publishedAt) return null
    const date = new Date(publishedAt)
    if (isNaN(date.getTime())) return null
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }


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
          <div className="space-y-4">
            {/* 第一行：搜索和平台筛选 */}
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
            {/* 第二行：时间筛选 */}
            <div className="flex flex-wrap items-center gap-4 border-t pt-4">
              <div className="text-sm text-muted-foreground">时间筛选：</div>
              <Select value={timeFilterType} onValueChange={(value: "publishedAt" | "crawledAt") => setTimeFilterType(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crawledAt">爬取时间</SelectItem>
                  <SelectItem value="publishedAt">发布时间</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0]
                  setDateFrom(today)
                  setDateTo(today)
                }}
              >
                今日
              </Button>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="开始日期"
                className="w-[140px]"
              />
              <span className="text-muted-foreground">至</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="结束日期"
                className="w-[140px]"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFrom("")
                  setDateTo("")
                }}
                disabled={!dateFrom && !dateTo}
              >
                清除时间
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 关键词组标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full gap-2 overflow-x-auto overflow-y-hidden border border-border rounded-full px-2 py-1 bg-background">
          <TabsTrigger
            value="all"
            className="flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            全量结果
            {!statsLoading && (
              <Badge variant="secondary" className="ml-1 bg-white/30 text-white">
                {totalNewsCount}
              </Badge>
            )}
          </TabsTrigger>
          {groupStats.map((stat) => (
            <TabsTrigger
              key={stat.id}
              value={stat.id}
              className="flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 text-sm text-muted-foreground transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              {stat.name}
              <Badge variant="outline" className="ml-1">
                {stat.count}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 全量结果 */}
        <TabsContent value="all" className="mt-4">
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
                        {/* 来源标注 */}
                        <div className="mb-2 text-xs text-muted-foreground">
                          <span>来源：</span>
                          <span className="text-primary">{news.platform.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {news.matches.length > 0 && (
                            <span>权重: {news.matches[0].weight.toFixed(1)}</span>
                          )}
                          {news.matches.length > 0 && (
                            <span>出现次数: {news.matches[0].matchCount}</span>
                          )}
                          {news.publishedAt && (
                            <span>发布时间: {formatPublishedTime(news.publishedAt)}</span>
                          )}
                        </div>
                      {news.content && (
                        <div className="mt-3">
                          <p
                            className={`text-sm text-muted-foreground ${
                              expandedId === news.id
                                ? "whitespace-pre-wrap"
                                : "line-clamp-3 whitespace-pre-line"
                            }`}
                          >
                            {news.content}
                          </p>
                          {news.content.length > 120 && (
                            <button
                              type="button"
                              className="mt-1 text-xs text-primary hover:underline"
                              onClick={() =>
                                setExpandedId(expandedId === news.id ? null : news.id)
                              }
                            >
                              {expandedId === news.id ? "收起正文" : "展开全文"}
                            </button>
                          )}
                        </div>
                      )}
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
                            title="查看原文"
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
        </TabsContent>

        {/* 各关键词组的结果 */}
        {groupStats.map((stat) => (
          <TabsContent key={stat.id} value={stat.id} className="mt-4">
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{stat.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    共 {stat.count} 条匹配新闻
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">平均权重</div>
                  <div className="text-lg font-semibold">{stat.avgWeight.toFixed(1)}</div>
                </div>
              </div>
            </div>
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
                  <p>该关键词组暂无匹配的新闻</p>
                  <Button className="mt-4" onClick={handleRefresh}>
                    刷新数据
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredNews.map((news) => {
                  // 由于API已经通过keywordGroupId过滤，matches应该只包含当前关键词组的匹配
                  // 但为了安全，我们仍然检查一下
                  const match = news.matches.find(m => 
                    m.keywordGroup.name === stat.name || 
                    (news.matches.length === 1 && news.matches[0])
                  ) || news.matches[0]
                  
                  if (!match) return null
                  
                  return (
                    <Card key={news.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant={getRankBadgeVariant(news.rank)}>
                                #{news.rank}
                              </Badge>
                              <Badge variant="secondary">{news.platform.name}</Badge>
                              <Badge variant="outline">
                                {stat.name}
                              </Badge>
                              <Badge variant="default">
                                权重: {match.weight.toFixed(1)}
                              </Badge>
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
                              <span>出现次数: {match.matchCount}</span>
                              {news.matches.length > 1 && (
                                <span className="text-xs text-muted-foreground">
                                  还匹配 {news.matches.length - 1} 个其他关键词组
                                </span>
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
                  )
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

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
