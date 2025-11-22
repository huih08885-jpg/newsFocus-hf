"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, Download } from "lucide-react"
import { TrendChart } from "@/components/charts/trend-chart"
import { KeywordBarChart } from "@/components/charts/bar-chart"
import { Skeleton } from "@/components/ui/skeleton"

export default function TrendsPage() {
  const [keywordGroupId, setKeywordGroupId] = useState<string>("")
  const [keywordGroups, setKeywordGroups] = useState<any[]>([])
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [granularity, setGranularity] = useState<string>("day")
  const [trendsData, setTrendsData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

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

  // 加载趋势数据
  const loadTrends = async () => {
    if (!keywordGroupId) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        keywordGroupId,
        granularity,
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      })

      const res = await fetch(`/api/analytics/trends?${params}`)
      const data = await res.json()

      if (data.success) {
        setTrendsData(data.data)
      }
    } catch (error) {
      console.error("Error loading trends:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (keywordGroupId) {
      loadTrends()
    }
  }, [keywordGroupId, dateFrom, dateTo, granularity])

  // 设置默认日期范围（最近7天）
  useEffect(() => {
    const today = new Date()
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)

    setDateTo(today.toISOString().split("T")[0])
    setDateFrom(weekAgo.toISOString().split("T")[0])
  }, [])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">趋势分析</h1>
          <p className="text-muted-foreground mt-1">
            深度分析关键词组的趋势变化
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          导出数据
        </Button>
      </div>

      {/* 筛选条件 */}
      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>关键词组</Label>
              <Select value={keywordGroupId} onValueChange={setKeywordGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择关键词组" />
                </SelectTrigger>
                <SelectContent>
                  {keywordGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name || "未命名"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>开始日期</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>结束日期</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>时间粒度</Label>
              <Select value={granularity} onValueChange={setGranularity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hour">按小时</SelectItem>
                  <SelectItem value="day">按天</SelectItem>
                  <SelectItem value="week">按周</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 趋势图表 */}
      {loading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      ) : trendsData ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>趋势对比图</CardTitle>
              <CardDescription>
                {trendsData.keywordGroup?.name || "未命名"} 的趋势变化
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <TrendChart
                  data={trendsData.trends.map((t: any) => ({
                    date: t.date,
                    count: t.count,
                    avgWeight: t.avgWeight,
                  }))}
                  dataKey="count"
                />
              </div>
            </CardContent>
          </Card>

          {/* 趋势数据表格 */}
          <Card>
            <CardHeader>
              <CardTitle>趋势数据</CardTitle>
              <CardDescription>详细数据表格</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">日期</th>
                      <th className="text-right p-2">数量</th>
                      <th className="text-right p-2">平均权重</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendsData.trends.map((trend: any, index: number) => (
                      <tr key={index} className="border-b hover:bg-accent">
                        <td className="p-2">{trend.date}</td>
                        <td className="text-right p-2">{trend.count}</td>
                        <td className="text-right p-2">
                          {trend.avgWeight.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            请选择关键词组查看趋势分析
          </CardContent>
        </Card>
      )}
    </div>
  )
}

