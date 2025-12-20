"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Compare, Trophy, Target, Info, CheckCircle2, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Comparison {
  id: string
  prediction: {
    id: string
    redBalls: string[]
    blueBall: string
    strategy: string
    confidence: number
  }
  result: {
    id: string
    period: string
    date: string
    redBalls: string[]
    blueBall: string
  }
  redBallsHit: number
  blueBallHit: boolean
  prizeLevel: string | null
  prizeAmount: number
  accuracy: number
  createdAt: string
}

interface ComparisonStats {
  total: number
  totalPrize: number
  averageAccuracy: number
  prizeDistribution: {
    一等奖: number
    二等奖: number
    三等奖: number
    四等奖: number
    五等奖: number
    六等奖: number
  }
}

export function ComparisonView() {
  const [comparisons, setComparisons] = useState<Comparison[]>([])
  const [stats, setStats] = useState<ComparisonStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState("")
  const [predictionId, setPredictionId] = useState("")
  const [resultId, setResultId] = useState("")
  const { toast } = useToast()

  const fetchComparisons = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (period) params.append("period", period)
      params.append("limit", "50")

      const response = await fetch(`/api/lottery/comparison?${params}`)
      const result = await response.json()

      if (result.success) {
        setComparisons(result.data.comparisons)
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
          title: "获取对比数据失败",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('获取对比数据失败:', error)
      let errorMessage = "未知错误"
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = (error as any).message || JSON.stringify(error)
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      toast({
        title: "获取对比数据失败",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const createComparison = async () => {
    if (!predictionId || (!resultId && !period)) {
      toast({
        title: "参数错误",
        description: "请提供预测ID和开奖结果（ID或期号）",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/lottery/comparison", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          predictionId,
          resultId: resultId || undefined,
          period: period || undefined,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "对比完成",
          description: `红球命中${result.data.comparison.redBallsHit}个，${result.data.comparison.blueBallHit ? "蓝球命中" : "蓝球未命中"}`,
        })
        fetchComparisons()
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
          title: "对比失败",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('对比失败:', error)
      let errorMessage = "未知错误"
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = (error as any).message || JSON.stringify(error)
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      toast({
        title: "对比失败",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchComparisons()
  }, [])

  const getPrizeColor = (level: string | null) => {
    switch (level) {
      case "一等奖":
        return "bg-red-500"
      case "二等奖":
        return "bg-orange-500"
      case "三等奖":
        return "bg-yellow-500"
      case "四等奖":
        return "bg-green-500"
      case "五等奖":
        return "bg-blue-500"
      case "六等奖":
        return "bg-purple-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <div>
      {/* 创建对比 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>创建对比</CardTitle>
          <CardDescription>
            将预测结果与实际开奖结果进行对比
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="predictionId">
                预测ID
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="inline ml-1 h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="max-w-xs">
                        <p className="font-semibold mb-1">业务逻辑：</p>
                        <p className="text-sm mb-2">输入预测记录的ID，系统将查找该预测并与开奖结果对比。</p>
                        <p className="font-semibold mb-1">技术实现：</p>
                        <p className="text-sm">通过predictionId查询预测记录，匹配红球和蓝球，计算命中数和准确度。</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Input
                id="predictionId"
                value={predictionId}
                onChange={(e) => setPredictionId(e.target.value)}
                placeholder="预测ID"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="resultId">开奖结果ID（可选）</Label>
              <Input
                id="resultId"
                value={resultId}
                onChange={(e) => setResultId(e.target.value)}
                placeholder="开奖结果ID"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="period">期号（可选）</Label>
              <Input
                id="period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="期号，如：2025145"
                className="mt-2"
              />
            </div>
          </div>
          <Button
            onClick={createComparison}
            disabled={loading || !predictionId}
            className="mt-4"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                对比中...
              </>
            ) : (
              <>
                <Compare className="mr-2 h-4 w-4" />
                创建对比
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 统计信息 */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">总对比数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">累计中奖</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">¥{stats.totalPrize.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">平均准确度</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.averageAccuracy * 100).toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">中奖次数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1">
                {Object.entries(stats.prizeDistribution).map(([level, count]) => (
                  <div key={level} className="flex justify-between">
                    <span>{level}:</span>
                    <span className="font-medium">{count}次</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 对比列表 */}
      <Card>
        <CardHeader>
          <CardTitle>对比历史</CardTitle>
          <CardDescription>
            预测结果与实际开奖结果的对比
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : comparisons.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              还没有对比记录
            </div>
          ) : (
            <div className="space-y-4">
              {comparisons.map((comp) => (
                <Card key={comp.id} className="border">
                  <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* 预测结果 */}
                      <div>
                        <div className="text-sm font-medium mb-2">预测结果</div>
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {comp.prediction.redBalls.map((ball) => {
                              const isHit = comp.result.redBalls.includes(ball)
                              return (
                                <div
                                  key={ball}
                                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                    isHit
                                      ? "bg-green-500 text-white"
                                      : "bg-red-500 text-white opacity-50"
                                  }`}
                                >
                                  {ball}
                                </div>
                              )
                            })}
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                comp.blueBallHit
                                  ? "bg-green-500 text-white"
                                  : "bg-blue-500 text-white opacity-50"
                              }`}
                            >
                              {comp.prediction.blueBall}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            策略: {comp.prediction.strategy} | 置信度: {(comp.prediction.confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      {/* 实际结果 */}
                      <div>
                        <div className="text-sm font-medium mb-2">实际结果</div>
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {comp.result.redBalls.map((ball) => (
                              <div
                                key={ball}
                                className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm"
                              >
                                {ball}
                              </div>
                            ))}
                            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                              {comp.result.blueBall}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            期号: {comp.result.period} | 日期: {new Date(comp.result.date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 对比结果 */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              红球命中: <span className="font-medium">{comp.redBallsHit}/6</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {comp.blueBallHit ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm">
                              蓝球: <span className="font-medium">{comp.blueBallHit ? "命中" : "未命中"}</span>
                            </span>
                          </div>
                          {comp.prizeLevel && (
                            <Badge className={getPrizeColor(comp.prizeLevel)}>
                              <Trophy className="mr-1 h-3 w-3" />
                              {comp.prizeLevel}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">准确度</div>
                          <div className="text-lg font-bold">
                            {(comp.accuracy * 100).toFixed(1)}%
                          </div>
                          {comp.prizeAmount > 0 && (
                            <div className="text-sm font-medium text-green-600">
                              ¥{comp.prizeAmount.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

