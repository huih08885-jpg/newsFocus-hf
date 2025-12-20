"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, Clock, AlertCircle, Info, Save, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface OmissionData {
  number: string
  omission: number
  maxOmission: number
}

interface OmissionAnalysis {
  redBalls: OmissionData[]
  blueBalls: OmissionData[]
  highOmission: string[]
  lowOmission: string[]
}

export function OmissionAnalysis() {
  const [analysis, setAnalysis] = useState<OmissionAnalysis | null>(null)
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
          type: "omission",
          periods,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setAnalysis(result.data.result)
        setSaved(true)
        toast({
          title: "分析完成",
          description: "遗漏分析结果已保存到数据库",
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
          <h1 className="text-2xl font-bold inline-block mr-3">遗漏分析</h1>
          <span className="text-sm text-muted-foreground">
            计算每个号码距离上次出现的期数，识别高遗漏和低遗漏号码
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
                  <p className="text-sm mb-2">计算每个号码距离上次出现的期数，遗漏值越大，表示该号码越久未出现，回补概率可能越高。</p>
                  <p className="font-semibold mb-1">技术实现：</p>
                  <p className="text-sm">遍历历史数据，记录每个号码最后出现的期数，计算当前遗漏值，按遗漏值排序。</p>
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
          {/* 高遗漏和低遗漏 */}
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <Card className="border-orange-500">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <AlertCircle className="mr-2 h-5 w-5 text-orange-500" />
                  高遗漏号码
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="ml-2 h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="max-w-xs">
                          <p className="font-semibold mb-1">业务逻辑：</p>
                          <p className="text-sm mb-2">遗漏值最高的30%号码，这些号码长期未出现，可能即将回补。</p>
                          <p className="font-semibold mb-1">技术实现：</p>
                          <p className="text-sm">按遗漏值排序，选择前30%的号码作为高遗漏号码。</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysis.highOmission.map((num) => {
                    const data = analysis.redBalls.find(b => b.number === num)
                    return (
                      <Badge key={num} variant="outline" className="border-orange-500 text-orange-700">
                        {num} ({data?.omission}期)
                      </Badge>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-500">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Clock className="mr-2 h-5 w-5 text-green-500" />
                  低遗漏号码
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="ml-2 h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="max-w-xs">
                          <p className="font-semibold mb-1">业务逻辑：</p>
                          <p className="text-sm mb-2">遗漏值最低的30%号码，这些号码近期刚出现，可能不会很快再次出现。</p>
                          <p className="font-semibold mb-1">技术实现：</p>
                          <p className="text-sm">按遗漏值排序，选择后30%的号码作为低遗漏号码。</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysis.lowOmission.map((num) => {
                    const data = analysis.redBalls.find(b => b.number === num)
                    return (
                      <Badge key={num} variant="outline" className="border-green-500 text-green-700">
                        {num} ({data?.omission}期)
                      </Badge>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 详细数据 */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>红球遗漏统计</CardTitle>
                <CardDescription>
                  按遗漏值从高到低排序
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
                            analysis.highOmission.includes(item.number)
                              ? "bg-orange-500 text-white"
                              : analysis.lowOmission.includes(item.number)
                              ? "bg-green-500 text-white"
                              : "bg-gray-500 text-white"
                          }`}
                        >
                          {item.number}
                        </div>
                        <div>
                          <div className="text-sm font-medium">
                            遗漏 {item.omission} 期
                          </div>
                          <div className="text-xs text-muted-foreground">
                            最大遗漏 {item.maxOmission} 期
                          </div>
                        </div>
                      </div>
                      <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-orange-500 h-2 rounded-full"
                          style={{
                            width: `${Math.min(100, (item.omission / analysis.redBalls[0].omission) * 100)}%`,
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
                <CardTitle>蓝球遗漏统计</CardTitle>
                <CardDescription>
                  按遗漏值从高到低排序
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
                          <div className="text-sm font-medium">
                            遗漏 {item.omission} 期
                          </div>
                          <div className="text-xs text-muted-foreground">
                            最大遗漏 {item.maxOmission} 期
                          </div>
                        </div>
                      </div>
                      <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{
                            width: `${Math.min(100, (item.omission / analysis.blueBalls[0].omission) * 100)}%`,
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
            <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">还没有执行分析</h3>
            <p className="text-muted-foreground mb-4">
              点击"开始分析"按钮，系统将计算每个号码的遗漏值
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

