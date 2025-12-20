"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, Info, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface PatternData {
  numbers: string[]
  frequency?: number
  count?: number
}

interface PatternAnalysis {
  consecutiveNumbers: {
    frequency: number
    patterns: PatternData[]
  }
  periodicPatterns: Array<{
    numbers: string[]
    period: number
    confidence: number
  }>
  combinationPatterns: PatternData[]
}

export function PatternAnalysis() {
  const [analysis, setAnalysis] = useState<PatternAnalysis | null>(null)
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
          type: "pattern",
          periods,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setAnalysis(result.data.result)
        setSaved(true)
        toast({
          title: "分析完成",
          description: "模式识别分析结果已保存到数据库",
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
      {/* 配置区域 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>分析配置</CardTitle>
          <CardDescription>
            设置用于分析的历史数据期数
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="periods">
                历史数据期数
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="inline ml-1 h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="max-w-xs">
                        <p className="font-semibold mb-1">业务逻辑：</p>
                        <p className="text-sm mb-2">使用最近N期的历史数据识别号码出现的模式，包括连号、周期性、组合等模式。</p>
                        <p className="font-semibold mb-1">技术实现：</p>
                        <p className="text-sm">遍历历史数据，统计连号出现频率、识别周期性模式、分析常见号码组合。</p>
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
                className="mt-2"
              />
            </div>
            <Button
              onClick={runAnalysis}
              disabled={loading}
              className="min-w-[120px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  开始分析
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 分析结果 */}
      {analysis && (
        <>
          {/* 连号分析 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                连号分析
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="ml-2 h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="max-w-xs">
                        <p className="font-semibold mb-1">业务逻辑：</p>
                        <p className="text-sm mb-2">统计连续号码（如01-02、15-16）在历史数据中的出现频率，连号是双色球中常见的模式。</p>
                        <p className="font-semibold mb-1">技术实现：</p>
                        <p className="text-sm">遍历每期开奖结果，检测是否存在连续号码，统计各连号组合的出现次数。</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription>
                连号出现频率: {(analysis.consecutiveNumbers.frequency * 100).toFixed(1)}%
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground mb-2">
                  常见连号组合（按频率排序）
                </div>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {analysis.consecutiveNumbers.patterns.slice(0, 12).map((pattern, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded border"
                    >
                      <div className="flex gap-2">
                        {pattern.numbers.map((num) => (
                          <div
                            key={num}
                            className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-xs"
                          >
                            {num}
                          </div>
                        ))}
                      </div>
                      <Badge variant="outline">
                        出现 {(pattern.count || pattern.frequency || 0)} 次
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 组合模式 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                组合模式
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="ml-2 h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="max-w-xs">
                        <p className="font-semibold mb-1">业务逻辑：</p>
                        <p className="text-sm mb-2">识别历史数据中经常一起出现的号码组合，这些组合可能具有某种关联性。</p>
                        <p className="font-semibold mb-1">技术实现：</p>
                        <p className="text-sm">统计所有6个号码的组合，找出出现次数大于1的组合，按频率排序。</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription>
                发现 {analysis.combinationPatterns.length} 个重复出现的组合
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {analysis.combinationPatterns.slice(0, 20).map((pattern, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded border"
                  >
                    <div className="flex flex-wrap gap-2">
                      {pattern.numbers.map((num) => (
                        <div
                          key={num}
                          className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm"
                        >
                          {num}
                        </div>
                      ))}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">出现 {(pattern.frequency || pattern.count || 0)} 次</div>
                      <div className="text-xs text-muted-foreground">
                        频率: {(((pattern.frequency || pattern.count || 0) / periods) * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 周期性模式 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                周期性模式
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="ml-2 h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="max-w-xs">
                        <p className="font-semibold mb-1">业务逻辑：</p>
                        <p className="text-sm mb-2">识别号码出现的周期性规律，例如某个号码每隔N期出现一次。</p>
                        <p className="font-semibold mb-1">技术实现：</p>
                        <p className="text-sm">分析每个号码的出现间隔，识别是否存在周期性模式，计算周期和置信度。</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription>
                识别号码出现的周期性规律
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analysis.periodicPatterns.length > 0 ? (
                <div className="space-y-3">
                  {analysis.periodicPatterns.map((pattern, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded border"
                    >
                      <div className="flex gap-2">
                        {pattern.numbers.map((num) => (
                          <div
                            key={num}
                            className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm"
                          >
                            {num}
                          </div>
                        ))}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">周期: {pattern.period} 期</div>
                        <div className="text-xs text-muted-foreground">
                          置信度: {(pattern.confidence * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  未发现明显的周期性模式
                </div>
              )}
            </CardContent>
          </Card>

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
            <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">还没有执行分析</h3>
            <p className="text-muted-foreground mb-4">
              点击"开始分析"按钮，系统将识别历史数据中的各种模式
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

