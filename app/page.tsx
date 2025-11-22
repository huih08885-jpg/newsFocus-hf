"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Newspaper, TrendingUp, PlusCircle, Activity, RefreshCw } from "lucide-react"
import Link from "next/link"
import { TrendChart } from "@/components/charts/trend-chart"
import { PlatformPieChart } from "@/components/charts/pie-chart"
import { Skeleton } from "@/components/ui/skeleton"
import { formatRelativeTime } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { CrawlProgressDialog } from "@/components/crawl/crawl-progress-dialog"

function CrawlButton() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
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
    setLoading(true)
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
      setLoading(false)
      setTaskId(null)
    }
  }

  const handleComplete = () => {
    setShowProgress(false)
    setLoading(false)
    setTaskId(null)
    // 刷新页面数据
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  const handleDialogClose = (open: boolean) => {
    if (!open && loading) {
      // 如果正在爬取，不允许关闭
      return
    }
    setShowProgress(open)
    if (!open) {
      setLoading(false)
      setTaskId(null)
    }
  }

  console.log("CrawlButton渲染:", { taskId, showProgress, loading })

  return (
    <>
      <Button onClick={handleCrawl} disabled={loading} variant="outline">
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
        {loading ? "爬取中..." : "立即爬取"}
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

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [recentNews, setRecentNews] = useState<any[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [platformData, setPlatformData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // 加载统计数据
      const statsRes = await fetch("/api/analytics")
      const statsData = await statsRes.json()

      if (statsData.success) {
        setStats(statsData.data)
      }

      // 加载最新新闻
      const newsRes = await fetch("/api/news?limit=5&sortBy=weight&sortOrder=desc")
      const newsData = await newsRes.json()

      if (newsData.success) {
        setRecentNews(newsData.data.items || [])
      }

      // 加载趋势数据（最近7天）
      const dateTo = new Date()
      const dateFrom = new Date()
      dateFrom.setDate(dateFrom.getDate() - 7)

      const trendsRes = await fetch(
        `/api/analytics?dateFrom=${dateFrom.toISOString()}&dateTo=${dateTo.toISOString()}`
      )
      const trendsData = await trendsRes.json()

      if (trendsData.success) {
        // 生成趋势图表数据
        const trendChartData = generateTrendChartData(trendsData.data)
        setTrendData(trendChartData)
      }

      // 设置平台分布数据
      if (statsData.success && statsData.data.platformStats) {
        setPlatformData(
          statsData.data.platformStats.map((p: any) => ({
            name: p.platformName,
            value: p.count,
          }))
        )
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const generateTrendChartData = (data: any) => {
    // 这里简化处理，实际应该从API获取按日期分组的数据
    const dates = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      dates.push({
        date: `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        count: Math.floor(Math.random() * 50) + 100, // 示例数据
      })
    }
    return dates
  }

  const statCards = [
    {
      title: "今日新闻",
      value: stats?.totalNews || 0,
      change: "+12%",
      icon: Newspaper,
      description: "全部平台",
    },
    {
      title: "匹配新闻",
      value: stats?.matchedNews || 0,
      change: "+8%",
      icon: TrendingUp,
      description: "关键词匹配",
    },
    {
      title: "匹配率",
      value: stats?.matchRate
        ? `${(stats.matchRate * 100).toFixed(1)}%`
        : "0%",
      change: "+5%",
      icon: PlusCircle,
      description: "匹配占比",
    },
    {
      title: "平均权重",
      value: stats?.avgWeight?.toFixed(1) || "0",
      change: "+2.5",
      icon: Activity,
      description: "权重分数",
    },
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">仪表板</h1>
          <p className="text-muted-foreground mt-1">
            欢迎回来，这里是您的新闻热点概览
          </p>
        </div>
        <div className="flex gap-2">
          <CrawlButton />
          <Link href="/news">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
              查看全部新闻
            </button>
          </Link>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return loading ? (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ) : (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <span className={stat.change.startsWith("+") ? "text-green-600" : "text-gray-600"}>
                    {stat.change}
                  </span>
                  <span>{stat.description}</span>
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 图表区域 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>趋势分析</CardTitle>
            <CardDescription>最近7天的新闻数量趋势</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : trendData.length > 0 ? (
              <div className="h-[300px]">
                <TrendChart data={trendData} />
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>平台分布</CardTitle>
            <CardDescription>各平台新闻占比</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : platformData.length > 0 ? (
              <div className="h-[300px]">
                <PlatformPieChart data={platformData} />
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 最新新闻 */}
      <Card>
        <CardHeader>
          <CardTitle>最新匹配新闻</CardTitle>
          <CardDescription>最近匹配到的热点新闻</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : recentNews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>暂无新闻数据</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentNews.map((news) => (
                <div
                  key={news.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex-1">
                    <Link href={`/news/${news.id}`}>
                      <h3 className="font-medium hover:text-primary cursor-pointer">
                        {news.title}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary">{news.platform.name}</Badge>
                      {news.matches?.[0] && (
                        <Badge variant="outline">
                          {news.matches[0].keywordGroup?.name || "未命名"}
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {formatRelativeTime(news.crawledAt)}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    {news.matches?.[0] && (
                      <Badge variant="success" className="text-xs">
                        权重: {news.matches[0].weight?.toFixed(1) || "0"}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 text-center">
            <Link href="/news">
              <button className="text-sm text-primary hover:underline">
                查看更多 →
              </button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
