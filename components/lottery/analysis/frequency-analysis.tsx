"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, BarChart3, TrendingUp, TrendingDown, Minus, Info, Save, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface FrequencyData {
  number: string
  frequency: number
  lastAppeared: number
}

interface FrequencyAnalysis {
  redBalls: FrequencyData[]
  blueBalls: FrequencyData[]
  hotNumbers: string[]
  coldNumbers: string[]
  warmNumbers: string[]
}

export function FrequencyAnalysis() {
  const [analysis, setAnalysis] = useState<FrequencyAnalysis | null>(null)
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
          type: "frequency",
          periods,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setAnalysis(result.data.result)
        setSaved(true)
        toast({
          title: "分析完成",
          description: "频率分析结果已保存到数据库",
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
          <h1 className="text-2xl font-bold inline-block mr-3">频率分析</h1>
          <span className="text-sm text-muted-foreground">
            统计每个号码的出现频率，识别热号、温号和冷号
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
                  <p className="text-sm mb-2">使用最近N期的历史数据统计每个号码的出现频率，期数越多，统计越准确。</p>
                  <p className="font-semibold mb-1">技术实现：</p>
                  <p className="text-sm">遍历历史数据，统计每个号码的出现次数，按频率排序，前30%为热号，后30%为冷号，中间为温号。</p>
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
          {/* 分类统计 */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5 text-green-500" />
                  热号
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="ml-2 h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="max-w-xs">
                          <p className="font-semibold mb-1">业务逻辑：</p>
                          <p className="text-sm mb-2">出现频率最高的30%号码，这些号码近期出现频繁，中奖概率相对较高。</p>
                          <p className="font-semibold mb-1">技术实现：</p>
                          <p className="text-sm">按频率排序，选择前30%的号码作为热号。</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysis.hotNumbers.map((num) => (
                    <Badge key={num} variant="default" className="bg-green-500">
                      {num}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Minus className="mr-2 h-5 w-5 text-yellow-500" />
                  温号
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="ml-2 h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="max-w-xs">
                          <p className="font-semibold mb-1">业务逻辑：</p>
                          <p className="text-sm mb-2">出现频率中等的40%号码，介于热号和冷号之间。</p>
                          <p className="font-semibold mb-1">技术实现：</p>
                          <p className="text-sm">按频率排序，选择中间40%的号码作为温号。</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysis.warmNumbers.map((num) => (
                    <Badge key={num} variant="outline" className="border-yellow-500 text-yellow-700">
                      {num}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <TrendingDown className="mr-2 h-5 w-5 text-red-500" />
                  冷号
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="ml-2 h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="max-w-xs">
                          <p className="font-semibold mb-1">业务逻辑：</p>
                          <p className="text-sm mb-2">出现频率最低的30%号码，这些号码近期出现较少，但可能回补。</p>
                          <p className="font-semibold mb-1">技术实现：</p>
                          <p className="text-sm">按频率排序，选择后30%的号码作为冷号。</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysis.coldNumbers.map((num) => (
                    <Badge key={num} variant="destructive">
                      {num}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 详细数据 */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>红球频率统计</CardTitle>
                <CardDescription>
                  按频率从高到低排序
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {analysis.redBalls.map((item, index) => (
                    <div
                      key={item.number}
                      className="flex items-center justify-between p-2 rounded border"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-8">
                          #{index + 1}
                        </span>
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                            analysis.hotNumbers.includes(item.number)
                              ? "bg-green-500 text-white"
                              : analysis.coldNumbers.includes(item.number)
                              ? "bg-red-500 text-white"
                              : "bg-yellow-500 text-white"
                          }`}
                        >
                          {item.number}
                        </div>
                        <div>
                          <div className="text-sm font-medium">出现 {item.frequency} 次</div>
                          <div className="text-xs text-muted-foreground">
                            {item.lastAppeared === 0
                              ? "本期出现"
                              : `${item.lastAppeared} 期前出现`}
                          </div>
                        </div>
                      </div>
                      <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{
                            width: `${(item.frequency / analysis.redBalls[0].frequency) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>蓝球频率统计</CardTitle>
                <CardDescription>
                  按频率从高到低排序
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {analysis.blueBalls.map((item, index) => (
                    <div
                      key={item.number}
                      className="flex items-center justify-between p-2 rounded border"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-8">
                          #{index + 1}
                        </span>
                        <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                          {item.number}
                        </div>
                        <div>
                          <div className="text-sm font-medium">出现 {item.frequency} 次</div>
                          <div className="text-xs text-muted-foreground">
                            {item.lastAppeared === 0
                              ? "本期出现"
                              : `${item.lastAppeared} 期前出现`}
                          </div>
                        </div>
                      </div>
                      <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{
                            width: `${(item.frequency / analysis.blueBalls[0].frequency) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
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
            <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">还没有执行分析</h3>
            <p className="text-muted-foreground mb-4">
              点击"开始分析"按钮，系统将统计每个号码的出现频率
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

