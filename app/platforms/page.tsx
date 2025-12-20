"use client"

import { useState, useEffect } from "react"
import { PlatformNewsCard } from "@/components/news/platform-news-card"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { CrawlProgressDialog } from "@/components/crawl/crawl-progress-dialog"
import Link from "next/link"

interface PlatformNews {
  platform: {
    id: string
    platformId: string
    name: string
  }
  items: Array<{
    id: string
    title: string
    url?: string | null
    mobileUrl?: string | null
    content?: string | null
    publishedAt?: string | null
    rank: number
    crawledAt: string
    weight?: number
    keywordGroup?: string | null
  }>
  latestUpdate: string | null
  count: number
}

function CrawlButton() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [showProgress, setShowProgress] = useState(false)

  useEffect(() => {
    if (taskId) {
      setShowProgress(true)
    }
  }, [taskId])

  const handleCrawl = async () => {
    setLoading(true)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

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

      if (!res.ok) {
        throw new Error(`HTTP错误: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()

      if (data.success) {
        const newTaskId = data.data?.taskId
        if (newTaskId) {
          setTaskId(newTaskId)
        } else {
          throw new Error("未获取到taskId")
        }
      } else {
        throw new Error(data.error?.message || "爬取失败")
      }
    } catch (error) {
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
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  const handleDialogClose = (open: boolean) => {
    if (!open && loading) {
      return
    }
    setShowProgress(open)
    if (!open) {
      setLoading(false)
      setTaskId(null)
    }
  }

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

export default function PlatformsPage() {
  const [platformNews, setPlatformNews] = useState<PlatformNews[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const loadPlatformNews = async () => {
    setLoading(true)
    try {
      // 未登录用户使用公开 API
      const apiPath = isAuthenticated ? "/api/news/platforms" : "/api/news/platforms/public"
      const res = await fetch(`${apiPath}?limit=10`)
      const data = await res.json()

      if (data.success) {
        setPlatformNews(data.data || [])
      }
    } catch (error) {
      console.error("Error loading platform news:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlatformNews()
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include", // 确保发送Cookie
      })
      const data = await res.json()
      setIsAuthenticated(data.success)
    } catch (error) {
      setIsAuthenticated(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">多平台热点</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              实时查看各平台最新热点新闻
            </p>
          </div>
          <div className="flex gap-2">
            {isAuthenticated && <CrawlButton />}
            <Button onClick={loadPlatformNews} variant="outline" disabled={loading} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              刷新
            </Button>
            {!isAuthenticated && (
              <Link href="/login">
                <Button size="sm">
                  登录以使用完整功能
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* 平台新闻网格 - 紧凑布局，类似图片效果 */}
        {loading && platformNews.length === 0 ? (
          <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <PlatformNewsCard
                key={i}
                platform={{ id: '', platformId: '', name: '' }}
                items={[]}
                latestUpdate={null}
                loading={true}
              />
            ))}
          </div>
        ) : platformNews.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>暂无平台数据</p>
            <p className="text-sm mt-2">请先运行爬取任务获取数据</p>
          </div>
        ) : (
          <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {platformNews.map((platformData) => (
              <PlatformNewsCard
                key={platformData.platform.id}
                platform={platformData.platform}
                items={platformData.items}
                latestUpdate={platformData.latestUpdate}
                loading={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

