"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Sparkles, Filter, Search, X, Eye } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { BarChart3, Brain, TrendingUp } from "lucide-react"

interface HistoryPrediction {
  id: string
  period: string | null
  redBalls: string[]
  blueBall: string
  confidence: number
  strategy: string
  reasoning: string | null
  sources: string[]
  createdAt: string
  analysis: {
    id: string
    type: string
    periods: number
    config: any
    summary: string | null
    createdAt: string
  } | null
  result?: {
    period: string
    redBalls: string[]
    blueBall: string
  } | null
  prizeInfo?: {
    redMatches: string[]
    blueMatch: boolean
    redCount: number
    blueCount: number
    prizeLevel: string
    prizeName: string
    actualRedBalls: string[]
    actualBlueBall: string
  } | null
}

interface GroupedPrediction {
  analysisId: string
  analysisType: string
  periods: number
  predictionDate: string
  predictedPeriod: string | null
  predictions: HistoryPrediction[]
  result?: {
    period: string
    redBalls: string[]
    blueBall: string
  } | null
  analysisResult?: any
  config?: any
}

interface PredictionHistoryTableProps {
  defaultMethod?: string // 默认筛选的预测方法
  title?: string
  description?: string
}

export function PredictionHistoryTable({ 
  defaultMethod = "", 
  title = "预测结果",
  description = "历史预测记录列表"
}: PredictionHistoryTableProps) {
  const [historyPredictions, setHistoryPredictions] = useState<GroupedPrediction[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [filters, setFilters] = useState({
    method: defaultMethod,
    period: "",
    startDate: "",
    endDate: "",
    limit: 100
  })
  const [showFilters, setShowFilters] = useState(false)
  const [selectedDetail, setSelectedDetail] = useState<GroupedPrediction | null>(null)

  // 获取历史预测记录
  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const params = new URLSearchParams()
      if (filters.method && filters.method !== "") params.append("method", filters.method)
      if (filters.period) params.append("period", filters.period)
      if (filters.startDate) params.append("startDate", filters.startDate)
      if (filters.endDate) params.append("endDate", filters.endDate)
      params.append("limit", filters.limit.toString())
      params.append("sortBy", "createdAt")
      params.append("sortOrder", "desc")

      const response = await fetch(`/api/lottery/predictions?${params}`)
      const result = await response.json()

      if (result.success && result.data.predictions) {
        // 按analysisId分组
        const grouped = new Map<string, GroupedPrediction>()
        
        result.data.predictions.forEach((pred: HistoryPrediction) => {
          if (!pred.analysis) return
          
          // 确保 prizeInfo 是有效的对象，并且所有字段都是正确的类型
          if (pred.prizeInfo && typeof pred.prizeInfo === 'object') {
            // 确保 prizeName 是字符串
            if (pred.prizeInfo.prizeName && typeof pred.prizeInfo.prizeName !== 'string') {
              pred.prizeInfo.prizeName = String(pred.prizeInfo.prizeName)
            } else if (!pred.prizeInfo.prizeName) {
              pred.prizeInfo.prizeName = '未中奖'
            }
            // 确保 redMatches 是数组
            if (pred.prizeInfo.redMatches && !Array.isArray(pred.prizeInfo.redMatches)) {
              pred.prizeInfo.redMatches = []
            } else if (!pred.prizeInfo.redMatches) {
              pred.prizeInfo.redMatches = []
            }
            // 确保 blueMatch 是布尔值
            if (typeof pred.prizeInfo.blueMatch !== 'boolean') {
              pred.prizeInfo.blueMatch = false
            }
          }
          
          const analysisId = pred.analysis.id
          if (!grouped.has(analysisId)) {
            grouped.set(analysisId, {
              analysisId,
              analysisType: pred.analysis.type,
              periods: pred.analysis.periods,
              predictionDate: pred.analysis.createdAt,
              predictedPeriod: pred.period || null,
              predictions: [],
              result: pred.result || null,
              analysisResult: (pred.analysis as any).result || null,
              config: (pred.analysis as any).config || null
            })
          }
          grouped.get(analysisId)!.predictions.push(pred)
        })

        setHistoryPredictions(Array.from(grouped.values()))
      }
    } catch (error) {
      console.error('获取历史预测失败:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [filters])

  // 重置筛选
  const resetFilters = () => {
    setFilters({
      method: defaultMethod,
      period: "",
      startDate: "",
      endDate: "",
      limit: 100
    })
  }

  // 检查是否有筛选条件
  const hasActiveFilters = (filters.method && filters.method !== "" && filters.method !== defaultMethod) || filters.period || filters.startDate || filters.endDate

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case '保守型':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case '平衡型':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case '激进型':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-green-600 dark:text-green-400'
    if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Collapsible open={showFilters} onOpenChange={setShowFilters}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  筛选
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {[(filters.method && filters.method !== "" && filters.method !== defaultMethod) ? 1 : 0, filters.period ? 1 : 0, filters.startDate || filters.endDate ? 1 : 0].reduce((a, b) => a + b, 0)}
                    </Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* 预测方法筛选 */}
                      <div>
                        <Label className="text-sm mb-2 block">预测方法</Label>
                        <Select
                          value={filters.method || "all"}
                          onValueChange={(value) => setFilters({ ...filters, method: value === "all" ? "" : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="全部" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">全部</SelectItem>
                            <SelectItem value="comprehensive">综合预测</SelectItem>
                            <SelectItem value="statistical">统计分析</SelectItem>
                            <SelectItem value="ai">AI分析</SelectItem>
                            <SelectItem value="ml">机器学习</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 期号搜索 */}
                      <div>
                        <Label className="text-sm mb-2 block">期号搜索</Label>
                        <Input
                          placeholder="输入期号"
                          value={filters.period}
                          onChange={(e) => setFilters({ ...filters, period: e.target.value })}
                        />
                      </div>

                      {/* 开始日期 */}
                      <div>
                        <Label className="text-sm mb-2 block">开始日期</Label>
                        <Input
                          type="date"
                          value={filters.startDate}
                          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        />
                      </div>

                      {/* 结束日期 */}
                      <div>
                        <Label className="text-sm mb-2 block">结束日期</Label>
                        <Input
                          type="date"
                          value={filters.endDate}
                          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-4">
                      {hasActiveFilters && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={resetFilters}
                        >
                          <X className="h-4 w-4 mr-1" />
                          重置
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          fetchHistory()
                          setShowFilters(false)
                        }}
                      >
                        <Search className="h-4 w-4 mr-1" />
                        查询
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">加载中...</span>
          </div>
        ) : historyPredictions.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">还没有预测记录</h3>
            <p className="text-muted-foreground">
              点击"生成预测"按钮，系统将生成预测号码
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">序号</TableHead>
                <TableHead className="w-[180px]">预测日期</TableHead>
                <TableHead className="w-[120px]">数据期数</TableHead>
                <TableHead>预测结果</TableHead>
                <TableHead className="w-[120px]">预测开奖期</TableHead>
                <TableHead className="w-[200px]">当期开奖结果</TableHead>
                <TableHead className="w-[300px]">中奖结果</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyPredictions.map((group, index) => (
                <TableRow key={group.analysisId}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>
                    {new Date(group.predictionDate).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </TableCell>
                  <TableCell>{group.periods}期</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {group.predictions.slice(0, 5).map((pred, predIndex) => (
                        <div key={pred.id} className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">{predIndex + 1}.</span>
                          <div className="flex gap-1">
                            {pred.redBalls.map((ball) => (
                              <div
                                key={ball}
                                className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-xs"
                              >
                                {ball.padStart(2, '0')}
                              </div>
                            ))}
                            <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs">
                              {pred.blueBall.padStart(2, '0')}
                            </div>
                          </div>
                        </div>
                      ))}
                      {group.predictions.length > 5 && (
                        <span className="text-xs text-muted-foreground">
                          +{group.predictions.length - 5}组
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {group.predictedPeriod || '-'}
                  </TableCell>
                  <TableCell>
                    {group.result ? (
                      <div className="flex gap-1 flex-wrap">
                        {group.result.redBalls.map((ball) => (
                          <div
                            key={ball}
                            className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-xs"
                          >
                            {ball.padStart(2, '0')}
                          </div>
                        ))}
                        <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs">
                          {group.result.blueBall.padStart(2, '0')}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">未开奖</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {group.result ? (
                      <div className="space-y-1">
                        {group.predictions.map((pred, predIndex) => {
                          const prizeInfo = pred.prizeInfo
                          if (!prizeInfo) {
                            return (
                              <div key={pred.id} className="text-xs">
                                <div className="flex items-center gap-1 mb-1">
                                  <span className="text-muted-foreground">{predIndex + 1}.</span>
                                  <div className="flex gap-0.5">
                                    {pred.redBalls.map((ball) => (
                                      <div
                                        key={ball}
                                        className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-red-200 text-red-800"
                                      >
                                        {ball.padStart(2, '0')}
                                      </div>
                                    ))}
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-blue-200 text-blue-800">
                                      {pred.blueBall.padStart(2, '0')}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-[10px] text-muted-foreground ml-4">
                                  未中奖
                                </div>
                              </div>
                            )
                          }
                          
                          return (
                            <div key={pred.id} className="text-xs">
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-muted-foreground">{predIndex + 1}.</span>
                                <div className="flex gap-0.5">
                                  {pred.redBalls.map((ball) => {
                                    const isMatch = Array.isArray(prizeInfo.redMatches) && prizeInfo.redMatches.includes(ball)
                                    return (
                                      <div
                                        key={ball}
                                        className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                          isMatch 
                                            ? 'bg-red-700 text-white ring-2 ring-red-900' 
                                            : 'bg-red-200 text-red-800'
                                        }`}
                                      >
                                        {ball.padStart(2, '0')}
                                      </div>
                                    )
                                  })}
                                  <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                      prizeInfo.blueMatch === true
                                        ? 'bg-blue-700 text-white ring-2 ring-blue-900' 
                                        : 'bg-blue-200 text-blue-800'
                                    }`}
                                  >
                                    {pred.blueBall.padStart(2, '0')}
                                  </div>
                                </div>
                              </div>
                                  <div className="text-[10px] text-muted-foreground ml-4">
                                    {typeof prizeInfo.prizeName === 'string' ? prizeInfo.prizeName : '未中奖'}
                                  </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">未开奖</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDetail(group)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          详情
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>预测详情</DialogTitle>
                          <DialogDescription>
                            预测日期: {selectedDetail && new Date(selectedDetail.predictionDate).toLocaleString('zh-CN')} | 
                            数据期数: {selectedDetail?.periods}期 | 
                            预测组数: {selectedDetail?.predictions.length}组
                            {selectedDetail?.predictedPeriod && ` | 预测期号: ${selectedDetail.predictedPeriod}`}
                          </DialogDescription>
                        </DialogHeader>
                        {selectedDetail && (
                          <div className="space-y-4 mt-4">
                            {/* 预测组列表 */}
                            <div>
                              <h3 className="text-lg font-semibold mb-3">预测号码</h3>
                              <div className="space-y-3">
                                {selectedDetail.predictions.map((pred, predIndex) => (
                                  <Card key={pred.id}>
                                    <CardContent className="pt-6">
                                      <div className="flex items-start gap-4">
                                        <div className="flex-shrink-0 w-20">
                                          <div className="text-center">
                                            <div className="text-xl font-bold text-primary mb-1">
                                              {predIndex + 1}
                                            </div>
                                            <Badge className={getStrategyColor(pred.strategy)}>
                                              {pred.strategy}
                                            </Badge>
                                          </div>
                                        </div>
                                        <div className="flex-1">
                                          <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                              <Label className="text-sm text-muted-foreground mb-2 block">红球</Label>
                                              <div className="flex flex-wrap gap-2">
                                                {pred.redBalls.map((ball) => (
                                                  <div
                                                    key={ball}
                                                    className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm"
                                                  >
                                                    {ball.padStart(2, '0')}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                            <div>
                                              <Label className="text-sm text-muted-foreground mb-2 block">蓝球</Label>
                                              <div className="flex gap-2">
                                                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                                                  {pred.blueBall.padStart(2, '0')}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                              <Label className="text-sm text-muted-foreground mb-2 block">置信度</Label>
                                              <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                  <div
                                                    className="bg-blue-500 h-2 rounded-full"
                                                    style={{ width: `${pred.confidence * 100}%` }}
                                                  />
                                                </div>
                                                <span className={`text-sm font-semibold ${getConfidenceColor(pred.confidence)}`}>
                                                  {(pred.confidence * 100).toFixed(1)}%
                                                </span>
                                              </div>
                                            </div>
                                            <div>
                                              <Label className="text-sm text-muted-foreground mb-2 block">数据来源</Label>
                                              <div className="flex flex-wrap gap-2">
                                                {pred.sources.map((source) => (
                                                  <Badge key={source} variant="outline" className="text-xs">
                                                    {source === 'statistical' && <BarChart3 className="mr-1 h-3 w-3" />}
                                                    {source === 'ai' && <Brain className="mr-1 h-3 w-3" />}
                                                    {source === 'ml' && <TrendingUp className="mr-1 h-3 w-3" />}
                                                    {source === 'statistical' ? '统计分析' : source === 'ai' ? 'AI分析' : '机器学习'}
                                                  </Badge>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                          {pred.reasoning && (
                                            <div>
                                              <Label className="text-sm text-muted-foreground mb-2 block">预测理由</Label>
                                              <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                                {pred.reasoning}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

