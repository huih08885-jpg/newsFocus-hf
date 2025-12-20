"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Brain, Info, Sparkles, ChevronDown, ChevronUp, Settings } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"
import { PredictionHistoryTable } from "@/components/lottery/prediction-history-table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"

interface PredictionResult {
  redBalls: string[]
  blueBall: string
  confidence: number
  strategy: string
  reasoning: string
  sources: string[]
}

interface AIConfig {
  periods: number
  temperature: number
  maxTokens: number
  useFallback: boolean
}

export function AIPredict() {
  const [predictions, setPredictions] = useState<PredictionResult[]>([])
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<AIConfig>({
    periods: 100,
    temperature: 0.7,
    maxTokens: 2000,
    useFallback: true
  })
  const [analysis, setAnalysis] = useState<string>("")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [configLoaded, setConfigLoaded] = useState(false)
  const { toast } = useToast()

  // 加载用户配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/lottery/config?method=ai')
        const result = await response.json()
        if (result.success && result.data.config) {
          setConfig({
            periods: result.data.config.periods || 100,
            temperature: result.data.config.temperature || 0.7,
            maxTokens: result.data.config.maxTokens || 2000,
            useFallback: result.data.config.useFallback !== undefined ? result.data.config.useFallback : true
          })
        }
      } catch (error) {
        console.error('加载配置失败:', error)
      } finally {
        setConfigLoaded(true)
      }
    }
    loadConfig()
  }, [])

  const generatePredictions = async () => {
    if (config.periods < 10) {
      toast({
        title: "参数错误",
        description: "历史数据期数不能少于10期",
        variant: "destructive",
      })
      return
    }

    if (config.temperature < 0 || config.temperature > 2) {
      toast({
        title: "参数错误",
        description: "Temperature必须在0-2之间",
        variant: "destructive",
      })
      return
    }

    if (config.maxTokens < 100 || config.maxTokens > 4000) {
      toast({
        title: "参数错误",
        description: "Max Tokens必须在100-4000之间",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/lottery/predict/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          periods: config.periods,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          useFallback: config.useFallback,
          saveConfig: true // 保存配置
        }),
      })

      const result = await response.json()

      if (result.success) {
        setPredictions(result.data.predictions)
        setAnalysis(result.data.analysis?.ai?.analysis || "")
        toast({
          title: "预测生成成功",
          description: `已生成 ${result.data.predictions.length} 组预测号码`,
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
          title: "预测生成失败",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('生成预测失败:', error)
      let errorMessage = "未知错误"
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = (error as any).message || JSON.stringify(error)
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      toast({
        title: "预测生成失败",
        description: errorMessage,
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

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-green-600 dark:text-green-400'
    if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  return (
    <div>
      {/* 第一行：标题和副标题 */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold inline-block mr-3">AI分析预测</h1>
          <span className="text-sm text-muted-foreground">
            使用DeepSeek大模型分析历史数据中的复杂模式，生成AI预测
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
                  <p className="text-sm mb-2">使用最近N期的历史数据，让AI分析其中的模式和规律。</p>
                  <p className="font-semibold mb-1">技术实现：</p>
                  <p className="text-sm">调用DeepSeek API，传入历史数据和统计分析结果，让AI进行深度分析和推理。</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Label>
        <Input
          id="periods"
          type="number"
          min={10}
          value={config.periods}
          onChange={(e) => setConfig({ ...config, periods: parseInt(e.target.value) || 100 })}
          className="w-32"
        />
        <span className="text-sm text-muted-foreground whitespace-nowrap">（建议100期）</span>
        <Button
          onClick={generatePredictions}
          disabled={loading}
          className="min-w-[120px] ml-4"
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

      {/* 高级配置 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  高级配置
                </span>
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <div>
                  <Label htmlFor="temperature">
                    Temperature
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="inline ml-1 h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="max-w-xs">
                            <p className="font-semibold mb-1">业务逻辑：</p>
                            <p className="text-sm mb-2">控制AI生成的随机性，值越高越随机，值越低越确定。</p>
                            <p className="font-semibold mb-1">技术实现：</p>
                            <p className="text-sm">传递给DeepSeek API的temperature参数，范围0-2，默认0.7。</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="temperature"
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={config.temperature}
                    onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) || 0.7 })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="maxTokens">
                    Max Tokens
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="inline ml-1 h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="max-w-xs">
                            <p className="font-semibold mb-1">业务逻辑：</p>
                            <p className="text-sm mb-2">限制AI生成的最大token数，控制响应长度。</p>
                            <p className="font-semibold mb-1">技术实现：</p>
                            <p className="text-sm">传递给DeepSeek API的max_tokens参数，范围100-4000，默认2000。</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    min={100}
                    max={4000}
                    value={config.maxTokens}
                    onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) || 2000 })}
                    className="mt-2"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="useFallback"
                    checked={config.useFallback}
                    onCheckedChange={(checked) => setConfig({ ...config, useFallback: checked })}
                  />
                  <Label htmlFor="useFallback" className="flex items-center gap-1">
                    使用备用预测
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="max-w-xs">
                            <p className="font-semibold mb-1">业务逻辑：</p>
                            <p className="text-sm mb-2">当AI API调用失败时，使用基于统计分析的备用预测方法。</p>
                            <p className="font-semibold mb-1">技术实现：</p>
                            <p className="text-sm">如果DeepSeek API调用失败，自动切换到统计分析预测，确保总能生成预测结果。</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* AI分析结果 */}
      {analysis && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>AI分析说明</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysis}</p>
          </CardContent>
        </Card>
      )}

      {/* 预测结果 */}
      {predictions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">预测结果</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {predictions.map((pred, index) => (
              <Card key={index} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">第 {index + 1} 组</CardTitle>
                    <Badge className={getStrategyColor(pred.strategy)}>
                      {pred.strategy}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* 红球 */}
                  <div className="mb-4">
                    <Label className="text-sm text-muted-foreground mb-2 block">红球</Label>
                    <div className="flex flex-wrap gap-2">
                      {pred.redBalls.map((ball) => (
                        <div
                          key={ball}
                          className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm"
                        >
                          {ball}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 蓝球 */}
                  <div className="mb-4">
                    <Label className="text-sm text-muted-foreground mb-2 block">蓝球</Label>
                    <div className="flex gap-2">
                      <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                        {pred.blueBall}
                      </div>
                    </div>
                  </div>

                  {/* 置信度 */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-sm text-muted-foreground">置信度</Label>
                      <span className={`text-sm font-semibold ${getConfidenceColor(pred.confidence)}`}>
                        {(pred.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${pred.confidence * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* 预测理由 */}
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">预测理由</Label>
                    <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800 p-2 rounded">
                      {pred.reasoning}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {predictions.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">还没有生成预测</h3>
            <p className="text-muted-foreground mb-4">
              点击"生成AI预测"按钮，系统将使用DeepSeek大模型分析历史数据并生成预测号码
            </p>
          </CardContent>
        </Card>
      )}

      {/* 历史预测记录 */}
      <PredictionHistoryTable 
        defaultMethod="ai"
        title="历史预测记录"
        description="AI分析预测历史记录列表"
      />
    </div>
  )
}

