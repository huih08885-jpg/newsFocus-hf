"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Label } from "@/components/ui/label"
import { Loader2, TrendingUp, TrendingDown, Minus, RefreshCw, BarChart3, Brain, TrendingUp as TrendingUpIcon, Activity } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts"

interface WinningRateStats {
  total: number
  winning: number
  rate: number
  prizeDistribution: {
    level0: number
    level1: number
    level2: number
    level3: number
    level4: number
    level5: number
    level6: number
  }
}

interface OptimalWeights {
  ai: number
  ml: number
  statistical: number
  total: number
}

interface EvaluationData {
  winningRates: {
    statistical: WinningRateStats
    ai: WinningRateStats
    ml: WinningRateStats
    comprehensive: WinningRateStats
  }
  optimalWeights: OptimalWeights
  periods: number
}

export default function EvaluationPage() {
  const [data, setData] = useState<EvaluationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [periods, setPeriods] = useState(50)
  const { toast } = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/lottery/evaluate?periods=${periods}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        toast({
          title: "获取数据失败",
          description: result.error || "未知错误",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "获取数据失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // 每30秒自动刷新
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [periods])

  if (loading && !data) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">加载中...</span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">暂无评估数据</h3>
          <p className="text-muted-foreground mb-4">
            需要先进行预测并评估结果才能查看统计信息
          </p>
          <Button onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>
    )
  }

  // 准备图表数据
  const strategyData = [
    { name: '统计分析', rate: data.winningRates.statistical.rate * 100, winning: data.winningRates.statistical.winning, total: data.winningRates.statistical.total },
    { name: 'AI分析', rate: data.winningRates.ai.rate * 100, winning: data.winningRates.ai.winning, total: data.winningRates.ai.total },
    { name: '机器学习', rate: data.winningRates.ml.rate * 100, winning: data.winningRates.ml.winning, total: data.winningRates.ml.total },
    { name: '综合预测', rate: data.winningRates.comprehensive.rate * 100, winning: data.winningRates.comprehensive.winning, total: data.winningRates.comprehensive.total },
  ]

  // 合并所有方法的奖级分布（显示所有方法的总和）
  const totalPrizeDistribution = {
    level0: data.winningRates.statistical.prizeDistribution.level0 +
            data.winningRates.ai.prizeDistribution.level0 +
            data.winningRates.ml.prizeDistribution.level0 +
            data.winningRates.comprehensive.prizeDistribution.level0,
    level1: data.winningRates.statistical.prizeDistribution.level1 +
            data.winningRates.ai.prizeDistribution.level1 +
            data.winningRates.ml.prizeDistribution.level1 +
            data.winningRates.comprehensive.prizeDistribution.level1,
    level2: data.winningRates.statistical.prizeDistribution.level2 +
            data.winningRates.ai.prizeDistribution.level2 +
            data.winningRates.ml.prizeDistribution.level2 +
            data.winningRates.comprehensive.prizeDistribution.level2,
    level3: data.winningRates.statistical.prizeDistribution.level3 +
            data.winningRates.ai.prizeDistribution.level3 +
            data.winningRates.ml.prizeDistribution.level3 +
            data.winningRates.comprehensive.prizeDistribution.level3,
    level4: data.winningRates.statistical.prizeDistribution.level4 +
            data.winningRates.ai.prizeDistribution.level4 +
            data.winningRates.ml.prizeDistribution.level4 +
            data.winningRates.comprehensive.prizeDistribution.level4,
    level5: data.winningRates.statistical.prizeDistribution.level5 +
            data.winningRates.ai.prizeDistribution.level5 +
            data.winningRates.ml.prizeDistribution.level5 +
            data.winningRates.comprehensive.prizeDistribution.level5,
    level6: data.winningRates.statistical.prizeDistribution.level6 +
            data.winningRates.ai.prizeDistribution.level6 +
            data.winningRates.ml.prizeDistribution.level6 +
            data.winningRates.comprehensive.prizeDistribution.level6,
  }

  const prizeDistributionData = [
    { name: '一等奖', count: totalPrizeDistribution.level1 },
    { name: '二等奖', count: totalPrizeDistribution.level2 },
    { name: '三等奖', count: totalPrizeDistribution.level3 },
    { name: '四等奖', count: totalPrizeDistribution.level4 },
    { name: '五等奖', count: totalPrizeDistribution.level5 },
    { name: '六等奖', count: totalPrizeDistribution.level6 },
    { name: '未中奖', count: totalPrizeDistribution.level0 },
  ]

  const totalCount = Object.values(totalPrizeDistribution).reduce((sum, count) => sum + count, 0)

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* 标题和筛选 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">预测评估统计</h1>
            <p className="text-muted-foreground">
              查看各预测策略的历史中奖率统计和动态权重配置
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={periods.toString()} onValueChange={(v) => setPeriods(parseInt(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">最近30期</SelectItem>
                <SelectItem value="50">最近50期</SelectItem>
                <SelectItem value="100">最近100期</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchData} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新
            </Button>
          </div>
        </div>

        {/* 各策略中奖率对比 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>各策略中奖率对比</CardTitle>
            <CardDescription>基于最近{periods}期的评估数据</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-6">
              {strategyData.map((strategy) => (
                <div key={strategy.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {strategy.name === '统计分析' && <BarChart3 className="h-4 w-4" />}
                      {strategy.name === 'AI分析' && <Brain className="h-4 w-4" />}
                      {strategy.name === '机器学习' && <TrendingUpIcon className="h-4 w-4" />}
                      {strategy.name === '综合预测' && <Activity className="h-4 w-4" />}
                      <span className="font-medium">{strategy.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        {strategy.winning}/{strategy.total} 期
                      </span>
                      <span className="text-lg font-bold">
                        {strategy.rate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <Progress value={strategy.rate} className="h-3" />
                </div>
              ))}
            </div>

            {/* 图表展示 */}
            <div className="h-64 mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={strategyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="rate" fill="#3b82f6" name="中奖率 (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 动态权重配置 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>动态权重配置</CardTitle>
            <CardDescription>
              根据最近{periods}期的中奖率自动调整，权重总和为100%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    <span className="font-medium">AI分析</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">
                      {(data.optimalWeights.ai * 100).toFixed(1)}%
                    </span>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </div>
                </div>
                <Progress value={data.optimalWeights.ai * 100} className="h-3" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUpIcon className="h-4 w-4" />
                    <span className="font-medium">机器学习</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">
                      {(data.optimalWeights.ml * 100).toFixed(1)}%
                    </span>
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  </div>
                </div>
                <Progress value={data.optimalWeights.ml * 100} className="h-3" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span className="font-medium">统计分析</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">
                      {(data.optimalWeights.statistical * 100).toFixed(1)}%
                    </span>
                    <Minus className="h-4 w-4 text-gray-500" />
                  </div>
                </div>
                <Progress value={data.optimalWeights.statistical * 100} className="h-3" />
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                💡 <strong>说明：</strong>权重根据各策略的历史中奖率自动调整。
                表现更好的策略会获得更高的权重，从而在下次预测中发挥更大作用。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 奖级分布统计 */}
        <Card>
          <CardHeader>
            <CardTitle>奖级分布统计</CardTitle>
            <CardDescription>综合预测策略的奖级分布情况</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-6">
              {prizeDistributionData.map((prize) => (
                <div key={prize.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{prize.name}</span>
                    <span className="text-sm text-muted-foreground">{prize.count}次</span>
                  </div>
                  <Progress 
                    value={totalCount > 0 ? (prize.count / totalCount) * 100 : 0} 
                    className="h-2" 
                  />
                </div>
              ))}
            </div>

            {/* 图表展示 */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prizeDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#10b981" name="中奖次数" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

