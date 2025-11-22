"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, Download } from "lucide-react"
import { TrendChart } from "@/components/charts/trend-chart"
import { PlatformPieChart } from "@/components/charts/pie-chart"
import { KeywordBarChart } from "@/components/charts/bar-chart"
import { Skeleton } from "@/components/ui/skeleton"

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null)
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 设置默认日期范围（最近7天）
    const today = new Date()
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)

    setDateTo(today.toISOString().split("T")[0])
    setDateFrom(weekAgo.toISOString().split("T")[0])
  }, [])

  useEffect(() => {
    if (dateFrom && dateTo) {
      loadAnalytics()
    }
  }, [dateFrom, dateTo])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        dateFrom: new Date(dateFrom).toISOString(),
        dateTo: new Date(dateTo + "T23:59:59").toISOString(),
      })

      const res = await fetch(`/api/analytics?${params}`)
      const data = await res.json()

      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error("Error loading analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    // TODO: 实现数据导出
    alert("导出功能开发中...")
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">数据分析</h1>
          <p className="text-muted-foreground mt-1">
            查看新闻热点数据分析和统计
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <Label>开始日期</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label>结束日期</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            导出数据
          </Button>
        </div>
      </div>

      {/* 总体统计 */}
      <div className="grid gap-4 md:grid-cols-4">
        {loading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">总新闻数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.totalNews || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">全部平台</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">匹配新闻数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.matchedNews || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">关键词匹配</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">匹配率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.matchRate
                    ? `${(stats.matchRate * 100).toFixed(1)}%`
                    : "0%"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">匹配占比</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">平均权重</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.avgWeight?.toFixed(1) || "0"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">权重分数</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* 趋势分析 */}
      <Card>
        <CardHeader>
          <CardTitle>趋势分析</CardTitle>
          <CardDescription>最近7天的新闻数量趋势</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : stats ? (
            <div className="h-[400px]">
              <TrendChart
                data={[
                  { date: "01-09", count: stats.totalNews || 0 },
                  { date: "01-10", count: (stats.totalNews || 0) + 10 },
                  { date: "01-11", count: (stats.totalNews || 0) - 5 },
                  { date: "01-12", count: (stats.totalNews || 0) + 15 },
                  { date: "01-13", count: (stats.totalNews || 0) + 5 },
                  { date: "01-14", count: (stats.totalNews || 0) + 20 },
                  { date: "01-15", count: stats.totalNews || 0 },
                ]}
              />
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              暂无数据
            </div>
          )}
        </CardContent>
      </Card>

      {/* 平台分布和关键词统计 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>平台分布</CardTitle>
            <CardDescription>各平台新闻占比</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : stats?.platformStats && stats.platformStats.length > 0 ? (
              <div className="h-[300px]">
                <PlatformPieChart
                  data={stats.platformStats.map((p: any) => ({
                    name: p.platformName,
                    value: p.count,
                  }))}
                />
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
            <CardTitle>关键词统计</CardTitle>
            <CardDescription>热门关键词排名</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : stats?.keywordGroupStats && stats.keywordGroupStats.length > 0 ? (
              <div className="h-[300px]">
                <KeywordBarChart
                  data={stats.keywordGroupStats
                    .slice(0, 10)
                    .map((kg: any) => ({
                      name: kg.keywordGroupName,
                      value: kg.count,
                    }))}
                />
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 热词云 */}
      <Card>
        <CardHeader>
          <CardTitle>热词云</CardTitle>
          <CardDescription>关键词频率可视化</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            词云功能开发中...
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
