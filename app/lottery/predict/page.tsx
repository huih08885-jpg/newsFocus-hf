"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Sparkles, TrendingUp, Brain, BarChart3, Info, Eye, Search, Filter, X, RefreshCw, TrendingDown, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"

interface PredictionResult {
  redBalls: string[]
  blueBall: string
  confidence: number
  strategy: string
  reasoning: string
  sources: string[]
}

interface PredictionResponse {
  predictions: PredictionResult[]
  analysis: {
    statistical: any
    ai?: any
    ml: any
  }
  metadata: {
    totalPeriods: number
    predictionDate: Date
    strategies: string[]
  }
}

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
  analysisResult?: any // 详细的分析结果
  config?: any // 配置信息
}

export default function LotteryPredictPage() {
  const [predictions, setPredictions] = useState<PredictionResult[]>([])
  const [historyPredictions, setHistoryPredictions] = useState<GroupedPrediction[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [periods, setPeriods] = useState(100)
  const [analysis, setAnalysis] = useState<PredictionResponse['analysis'] | null>(null)
  const [metadata, setMetadata] = useState<PredictionResponse['metadata'] | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<GroupedPrediction | null>(null)
  const [filters, setFilters] = useState({
    method: "comprehensive", // 默认只显示综合预测结果
    period: "",
    startDate: "",
    endDate: "",
    limit: 100
  })
  const [showFilters, setShowFilters] = useState(false)
  const { toast } = useToast()

  // 获取历史预测记录
  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const params = new URLSearchParams()
      // 综合预测页面默认只显示综合预测结果
      if (filters.method && filters.method !== "" && filters.method !== "all") {
        params.append("method", filters.method)
      } else {
        // 如果没有选择或选择"全部"，默认使用"comprehensive"
        params.append("method", "comprehensive")
      }
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
      method: "comprehensive", // 重置时也保持只显示综合预测结果
      period: "",
      startDate: "",
      endDate: "",
      limit: 100
    })
  }

  // 检查是否有筛选条件（综合预测是默认值，不算筛选条件）
  const hasActiveFilters = (filters.method && filters.method !== "" && filters.method !== "comprehensive") || filters.period || filters.startDate || filters.endDate

  const generatePredictions = async () => {
    if (periods < 10) {
      toast({
        title: "参数错误",
        description: "历史数据期数不能少于10期",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/lottery/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ periods }),
      })

      // 检查HTTP状态码
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }))
        const errorMessage = errorData.error?.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`
        console.error('预测API HTTP错误:', response.status, errorMessage)
        toast({
          title: "预测生成失败",
          description: typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage),
          variant: "destructive",
        })
        return
      }

      const result = await response.json()

      console.log('预测API响应:', result)

      if (result.success) {
        // 检查数据结构
        if (!result.data) {
          console.error('API返回数据格式错误: 缺少data字段', result)
          toast({
            title: "预测生成失败",
            description: "API返回数据格式错误",
            variant: "destructive",
          })
          return
        }

        if (!result.data.predictions || !Array.isArray(result.data.predictions)) {
          console.error('API返回数据格式错误: predictions不是数组', result.data)
          toast({
            title: "预测生成失败",
            description: "预测结果格式错误",
            variant: "destructive",
          })
          return
        }

        setPredictions(result.data.predictions)
        setAnalysis(result.data.analysis)
        setMetadata(result.data.metadata)
        toast({
          title: "预测生成成功",
          description: `已生成 ${result.data.predictions.length} 组预测号码`,
        })
        // 刷新历史记录
        fetchHistory()
      } else {
        // 处理错误响应
        const errorMessage = result.error?.message || result.error || "未知错误"
        console.error('预测生成失败:', errorMessage, result)
        toast({
          title: "预测生成失败",
          description: typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage),
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('生成预测失败:', error)
      toast({
        title: "预测生成失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
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

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.7) return 'text-green-600 dark:text-green-400'
    if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* 第一行：标题和副标题 */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold inline-block mr-3">fcyc</h1>
            <span className="text-sm text-muted-foreground">
              综合统计分析、AI分析和机器学习三种方法，生成5组预测号码
            </span>
          </div>
        </div>

        {/* 第二行：配置区域 */}
        <div className="mb-6 flex items-center gap-4">
          <Label htmlFor="periods" className="flex items-center gap-1 whitespace-nowrap">
            历史数据期数
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="max-w-xs">
                    <p className="font-semibold mb-1">业务逻辑：</p>
                    <p className="text-sm mb-2">使用最近N期的历史数据进行统计分析，期数越多，分析越全面，但计算时间也越长。</p>
                    <p className="font-semibold mb-1">技术实现：</p>
                    <p className="text-sm">从数据库查询最近N期数据，进行频率、遗漏、分布等统计分析。</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <Input
            id="periods"
            type="number"
            min={10}
            value={periods}
            onChange={(e) => setPeriods(parseInt(e.target.value) || 100)}
            className="w-32"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">（建议100期）</span>
          <Button
            onClick={generatePredictions}
            disabled={loading}
            className="min-w-[120px]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                生成预测
              </>
            )}
          </Button>
        </div>

        {/* 预测结果 - 表格展示 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>预测结果</CardTitle>
                <CardDescription>
                  历史预测记录列表
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Collapsible open={showFilters} onOpenChange={setShowFilters}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      筛选
                      {hasActiveFilters && (
                        <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                          {[(filters.method && filters.method !== "comprehensive" && filters.method !== "") ? 1 : 0, filters.period ? 1 : 0, filters.startDate || filters.endDate ? 1 : 0].reduce((a, b) => a + b, 0)}
                        </Badge>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="absolute z-10 mt-2 w-full max-w-4xl">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          {/* 预测方法筛选 */}
                          <div>
                            <Label className="text-sm mb-2 block">预测方法</Label>
                            <Select
                              value={filters.method || "comprehensive"}
                              onValueChange={(value) => {
                                // 综合预测页面只显示综合预测结果，选择"全部"时也保持为"comprehensive"
                                const methodValue = value === "all" ? "comprehensive" : value
                                setFilters({ ...filters, method: methodValue })
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="综合预测" />
                              </SelectTrigger>
                              <SelectContent>
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
                  点击"生成预测"按钮，系统将使用统计分析、AI分析和机器学习生成预测号码
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
                                        const isMatch = prizeInfo.redMatches.includes(ball)
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
                                预测日期: {new Date(group.predictionDate).toLocaleString('zh-CN')} | 
                                数据期数: {group.periods}期 | 
                                预测组数: {group.predictions.length}组
                                {group.predictedPeriod && ` | 预测期号: ${group.predictedPeriod}`}
                              </DialogDescription>
                            </DialogHeader>
                            <Tabs defaultValue="predictions" className="mt-4">
                              <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="predictions">预测号码</TabsTrigger>
                                <TabsTrigger value="analysis">分析详情</TabsTrigger>
                                <TabsTrigger value="evaluation">评估信息</TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="predictions" className="space-y-4 mt-4">
                                {/* 预测组列表 */}
                                <div>
                                  <h3 className="text-lg font-semibold mb-3">预测号码</h3>
                                <div className="space-y-3">
                                  {group.predictions.map((pred, predIndex) => (
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
                              </TabsContent>

                              <TabsContent value="analysis" className="space-y-4 mt-4">
                                {/* 详细分析结果 */}
                                {group.analysisResult && (
                                  <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">分析详情</h3>
                                  
                                  {/* 统计分析 */}
                                  {group.analysisResult.statistical && (
                                    <Card>
                                      <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                          <BarChart3 className="h-4 w-4" />
                                          统计分析
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="space-y-4">
                                        {/* 频率分析 */}
                                        {group.analysisResult.statistical.frequency && (
                                          <div>
                                            <Label className="text-sm font-semibold mb-2 block">频率分析</Label>
                                            <div className="grid grid-cols-3 gap-4 text-sm">
                                              <div>
                                                <span className="text-muted-foreground">热号: </span>
                                                <span className="font-medium">
                                                  {group.analysisResult.statistical.frequency.hotNumbers?.slice(0, 10).join(', ') || '-'}
                                                  {group.analysisResult.statistical.frequency.hotNumbers?.length > 10 && '...'}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground">温号: </span>
                                                <span className="font-medium">
                                                  {group.analysisResult.statistical.frequency.warmNumbers?.slice(0, 10).join(', ') || '-'}
                                                  {group.analysisResult.statistical.frequency.warmNumbers?.length > 10 && '...'}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground">冷号: </span>
                                                <span className="font-medium">
                                                  {group.analysisResult.statistical.frequency.coldNumbers?.slice(0, 10).join(', ') || '-'}
                                                  {group.analysisResult.statistical.frequency.coldNumbers?.length > 10 && '...'}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* 遗漏分析 */}
                                        {group.analysisResult.statistical.omission && (
                                          <div>
                                            <Label className="text-sm font-semibold mb-2 block">遗漏分析</Label>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                              <div>
                                                <span className="text-muted-foreground">高遗漏号码: </span>
                                                <span className="font-medium">
                                                  {group.analysisResult.statistical.omission.highOmission?.slice(0, 15).join(', ') || '-'}
                                                  {group.analysisResult.statistical.omission.highOmission?.length > 15 && '...'}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground">低遗漏号码: </span>
                                                <span className="font-medium">
                                                  {group.analysisResult.statistical.omission.lowOmission?.slice(0, 15).join(', ') || '-'}
                                                  {group.analysisResult.statistical.omission.lowOmission?.length > 15 && '...'}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* 分布分析 */}
                                        {group.analysisResult.statistical.distribution && (
                                          <div>
                                            <Label className="text-sm font-semibold mb-2 block">分布分析</Label>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                              <div>
                                                <span className="text-muted-foreground">区间分布: </span>
                                                <span className="font-medium">
                                                  一区({group.analysisResult.statistical.distribution.zoneDistribution?.zone1 || 0}) / 
                                                  二区({group.analysisResult.statistical.distribution.zoneDistribution?.zone2 || 0}) / 
                                                  三区({group.analysisResult.statistical.distribution.zoneDistribution?.zone3 || 0})
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground">奇偶比: </span>
                                                <span className="font-medium">
                                                  {group.analysisResult.statistical.distribution.oddEvenRatio?.odd || 0}:
                                                  {group.analysisResult.statistical.distribution.oddEvenRatio?.even || 0}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground">大小比: </span>
                                                <span className="font-medium">
                                                  {group.analysisResult.statistical.distribution.sizeRatio?.small || 0}:
                                                  {group.analysisResult.statistical.distribution.sizeRatio?.large || 0}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground">和值范围: </span>
                                                <span className="font-medium">
                                                  {group.analysisResult.statistical.distribution.sumRange?.min || 0} - 
                                                  {group.analysisResult.statistical.distribution.sumRange?.max || 0} 
                                                  (平均: {group.analysisResult.statistical.distribution.sumRange?.average?.toFixed(1) || 0})
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* 模式分析 */}
                                        {group.analysisResult.statistical.patterns && (
                                          <div>
                                            <Label className="text-sm font-semibold mb-2 block">模式分析</Label>
                                            <div className="text-sm space-y-2">
                                              <div>
                                                <span className="text-muted-foreground">连号频率: </span>
                                                <span className="font-medium">
                                                  {group.analysisResult.statistical.patterns.consecutiveNumbers?.frequency || 0}次
                                                </span>
                                              </div>
                                              {group.analysisResult.statistical.patterns.periodicPatterns && 
                                               group.analysisResult.statistical.patterns.periodicPatterns.length > 0 && (
                                                <div>
                                                  <span className="text-muted-foreground">周期性模式: </span>
                                                  <span className="font-medium">
                                                    {group.analysisResult.statistical.patterns.periodicPatterns.length}个
                                                  </span>
                                                </div>
                                              )}
                                              {group.analysisResult.statistical.patterns.combinationPatterns && 
                                               group.analysisResult.statistical.patterns.combinationPatterns.length > 0 && (
                                                <div>
                                                  <span className="text-muted-foreground">组合模式: </span>
                                                  <span className="font-medium">
                                                    {group.analysisResult.statistical.patterns.combinationPatterns.length}个
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* 统计分析建议 */}
                                        {group.analysisResult.statistical.recommendations && (
                                          <div>
                                            <Label className="text-sm font-semibold mb-2 block">分析建议</Label>
                                            <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800 p-3 rounded whitespace-pre-wrap">
                                              {group.analysisResult.statistical.recommendations}
                                            </p>
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                  )}

                                  {/* AI分析 */}
                                  {group.analysisResult.ai && (
                                    <Card>
                                      <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                          <Brain className="h-4 w-4" />
                                          AI分析
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        {group.analysisResult.ai.analysis && (
                                          <div className="text-sm">
                                            <Label className="text-sm font-semibold mb-2 block">AI分析结果</Label>
                                            <p className="text-muted-foreground bg-gray-50 dark:bg-gray-800 p-3 rounded whitespace-pre-wrap">
                                              {typeof group.analysisResult.ai.analysis === 'string' 
                                                ? group.analysisResult.ai.analysis 
                                                : JSON.stringify(group.analysisResult.ai.analysis, null, 2)}
                                            </p>
                                          </div>
                                        )}
                                        {group.analysisResult.ai.recommendations && (
                                          <div className="text-sm mt-4">
                                            <Label className="text-sm font-semibold mb-2 block">AI建议</Label>
                                            <p className="text-muted-foreground bg-gray-50 dark:bg-gray-800 p-3 rounded whitespace-pre-wrap">
                                              {typeof group.analysisResult.ai.recommendations === 'string' 
                                                ? group.analysisResult.ai.recommendations 
                                                : JSON.stringify(group.analysisResult.ai.recommendations, null, 2)}
                                            </p>
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                  )}

                                  {/* 机器学习分析 */}
                                  {group.analysisResult.ml && (
                                    <Card>
                                      <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                          <TrendingUp className="h-4 w-4" />
                                          机器学习分析
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="space-y-4">
                                        {group.analysisResult.ml.featureImportance && (
                                          <div className="text-sm">
                                            <Label className="text-sm font-semibold mb-2 block">特征重要性</Label>
                                            <div className="grid grid-cols-2 gap-4">
                                              {Object.entries(group.analysisResult.ml.featureImportance).map(([key, value]: [string, any]) => (
                                                <div key={key}>
                                                  <span className="text-muted-foreground">{key}: </span>
                                                  <span className="font-medium">{(value * 100).toFixed(1)}%</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* 机器学习分析建议 */}
                                        {group.analysisResult.ml.recommendations && (
                                          <div>
                                            <Label className="text-sm font-semibold mb-2 block">分析建议</Label>
                                            <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800 p-3 rounded whitespace-pre-wrap">
                                              {group.analysisResult.ml.recommendations}
                                            </p>
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                  )}

                                  {/* 配置信息 */}
                                  {group.config && (
                                    <Card>
                                      <CardHeader>
                                        <CardTitle className="text-base">预测配置</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <div className="text-sm space-y-2">
                                          {group.config.periods && (
                                            <div>
                                              <span className="text-muted-foreground">历史数据期数: </span>
                                              <span className="font-medium">{group.config.periods}期</span>
                                            </div>
                                          )}
                                          {group.config.temperature !== undefined && (
                                            <div>
                                              <span className="text-muted-foreground">温度参数: </span>
                                              <span className="font-medium">{group.config.temperature}</span>
                                            </div>
                                          )}
                                          {group.config.featureWeights && (
                                            <div>
                                              <Label className="text-sm font-semibold mb-2 block">特征权重</Label>
                                              <div className="grid grid-cols-2 gap-4">
                                                {Object.entries(group.config.featureWeights).map(([key, value]: [string, any]) => (
                                                  <div key={key}>
                                                    <span className="text-muted-foreground">{key}: </span>
                                                    <span className="font-medium">{value}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  )}
                                  </div>
                                ) : (
                                  <div className="text-center py-8 text-muted-foreground">
                                    暂无分析详情
                                  </div>
                                )}
                              </TabsContent>

                              <TabsContent value="evaluation" className="space-y-4 mt-4">
                                {group.result ? (
                                  <EvaluationTabContent 
                                    group={group}
                                    onEvaluate={async () => {
                                      // 评估预测结果
                                      try {
                                        const response = await fetch('/api/lottery/evaluate', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ period: group.predictedPeriod })
                                        })
                                        const result = await response.json()
                                        if (result.success) {
                                          toast({
                                            title: "评估完成",
                                            description: "预测结果已评估",
                                          })
                                          fetchHistory() // 刷新数据
                                        }
                                      } catch (error) {
                                        toast({
                                          title: "评估失败",
                                          description: error instanceof Error ? error.message : "未知错误",
                                          variant: "destructive",
                                        })
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="text-center py-8 text-muted-foreground">
                                    <AlertCircle className="mx-auto h-12 w-12 mb-4" />
                                    <p>开奖结果尚未公布，无法进行评估</p>
                                  </div>
                                )}
                              </TabsContent>
                            </Tabs>
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
      </div>
    </div>
  )
}

// 评估信息标签页内容组件
function EvaluationTabContent({ 
  group, 
  onEvaluate 
}: { 
  group: GroupedPrediction
  onEvaluate: () => void
}) {
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // 获取评估数据
    const fetchEvaluations = async () => {
      if (!group.predictedPeriod) return
      
      setLoading(true)
      try {
        const evaluations = await Promise.all(
          group.predictions.map(async (pred) => {
            try {
              const response = await fetch('/api/lottery/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ predictionId: pred.id })
              })
              const result = await response.json()
              return result.success ? result.data : null
            } catch {
              return null
            }
          })
        )
        setEvaluations(evaluations.filter(e => e !== null))
      } catch (error) {
        console.error('获取评估数据失败:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvaluations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.predictedPeriod, group.predictions.length])

  const getPrizeLevelVariant = (level: string) => {
    if (level === '0') return 'secondary'
    if (level === '1' || level === '2') return 'default'
    return 'outline'
  }

  const getPrizeLevelName = (level: string) => {
    const names: Record<string, string> = {
      '0': '未中奖',
      '1': '一等奖',
      '2': '二等奖',
      '3': '三等奖',
      '4': '四等奖',
      '5': '五等奖',
      '6': '六等奖',
    }
    return names[level] || '未知'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载评估数据中...</span>
      </div>
    )
  }

  if (evaluations.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">尚未进行评估</p>
        <Button onClick={onEvaluate}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          立即评估
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">评估结果</h3>
        <Button onClick={onEvaluate} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          重新评估
        </Button>
      </div>

      {group.predictions.map((pred, predIndex) => {
        const evaluation = evaluations.find(e => e.prediction.id === pred.id)?.evaluation
        const failureAnalysis = evaluations.find(e => e.prediction.id === pred.id)?.failureAnalysis

        if (!evaluation) {
          return (
            <Card key={pred.id}>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  第 {predIndex + 1} 组预测尚未评估
                </div>
              </CardContent>
            </Card>
          )
        }

        return (
          <Card key={pred.id}>
            <CardHeader>
              <CardTitle className="text-base">第 {predIndex + 1} 组预测评估</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 评估结果概览 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">准确率</Label>
                  <div className="space-y-2">
                    <Progress value={evaluation.accuracy * 100} />
                    <span className="text-lg font-bold">
                      {(evaluation.accuracy * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">中奖等级</Label>
                  <Badge variant={getPrizeLevelVariant(evaluation.prizeLevel)} className="text-base">
                    {getPrizeLevelName(evaluation.prizeLevel)}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">红球命中</Label>
                  <span className="text-2xl font-bold">
                    {evaluation.redBallsHit}/6
                  </span>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">蓝球命中</Label>
                  <div className="flex items-center gap-2">
                    {evaluation.blueBallHit > 0 ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-500" />
                    )}
                    <span className="text-lg font-bold">
                      {evaluation.blueBallHit > 0 ? '命中' : '未命中'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 综合得分和提升幅度 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">综合得分</Label>
                  <span className="text-xl font-bold">{evaluation.score.toFixed(1)}分</span>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">提升幅度</Label>
                  <div className="flex items-center gap-2">
                    {evaluation.improvement > 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    )}
                    <span className="text-xl font-bold">
                      {evaluation.improvement > 0 ? '+' : ''}
                      {(evaluation.improvement * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* 命中详情 */}
              {evaluation.details && (
                <div>
                  <Label className="text-sm font-semibold mb-2 block">命中详情</Label>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-muted-foreground">命中的红球: </span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {evaluation.details.redBallsMatched.map((ball: string) => (
                          <div
                            key={ball}
                            className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-red-800"
                          >
                            {ball.padStart(2, '0')}
                          </div>
                        ))}
                        {evaluation.details.redBallsMatched.length === 0 && (
                          <span className="text-sm text-muted-foreground">无</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">未命中的红球: </span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {evaluation.details.redBallsMissed.map((ball: string) => (
                          <div
                            key={ball}
                            className="w-8 h-8 rounded-full bg-red-200 text-red-800 flex items-center justify-center font-bold text-xs"
                          >
                            {ball.padStart(2, '0')}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 失败原因分析 */}
              {failureAnalysis && (
                <div>
                  <Label className="text-sm font-semibold mb-2 block">失败原因分析</Label>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium">{failureAnalysis.reason}</p>
                    {failureAnalysis.suggestions && failureAnalysis.suggestions.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold mb-2">改进建议:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {failureAnalysis.suggestions.map((suggestion: string, idx: number) => (
                            <li key={idx}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

