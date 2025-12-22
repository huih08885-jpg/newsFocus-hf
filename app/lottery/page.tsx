"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, RefreshCw, Calendar, Search, Clock, Upload } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface LotteryResult {
  id: string
  period: string
  date: string
  redBalls: string[]
  blueBall: string
  url?: string
}

export default function LotteryPage() {
  const [results, setResults] = useState<LotteryResult[]>([])
  const [allResults, setAllResults] = useState<LotteryResult[]>([])
  const [loading, setLoading] = useState(false)
  const [crawling, setCrawling] = useState(false)
  const [total, setTotal] = useState(0)
  const [searchPeriod, setSearchPeriod] = useState("")
  const [showTimeRangeDialog, setShowTimeRangeDialog] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importing, setImporting] = useState(false)
  const { toast } = useToast()

  const fetchResults = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/lottery/crawl?limit=100")
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const result = await response.json()
      
      if (result.success) {
        // 确保数据格式正确
        const formattedResults = (result.data.results || []).map((item: any) => ({
          id: item.id || item.period,
          period: item.period,
          date: item.date,
          redBalls: Array.isArray(item.redBalls) ? item.redBalls : [],
          blueBall: item.blueBall || '',
          url: item.url,
        }))
        setAllResults(formattedResults)
        setResults(formattedResults)
        setTotal(result.data.total || formattedResults.length)
      } else {
        toast({
          title: "获取开奖结果失败",
          description: result.error || "未知错误",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('获取开奖结果失败:', error)
      toast({
        title: "获取开奖结果失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // 最新爬取
  const startLatestCrawl = async () => {
    setCrawling(true)
    
    try {
      const response = await fetch("/api/lottery/crawl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "latest",
          maxPages: 1000,
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        const saved = result.data.saved || 0
        const existing = result.data.existing || 0
        const skipped = result.data.skipped || 0
        let description = `新保存 ${saved} 条开奖结果`
        if (existing > 0) {
          description += `，已存在 ${existing} 条`
        }
        if (skipped > 0) {
          description += `，跳过 ${skipped} 条`
        }
        toast({
          title: "最新爬取已完成",
          description: description,
        })
        // 等待几秒后刷新列表
        setTimeout(() => {
          fetchResults()
        }, 3000)
      } else {
        toast({
          title: "最新爬取失败",
          description: result.error || "未知错误",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "最新爬取失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setCrawling(false)
    }
  }

  // 按时间区间爬取
  const startTimeRangeCrawl = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "请选择时间段",
        description: "开始日期和结束日期都不能为空",
        variant: "destructive",
      })
      return
    }

    setCrawling(true)
    setShowTimeRangeDialog(false)
    
    try {
      const response = await fetch("/api/lottery/crawl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "custom",
          startDate: startDate,
          endDate: endDate,
          maxPages: 1000,
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        const saved = result.data.saved || 0
        const existing = result.data.existing || 0
        const skipped = result.data.skipped || 0
        let description = `新保存 ${saved} 条开奖结果`
        if (existing > 0) {
          description += `，已存在 ${existing} 条`
        }
        if (skipped > 0) {
          description += `，跳过 ${skipped} 条`
        }
        toast({
          title: "时间区间爬取已完成",
          description: description,
        })
        // 等待几秒后刷新列表
        setTimeout(() => {
          fetchResults()
        }, 3000)
      } else {
        toast({
          title: "时间区间爬取失败",
          description: result.error || "未知错误",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "时间区间爬取失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setCrawling(false)
    }
  }

  useEffect(() => {
    fetchResults()
  }, [])

  // 搜索功能
  useEffect(() => {
    if (!searchPeriod.trim()) {
      setResults(allResults)
      return
    }

    const filtered = allResults.filter(item =>
      item.period.includes(searchPeriod.trim())
    )
    setResults(filtered)
  }, [searchPeriod, allResults])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">fcyc</h1>
          <p className="text-muted-foreground mt-2">
            fcyc
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchResults}
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            刷新列表
          </Button>
          <Button
            onClick={() => setShowImportDialog(true)}
            disabled={importing}
            variant="outline"
          >
            <Upload className="h-4 w-4 mr-2" />
            导入历史结果
          </Button>
          <Button
            onClick={startLatestCrawl}
            disabled={crawling}
            variant="default"
          >
            {crawling ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4 mr-2" />
            )}
            {crawling ? "爬取中..." : "最新爬取"}
          </Button>
          <Button
            onClick={() => setShowTimeRangeDialog(true)}
            disabled={crawling}
            variant="outline"
          >
            <Clock className="h-4 w-4 mr-2" />
            按时间区间查询
          </Button>
        </div>
      </div>

      {/* 统计信息和搜索 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {total}
              </div>
              <div className="text-sm text-muted-foreground">总记录数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {results.length}
              </div>
              <div className="text-sm text-muted-foreground">当前显示</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {results.length > 0 ? new Date(results[0].date).toLocaleDateString('zh-CN') : '-'}
              </div>
              <div className="text-sm text-muted-foreground">最新开奖日期</div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索期号..."
                value={searchPeriod}
                onChange={(e) => setSearchPeriod(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 开奖结果列表 */}
      {loading && results.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : results.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>开奖结果列表</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((item) => (
                <Card key={item.id} className="border-muted">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">
                            期号: {item.period}
                          </h3>
                          <Badge variant="outline">
                            {new Date(item.date).toLocaleDateString('zh-CN')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-muted-foreground font-medium">红球:</span>
                          {item.redBalls && item.redBalls.length > 0 ? (
                            item.redBalls.map((ball, idx) => (
                              <div
                                key={idx}
                                className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center font-bold shadow-md"
                                title={`红球 ${ball}`}
                              >
                                {ball.padStart(2, '0')}
                              </div>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">暂无数据</span>
                          )}
                          <span className="text-sm text-muted-foreground font-medium ml-2">蓝球:</span>
                          {item.blueBall ? (
                            <div 
                              className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold shadow-md"
                              title={`蓝球 ${item.blueBall}`}
                            >
                              {item.blueBall.padStart(2, '0')}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">暂无数据</span>
                          )}
                        </div>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            查看详情 →
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                暂无开奖结果数据
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={startLatestCrawl} disabled={crawling}>
                  {crawling ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Calendar className="h-4 w-4 mr-2" />
                  )}
                  {crawling ? "爬取中..." : "最新爬取"}
                </Button>
                <Button onClick={() => setShowTimeRangeDialog(true)} disabled={crawling} variant="outline">
                  <Clock className="h-4 w-4 mr-2" />
                  按时间区间查询
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 时间区间查询对话框 */}
      <Dialog open={showTimeRangeDialog} onOpenChange={setShowTimeRangeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>按时间区间查询</DialogTitle>
            <DialogDescription>
              选择要爬取的时间范围
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">开始日期</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate || new Date().toISOString().split('T')[0]}
              />
              <p className="text-sm text-muted-foreground">
                选择要爬取的最早日期
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">结束日期</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                min={startDate}
              />
              <p className="text-sm text-muted-foreground">
                选择要爬取的最晚日期（不能超过今天）
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTimeRangeDialog(false)}
              disabled={crawling}
            >
              取消
            </Button>
            <Button onClick={startTimeRangeCrawl} disabled={crawling}>
              {crawling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  爬取中...
                </>
              ) : (
                "开始爬取"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导入历史结果对话框 */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入历史结果</DialogTitle>
            <DialogDescription>
              从Excel文件（.xls 或 .xlsx）导入历史开奖结果
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="importFile">选择Excel文件</Label>
              <Input
                id="importFile"
                type="file"
                accept=".xls,.xlsx"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return

                  setImporting(true)
                  
                  try {
                    const formData = new FormData()
                    formData.append('file', file)

                    const response = await fetch('/api/lottery/import', {
                      method: 'POST',
                      body: formData
                    })

                    const result = await response.json()

                    if (result.success) {
                      const { total, saved, existing, errors, errorMessages } = result.data
                      let description = `成功导入 ${saved} 条记录`
                      if (existing > 0) {
                        description += `，已存在 ${existing} 条`
                      }
                      if (errors > 0) {
                        description += `，失败 ${errors} 条`
                      }
                      
                      toast({
                        title: "导入完成",
                        description: description,
                      })

                      if (errorMessages && errorMessages.length > 0) {
                        console.warn('导入错误详情:', errorMessages)
                      }

                      // 刷新列表
                      setTimeout(() => {
                        fetchResults()
                      }, 1000)

                      setShowImportDialog(false)
                    } else {
                      toast({
                        title: "导入失败",
                        description: result.error || "未知错误",
                        variant: "destructive",
                      })
                    }
                  } catch (error) {
                    toast({
                      title: "导入失败",
                      description: error instanceof Error ? error.message : "未知错误",
                      variant: "destructive",
                    })
                  } finally {
                    setImporting(false)
                    // 清空文件选择
                    e.target.value = ''
                  }
                }}
                disabled={importing}
                className="cursor-pointer"
              />
              <p className="text-sm text-muted-foreground">
                Excel文件格式要求：
                <br />
                • 表头：period（期号）、date（日期）、red_balls（红球）、blue_ball（蓝球）
                <br />
                • red_balls格式：{`{01, 02, 03, 17, 25, 31}`} 或逗号分隔的6个数字
                <br />
                • 支持 .xls 和 .xlsx 格式
              </p>
            </div>
            {importing && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">正在导入...</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(false)}
              disabled={importing}
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

