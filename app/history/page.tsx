"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Calendar, Search } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export default function HistoryPage() {
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [dates, setDates] = useState<any[]>([])
  const [selectedDateNews, setSelectedDateNews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    // 设置默认选中今天
    const today = new Date().toISOString().split("T")[0]
    setSelectedDate(today)
    loadHistoryData()
  }, [])

  useEffect(() => {
    if (selectedDate) {
      loadNewsForDate(selectedDate)
    }
  }, [selectedDate])

  const loadHistoryData = async () => {
    setLoading(true)
    try {
      // 生成最近30天的日期列表
      const dateList = []
      const today = new Date()
      for (let i = 0; i < 30; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split("T")[0]

        // 查询该日期的新闻数量
        const dateFrom = new Date(dateStr + "T00:00:00")
        const dateTo = new Date(dateStr + "T23:59:59")

        const res = await fetch(
          `/api/news?dateFrom=${dateFrom.toISOString()}&dateTo=${dateTo.toISOString()}&limit=1`
        )
        const data = await res.json()

        dateList.push({
          date: dateStr,
          count: data.success ? data.data.total : 0,
        })
      }

      setDates(dateList)
    } catch (error) {
      console.error("Error loading history:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadNewsForDate = async (date: string) => {
    try {
      const dateFrom = new Date(date + "T00:00:00")
      const dateTo = new Date(date + "T23:59:59")

      const res = await fetch(
        `/api/news?dateFrom=${dateFrom.toISOString()}&dateTo=${dateTo.toISOString()}&limit=50&sortBy=crawledAt&sortOrder=desc`
      )
      const data = await res.json()

      if (data.success) {
        setSelectedDateNews(data.data.items || [])
      }
    } catch (error) {
      console.error("Error loading news for date:", error)
    }
  }

  const filteredNews = selectedDateNews.filter((news) => {
    if (!searchQuery) return true
    return news.title.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">历史查询</h1>
          <p className="text-muted-foreground mt-1">
            查看历史新闻数据
          </p>
        </div>
        <Button variant="outline">
          <Calendar className="h-4 w-4 mr-2" />
          选择日期
        </Button>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="搜索新闻..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {/* 日期列表 */}
        <Card>
          <CardHeader>
            <CardTitle>日期列表</CardTitle>
            <CardDescription>选择日期查看新闻</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {dates.map((item) => (
                  <div
                    key={item.date}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedDate === item.date
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    }`}
                    onClick={() => setSelectedDate(item.date)}
                  >
                    <div>
                      <div className="font-medium">
                        {formatDate(new Date(item.date + "T00:00:00"))}
                      </div>
                      <div className="text-sm opacity-80">
                        {item.count} 条新闻
                      </div>
                    </div>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 选中日期的新闻列表 */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedDate
                ? formatDate(new Date(selectedDate + "T00:00:00"))
                : "选择日期"}
            </CardTitle>
            <CardDescription>
              共 {filteredNews.length} 条匹配新闻
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : filteredNews.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>该日期暂无新闻数据</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {filteredNews.map((news) => (
                  <div
                    key={news.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-1">
                      <a
                        href={`/news/${news.id}`}
                        className="font-medium mb-2 hover:text-primary cursor-pointer block"
                      >
                        {news.title}
                      </a>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {news.platform?.name || "未知平台"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(new Date(news.crawledAt))}
                        </span>
                        {news.matches?.[0] && (
                          <Badge variant="outline">
                            权重: {news.matches[0].weight?.toFixed(1) || "0"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/news/${news.id}`}>查看详情</a>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
