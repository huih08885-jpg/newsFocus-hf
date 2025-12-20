"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, History, Filter, Calendar, Search, Info, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"

interface Prediction {
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

interface PredictionStats {
  total: number
  byMethod: {
    statistical: {
      total: number
      winning: number
    }
    ai: {
      total: number
      winning: number
    }
    ml: {
      total: number
      winning: number
    }
    comprehensive: {
      total: number
      winning: number
    }
  }
  averageConfidence: number
}

export function PredictionHistory() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [stats, setStats] = useState<PredictionStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    method: "",
    period: "",
    startDate: "",
    endDate: "",
    limit: 20,
    offset: 0
  })
  const [activeTab, setActiveTab] = useState("single")
  const { toast } = useToast()

  const fetchPredictions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.method) params.append("method", filters.method)
      if (filters.period) params.append("period", filters.period)
      if (filters.startDate) params.append("startDate", filters.startDate)
      if (filters.endDate) params.append("endDate", filters.endDate)
      // 按批次显示时需要更大的limit，确保同一批次的所有预测都能加载
      const limit = activeTab === "grouped" ? 100 : filters.limit
      params.append("limit", limit.toString())
      params.append("offset", filters.offset.toString())

      const response = await fetch(`/api/lottery/predictions?${params}`)
      const result = await response.json()

      if (result.success) {
        setPredictions(result.data.predictions)
        setStats(result.data.stats)
      } else {
        // 处理错误信息，确保是字符串
        let errorMessage = "未知错误"
        if (result.error) {
          if (typeof result.error === 'string') {
            errorMessage = result.error
          } else if (typeof result.error === 'object' && result.error !== null) {
            // 如果是对象，提取 message 字段
            errorMessage = (result.error as any).message || (result.error as any).code || JSON.stringify(result.error)
          }
        }
        
        toast({
          title: "获取预测历史失败",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('获取预测历史失败:', error)
      let errorMessage = "未知错误"
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = (error as any).message || JSON.stringify(error)
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      toast({
        title: "获取预测历史失败",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPredictions()
  }, [filters.offset, activeTab])

  const getMethodName = (type: string) => {
    switch (type) {
      case 'statistical': return '统计分析'
      case 'ai': return 'AI分析'
      case 'ml': return '机器学习'
      case 'comprehensive': return '综合预测'
      default: return type
    }
  }

  const getMethodColor = (type: string) => {
    switch (type) {
      case 'statistical': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'ai': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'ml': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'comprehensive': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

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
    <div>
      {/* 统计信息 */}
      {stats && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">总预测数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">平均置信度</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.averageConfidence * 100).toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">统计分析</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.byMethod.statistical.winning}/{stats.byMethod.statistical.total}
              </div>
              <div className="text-sm text-muted-foreground mt-1">中奖数/预测数</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI分析</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.byMethod.ai.winning}/{stats.byMethod.ai.total}
              </div>
              <div className="text-sm text-muted-foreground mt-1">中奖数/预测数</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">机器学习预测</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.byMethod.ml.winning}/{stats.byMethod.ml.total}
              </div>
              <div className="text-sm text-muted-foreground mt-1">中奖数/预测数</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">综合预测</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.byMethod.comprehensive.winning}/{stats.byMethod.comprehensive.total}
              </div>
              <div className="text-sm text-muted-foreground mt-1">中奖数/预测数</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 筛选区域 - 一行布局 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
          <CardDescription>
            按方法、期号、日期等条件筛选预测记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="method">预测方法</Label>
              <Select
                value={filters.method || "all"}
                onValueChange={(value) => {
                  // 将 "all" 转换回空字符串
                  const methodValue = value === "all" ? "" : value
                  setFilters({ ...filters, method: methodValue, offset: 0 })
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="全部方法" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部方法</SelectItem>
                  <SelectItem value="statistical">统计分析</SelectItem>
                  <SelectItem value="ai">AI分析</SelectItem>
                  <SelectItem value="ml">机器学习</SelectItem>
                  <SelectItem value="comprehensive">综合预测</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="period">期号</Label>
              <Input
                id="period"
                value={filters.period}
                onChange={(e) => setFilters({ ...filters, period: e.target.value, offset: 0 })}
                placeholder="如：2025145"
                className="mt-2"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="startDate">开始日期</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value, offset: 0 })}
                className="mt-2"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="endDate">结束日期</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value, offset: 0 })}
                className="mt-2"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchPredictions} variant="outline">
                <Search className="mr-2 h-4 w-4" />
                搜索
              </Button>
              <Button
                onClick={() => {
                  setFilters({
                    method: "",
                    period: "",
                    startDate: "",
                    endDate: "",
                    limit: 20,
                    offset: 0
                  })
                }}
                variant="ghost"
              >
                重置
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 预测列表 */}
      <Card>
        <CardHeader>
          <CardTitle>预测历史</CardTitle>
          <CardDescription>
            所有保存的预测记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : predictions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              还没有预测记录
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single">按记录展示</TabsTrigger>
                <TabsTrigger value="grouped">按预测批次展示</TabsTrigger>
              </TabsList>
              
              {/* 第一个页签：按单个记录展示 */}
              <TabsContent value="single" className="mt-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">序号</TableHead>
                        <TableHead className="w-[160px]">预测日期</TableHead>
                        <TableHead className="w-[100px]">数据期数</TableHead>
                        <TableHead className="w-[120px]">预测方法</TableHead>
                        <TableHead>预测结果</TableHead>
                        <TableHead className="w-[120px]">预测开奖期</TableHead>
                        <TableHead className="w-[200px]">当期开奖结果</TableHead>
                        <TableHead className="w-[300px]">中奖结果</TableHead>
                        <TableHead className="w-[100px]">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {predictions.map((pred, index) => (
                    <TableRow key={pred.id}>
                      <TableCell className="font-medium">{filters.offset + index + 1}</TableCell>
                      <TableCell>
                        {new Date(pred.createdAt).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell>
                        {pred.analysis ? `${pred.analysis.periods}期` : '-'}
                      </TableCell>
                      <TableCell>
                        {pred.analysis && (
                          <Badge className={getMethodColor(pred.analysis.type)}>
                            {getMethodName(pred.analysis.type)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <div className="flex gap-0.5">
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
                      </TableCell>
                      <TableCell className="font-medium">
                        {pred.period || '-'}
                      </TableCell>
                      <TableCell>
                        {pred.result ? (
                          <div className="flex gap-1 flex-wrap">
                            {pred.result.redBalls.map((ball) => (
                              <div
                                key={ball}
                                className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-xs"
                              >
                                {ball.padStart(2, '0')}
                              </div>
                            ))}
                            <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs">
                              {pred.result.blueBall.padStart(2, '0')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">未开奖</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {pred.result && pred.prizeInfo ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <div className="flex gap-0.5">
                                {pred.redBalls.map((ball) => {
                                  const isMatch = Array.isArray(pred.prizeInfo?.redMatches) && pred.prizeInfo.redMatches.includes(ball)
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
                                    pred.prizeInfo.blueMatch === true
                                      ? 'bg-blue-700 text-white ring-2 ring-blue-900' 
                                      : 'bg-blue-200 text-blue-800'
                                  }`}
                                >
                                  {pred.blueBall.padStart(2, '0')}
                                </div>
                              </div>
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {typeof pred.prizeInfo.prizeName === 'string' ? pred.prizeInfo.prizeName : '未中奖'}
                            </div>
                          </div>
                        ) : pred.result ? (
                          <span className="text-sm text-muted-foreground">未中奖</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">未开奖</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              详情
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>预测详情</DialogTitle>
                              <DialogDescription>
                                查看预测的详细信息
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label className="text-sm font-semibold">预测方法</Label>
                                <div className="mt-1">
                                  {pred.analysis && (
                                    <Badge className={getMethodColor(pred.analysis.type)}>
                                      {getMethodName(pred.analysis.type)}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div>
                                <Label className="text-sm font-semibold">预测号码</Label>
                                <div className="flex gap-2 mt-2">
                                  {pred.redBalls.map((ball) => (
                                    <div
                                      key={ball}
                                      className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center font-bold"
                                    >
                                      {ball}
                                    </div>
                                  ))}
                                  <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                                    {pred.blueBall}
                                  </div>
                                </div>
                              </div>
                              <div>
                                <Label className="text-sm font-semibold">置信度</Label>
                                <div className={`mt-1 font-semibold ${getConfidenceColor(pred.confidence)}`}>
                                  {(pred.confidence * 100).toFixed(1)}%
                                </div>
                              </div>
                              {pred.reasoning && (
                                <div>
                                  <Label className="text-sm font-semibold">预测理由</Label>
                                  <p className="text-sm text-muted-foreground mt-1">{pred.reasoning}</p>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                </div>
                
                {/* 分页 */}
                {predictions.length > 0 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      显示 {filters.offset + 1} - {Math.min(filters.offset + filters.limit, stats?.total || 0)} / {stats?.total || 0}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) })}
                        disabled={filters.offset === 0 || loading}
                      >
                        上一页
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}
                        disabled={!stats || filters.offset + filters.limit >= stats.total || loading}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* 第二个页签：按预测批次展示（按analysisId分组） */}
              <TabsContent value="grouped" className="mt-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">序号</TableHead>
                        <TableHead className="w-[140px]">预测日期</TableHead>
                        <TableHead className="w-[90px]">数据期数</TableHead>
                        <TableHead className="w-[100px]">预测方法</TableHead>
                        <TableHead className="w-[350px]">预测结果（5注）</TableHead>
                        <TableHead className="w-[100px]">预测开奖期</TableHead>
                        <TableHead className="w-[180px]">当期开奖结果</TableHead>
                        <TableHead className="w-[280px]">中奖结果</TableHead>
                        <TableHead className="w-[80px]">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        // 按analysisId分组
                        const grouped = new Map<string, Prediction[]>()
                        predictions.forEach(pred => {
                          if (!pred.analysis) return
                          const analysisId = pred.analysis.id
                          if (!grouped.has(analysisId)) {
                            grouped.set(analysisId, [])
                          }
                          grouped.get(analysisId)!.push(pred)
                        })

                        return Array.from(grouped.entries()).map(([analysisId, groupPreds], groupIndex) => {
                          const firstPred = groupPreds[0]
                          return (
                            <TableRow key={analysisId}>
                              <TableCell className="font-medium">{filters.offset + groupIndex + 1}</TableCell>
                              <TableCell>
                                {new Date(firstPred.createdAt).toLocaleString('zh-CN', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </TableCell>
                              <TableCell>
                                {firstPred.analysis ? `${firstPred.analysis.periods}期` : '-'}
                              </TableCell>
                              <TableCell>
                                {firstPred.analysis && (
                                  <Badge className={getMethodColor(firstPred.analysis.type)}>
                                    {getMethodName(firstPred.analysis.type)}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="w-[350px]">
                                <div className="space-y-1.5">
                                  {groupPreds && groupPreds.length > 0 ? (
                                    groupPreds.map((pred, predIndex) => (
                                      <div key={pred.id} className="flex items-center gap-1.5">
                                        <span className="text-xs text-muted-foreground w-5 flex-shrink-0">{predIndex + 1}.</span>
                                        <div className="flex gap-0.5 flex-wrap">
                                          {pred.redBalls && Array.isArray(pred.redBalls) && pred.redBalls.length > 0 ? (
                                            pred.redBalls.map((ball) => (
                                              <div
                                                key={ball}
                                                className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0"
                                              >
                                                {String(ball).padStart(2, '0')}
                                              </div>
                                            ))
                                          ) : null}
                                          {pred.blueBall && (
                                            <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                                              {String(pred.blueBall).padStart(2, '0')}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-sm text-muted-foreground">无预测数据</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                {firstPred.period || '-'}
                              </TableCell>
                              <TableCell>
                                {firstPred.result ? (
                                  <div className="flex gap-1 flex-wrap">
                                    {firstPred.result.redBalls.map((ball) => (
                                      <div
                                        key={ball}
                                        className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-xs"
                                      >
                                        {ball.padStart(2, '0')}
                                      </div>
                                    ))}
                                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs">
                                      {firstPred.result.blueBall.padStart(2, '0')}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">未开奖</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {firstPred.result ? (
                                  <div className="space-y-1">
                                    {groupPreds.map((pred, predIndex) => {
                                      const prizeInfo = pred.prizeInfo
                                      if (!prizeInfo) {
                                        return (
                                          <div key={pred.id} className="text-xs">
                                            <div className="flex items-center gap-1 mb-1">
                                              <span className="text-muted-foreground w-4">{predIndex + 1}.</span>
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
                                            <div className="text-[10px] text-muted-foreground ml-5">
                                              未中奖
                                            </div>
                                          </div>
                                        )
                                      }
                                      
                                      return (
                                        <div key={pred.id} className="text-xs">
                                          <div className="flex items-center gap-1 mb-1">
                                            <span className="text-muted-foreground w-4">{predIndex + 1}.</span>
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
                                          <div className="text-[10px] text-muted-foreground ml-5">
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
                                    <Button variant="ghost" size="sm">
                                      <Eye className="h-4 w-4 mr-1" />
                                      详情
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle>预测详情</DialogTitle>
                                      <DialogDescription>
                                        查看预测的详细信息
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div>
                                        <Label className="text-sm font-semibold">预测方法</Label>
                                        <div className="mt-1">
                                          {firstPred.analysis && (
                                            <Badge className={getMethodColor(firstPred.analysis.type)}>
                                              {getMethodName(firstPred.analysis.type)}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-semibold">预测号码（共{groupPreds.length}注）</Label>
                                        <div className="space-y-3 mt-2">
                                          {groupPreds.map((pred, predIndex) => (
                                            <div key={pred.id} className="border rounded-lg p-3">
                                              <div className="text-sm font-medium mb-2">第{predIndex + 1}注</div>
                                              <div className="flex gap-2">
                                                {pred.redBalls.map((ball) => (
                                                  <div
                                                    key={ball}
                                                    className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center font-bold"
                                                  >
                                                    {ball}
                                                  </div>
                                                ))}
                                                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                                                  {pred.blueBall}
                                                </div>
                                              </div>
                                              <div className="mt-2">
                                                <span className="text-muted-foreground text-sm">置信度: </span>
                                                <span className={`font-semibold text-sm ${getConfidenceColor(pred.confidence)}`}>
                                                  {(pred.confidence * 100).toFixed(1)}%
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

