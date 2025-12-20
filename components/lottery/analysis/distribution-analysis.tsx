"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, PieChart, Info, Save, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface DistributionAnalysis {
  zoneDistribution: {
    zone1: number
    zone2: number
    zone3: number
  }
  oddEvenRatio: {
    odd: number
    even: number
  }
  sizeRatio: {
    small: number
    large: number
  }
  sumRange: {
    min: number
    max: number
    average: number
  }
  spanRange: {
    min: number
    max: number
    average: number
  }
}

export function DistributionAnalysis() {
  const [analysis, setAnalysis] = useState<DistributionAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [periods, setPeriods] = useState(100)
  const [saved, setSaved] = useState(false)
  const { toast } = useToast()

  const runAnalysis = async () => {
    if (periods < 10) {
      toast({
        title: "参数错误",
        description: "历史数据期数不能少于10期",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setSaved(false)
    try {
      const response = await fetch("/api/lottery/analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "distribution",
          periods,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setAnalysis(result.data.result)
        setSaved(true)
        toast({
          title: "分析完成",
          description: "分布分析结果已保存到数据库",
        })
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
          title: "分析失败",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('分析失败:', error)
      let errorMessage = "未知错误"
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = (error as any).message || JSON.stringify(error)
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      toast({
        title: "分析失败",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* 第一行：标题和副标题 */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold inline-block mr-3">分布分析</h1>
          <span className="text-sm text-muted-foreground">
            分析号码的分布特征（区间、奇偶、大小、和值、跨度），识别分布规律
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
                  <p className="text-sm mb-2">分析号码的分布特征（区间、奇偶、大小、和值、跨度），识别分布规律。</p>
                  <p className="font-semibold mb-1">技术实现：</p>
                  <p className="text-sm">统计每期的分布特征，计算平均值和范围，用于评估号码组合的合理性。</p>
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
          onClick={runAnalysis}
          disabled={loading}
          className="min-w-[120px] ml-4"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              分析中...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              开始分析
            </>
          )}
        </Button>
      </div>

      {/* 分析结果 */}
      {analysis && (
        <>
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            {/* 区间分布 */}
            <Card>
              <CardHeader>
                <CardTitle>区间分布</CardTitle>
                <CardDescription>
                  红球在三个区间的分布情况
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="inline ml-1 h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="max-w-xs">
                          <p className="font-semibold mb-1">业务逻辑：</p>
                          <p className="text-sm mb-2">将33个红球分为三个区间：1-11、12-22、23-33，分析每个区间的号码分布。</p>
                          <p className="font-semibold mb-1">技术实现：</p>
                          <p className="text-sm">统计每期各区间号码数量，计算平均分布比例。</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">区间1 (01-11)</span>
                      <span className="text-sm font-medium">
                        {(analysis.zoneDistribution.zone1 * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${analysis.zoneDistribution.zone1 * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">区间2 (12-22)</span>
                      <span className="text-sm font-medium">
                        {(analysis.zoneDistribution.zone2 * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${analysis.zoneDistribution.zone2 * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">区间3 (23-33)</span>
                      <span className="text-sm font-medium">
                        {(analysis.zoneDistribution.zone3 * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full"
                        style={{ width: `${analysis.zoneDistribution.zone3 * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 奇偶比 */}
            <Card>
              <CardHeader>
                <CardTitle>奇偶比</CardTitle>
                <CardDescription>
                  红球中奇数和偶数的比例
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="inline ml-1 h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="max-w-xs">
                          <p className="font-semibold mb-1">业务逻辑：</p>
                          <p className="text-sm mb-2">分析红球中奇数和偶数的分布比例，常见的有3:3、4:2、2:4等。</p>
                          <p className="font-semibold mb-1">技术实现：</p>
                          <p className="text-sm">统计每期奇数和偶数数量，计算平均比例。</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">奇数</span>
                      <span className="text-sm font-medium">
                        {(analysis.oddEvenRatio.odd * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full"
                        style={{ width: `${analysis.oddEvenRatio.odd * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">偶数</span>
                      <span className="text-sm font-medium">
                        {(analysis.oddEvenRatio.even * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-pink-500 h-2 rounded-full"
                        style={{ width: `${analysis.oddEvenRatio.even * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 大小比 */}
            <Card>
              <CardHeader>
                <CardTitle>大小比</CardTitle>
                <CardDescription>
                  红球中大号和小号的比例
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="inline ml-1 h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="max-w-xs">
                          <p className="font-semibold mb-1">业务逻辑：</p>
                          <p className="text-sm mb-2">将红球分为小号(1-16)和大号(17-33)，分析大小号的分布比例。</p>
                          <p className="font-semibold mb-1">技术实现：</p>
                          <p className="text-sm">统计每期小号和大号数量，计算平均比例。</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">小号 (01-16)</span>
                      <span className="text-sm font-medium">
                        {(analysis.sizeRatio.small * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-cyan-500 h-2 rounded-full"
                        style={{ width: `${analysis.sizeRatio.small * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">大号 (17-33)</span>
                      <span className="text-sm font-medium">
                        {(analysis.sizeRatio.large * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full"
                        style={{ width: `${analysis.sizeRatio.large * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 和值与跨度 */}
            <Card>
              <CardHeader>
                <CardTitle>和值与跨度</CardTitle>
                <CardDescription>
                  红球号码总和和跨度的统计
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="inline ml-1 h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="max-w-xs">
                          <p className="font-semibold mb-1">业务逻辑：</p>
                          <p className="text-sm mb-2">和值是6个红球号码的总和，跨度是最大号与最小号的差值，用于评估号码组合的分布特征。</p>
                          <p className="font-semibold mb-1">技术实现：</p>
                          <p className="text-sm">计算每期的和值和跨度，统计最小值、最大值和平均值。</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium mb-2">和值范围</div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>最小值: {analysis.sumRange.min}</div>
                      <div>最大值: {analysis.sumRange.max}</div>
                      <div>平均值: {analysis.sumRange.average.toFixed(1)}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-2">跨度范围</div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>最小值: {analysis.spanRange.min}</div>
                      <div>最大值: {analysis.spanRange.max}</div>
                      <div>平均值: {analysis.spanRange.average.toFixed(1)}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {saved && (
            <Card className="mt-6 border-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-green-600">
                  <Save className="h-5 w-5" />
                  <span className="font-medium">分析结果已保存到数据库</span>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* 空状态 */}
      {!analysis && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <PieChart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">还没有执行分析</h3>
            <p className="text-muted-foreground mb-4">
              点击"开始分析"按钮，系统将分析号码的分布特征
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

