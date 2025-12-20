"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, TrendingDown, Minus, RefreshCw, Calendar } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Ranking {
  rank: number
  demand: string
  frequency: number
  trend?: string
  notes?: string
  category?: string
  keywords: string[]
  createdAt: string
}

interface RankingsData {
  date: string
  rankings: Ranking[]
  total: number
}

export default function DemandRadarPage() {
  const [rankings, setRankings] = useState<RankingsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const { toast } = useToast()

  const fetchRankings = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/demand-radar/rankings")
      const result = await response.json()
      
      if (result.success) {
        setRankings(result.data)
      } else {
        toast({
          title: "获取榜单失败",
          description: result.error?.message || "未知错误",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "获取榜单失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const runTask = async () => {
    setRunning(true)
    try {
      const response = await fetch("/api/demand-radar/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platforms: ["reddit", "producthunt", "hackernews"],
          hoursBack: 24,
          maxResultsPerPlatform: 50,
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        toast({
          title: "任务已启动",
          description: `已抓取 ${result.data.sourcesCount} 条数据源，提取 ${result.data.demandsCount} 个需求`,
        })
        // 等待几秒后刷新榜单
        setTimeout(() => {
          fetchRankings()
        }, 3000)
      } else {
        toast({
          title: "任务执行失败",
          description: result.error?.message || "未知错误",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "任务执行失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    fetchRankings()
  }, [])

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-600" />
      case "new":
        return <Badge variant="outline" className="text-blue-600">新</Badge>
      default:
        return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  const getTrendLabel = (trend?: string) => {
    switch (trend) {
      case "up":
        return "上升"
      case "down":
        return "下降"
      case "new":
        return "新增"
      case "stable":
        return "稳定"
      default:
        return "-"
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">需求雷达</h1>
          <p className="text-muted-foreground mt-2">
            自动捕捉欧美市场缺口，每日更新需求榜单
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchRankings}
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            刷新榜单
          </Button>
          <Button
            onClick={runTask}
            disabled={running}
          >
            {running ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4 mr-2" />
            )}
            {running ? "执行中..." : "执行抓取"}
          </Button>
        </div>
      </div>

      {loading && !rankings ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : rankings && rankings.rankings.length > 0 ? (
        <>
          {/* 统计信息 */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {rankings.total}
                  </div>
                  <div className="text-sm text-muted-foreground">今日需求数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {rankings.rankings.filter(r => r.trend === "up" || r.trend === "new").length}
                  </div>
                  <div className="text-sm text-muted-foreground">上升/新增</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {rankings.date}
                  </div>
                  <div className="text-sm text-muted-foreground">榜单日期</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 需求榜单 */}
          <Card>
            <CardHeader>
              <CardTitle>今日需求榜单（Top 20）</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rankings.rankings.map((item) => (
                  <Card key={item.rank} className="border-muted">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-lg font-bold text-primary">
                            {item.rank}
                          </span>
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg mb-1">
                                {item.demand}
                              </h3>
                              <div className="flex items-center gap-2 flex-wrap">
                                {item.category && (
                                  <Badge variant="secondary">
                                    {item.category}
                                  </Badge>
                                )}
                                <Badge variant="outline">
                                  频次: {item.frequency}
                                </Badge>
                                <div className="flex items-center gap-1">
                                  {getTrendIcon(item.trend)}
                                  <span className="text-sm text-muted-foreground">
                                    {getTrendLabel(item.trend)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          {item.notes && (
                            <p className="text-sm text-muted-foreground">
                              备注: {item.notes}
                            </p>
                          )}
                          {item.keywords && item.keywords.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">关键词:</span>
                              {item.keywords.slice(0, 5).map((keyword, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {keyword}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                暂无需求榜单数据
              </p>
              <Button onClick={runTask} disabled={running}>
                {running ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4 mr-2" />
                )}
                {running ? "执行中..." : "执行首次抓取"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

