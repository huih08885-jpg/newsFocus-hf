"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, BarChart3, Info, Sparkles, ChevronDown, ChevronUp, Settings } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { PredictionHistoryTable } from "@/components/lottery/prediction-history-table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface PredictionResult {
  redBalls: string[]
  blueBall: string
  confidence: number
  strategy: string
  reasoning: string
  sources: string[]
}

interface PredictionConfig {
  periods: number
  numPredictions: number
  deterministic: boolean
  strategyWeights: {
    conservative: number
    balanced: number
    aggressive: number
  }
}

export function StatisticalPredict() {
  const [predictions, setPredictions] = useState<PredictionResult[]>([])
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<PredictionConfig>({
    periods: 100,
    numPredictions: 5,
    deterministic: false,
    strategyWeights: {
      conservative: 0.4,
      balanced: 0.4,
      aggressive: 0.2
    }
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [configLoaded, setConfigLoaded] = useState(false)
  const { toast } = useToast()

  // 加载用户配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/lottery/config?method=statistical')
        const result = await response.json()
        if (result.success && result.data.config) {
          setConfig({
            periods: result.data.config.periods || 100,
            numPredictions: result.data.config.numPredictions || 5,
            deterministic: result.data.config.deterministic || false,
            strategyWeights: result.data.config.strategyWeights || {
              conservative: 0.4,
              balanced: 0.4,
              aggressive: 0.2
            }
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

    if (config.numPredictions < 1 || config.numPredictions > 10) {
      toast({
        title: "参数错误",
        description: "预测组数必须在1-10之间",
        variant: "destructive",
      })
      return
    }

    // 验证策略权重总和
    const totalWeight = config.strategyWeights.conservative + 
                        config.strategyWeights.balanced + 
                        config.strategyWeights.aggressive
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      toast({
        title: "参数错误",
        description: "策略权重总和必须等于1.0",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/lottery/predict/statistical", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          periods: config.periods,
          numPredictions: config.numPredictions,
          deterministic: config.deterministic,
          strategyWeights: config.strategyWeights
        }),
      })

      const result = await response.json()

      if (result.success) {
        setPredictions(result.data.predictions)
        toast({
          title: "预测生成成功",
          description: `已生成 ${result.data.predictions.length} 组预测号码`,
        })
        // 刷新历史记录（通过重新加载页面或调用API）
        window.location.reload()
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
          <h1 className="text-2xl font-bold inline-block mr-3">统计分析预测</h1>
          <span className="text-sm text-muted-foreground">
            基于频率、遗漏、分布等统计分析，生成预测号码
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
          value={config.periods}
          onChange={(e) => setConfig({ ...config, periods: parseInt(e.target.value) || 100 })}
          className="w-32"
        />
        <span className="text-sm text-muted-foreground whitespace-nowrap">（建议100期）</span>
        <Label htmlFor="numPredictions" className="flex items-center gap-1 whitespace-nowrap ml-4">
          预测组数
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <div className="max-w-xs">
                  <p className="font-semibold mb-1">业务逻辑：</p>
                  <p className="text-sm mb-2">生成N组预测号码，每组包含6个红球和1个蓝球。</p>
                  <p className="font-semibold mb-1">技术实现：</p>
                  <p className="text-sm">根据不同的策略（保守型、平衡型、激进型）生成多组预测。</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Label>
        <Input
          id="numPredictions"
          type="number"
          min={1}
          max={10}
          value={config.numPredictions}
          onChange={(e) => setConfig({ ...config, numPredictions: parseInt(e.target.value) || 5 })}
          className="w-32"
        />
        <span className="text-sm text-muted-foreground whitespace-nowrap">（1-10组）</span>
        <Button
          onClick={generatePredictions}
          disabled={loading}
          className="min-w-[140px] ml-4"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <BarChart3 className="mr-2 h-4 w-4" />
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
              <div className="mt-4 space-y-4 pt-4 border-t">
                {/* 确定性模式 */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="deterministic" className="flex items-center gap-2">
                      确定性模式
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="max-w-xs">
                              <p className="font-semibold mb-1">业务逻辑：</p>
                              <p className="text-sm mb-2">启用后，相同的历史数据和参数会产生完全相同的预测结果，便于对比和验证。</p>
                              <p className="font-semibold mb-1">技术实现：</p>
                              <p className="text-sm">禁用随机数生成，使用确定性算法选择号码。</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      启用后，相同参数会产生相同结果
                    </p>
                  </div>
                  <Switch
                    id="deterministic"
                    checked={config.deterministic}
                    onCheckedChange={(checked) => setConfig({ ...config, deterministic: checked })}
                  />
                </div>

                {/* 策略权重配置 */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">
                    策略权重配置
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="inline ml-1 h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="max-w-xs">
                            <p className="font-semibold mb-1">业务逻辑：</p>
                            <p className="text-sm mb-2">调整不同策略（保守型、平衡型、激进型）在预测中的权重比例。</p>
                            <p className="font-semibold mb-1">技术实现：</p>
                            <p className="text-sm">权重总和必须等于1.0，系统会根据权重分配预测组数。</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <Label className="w-20 text-sm">保守型</Label>
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={config.strategyWeights.conservative}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setConfig({
                            ...config,
                            strategyWeights: {
                              ...config.strategyWeights,
                              conservative: val
                            }
                          })
                        }}
                        className="flex-1"
                      />
                      <span className="text-xs text-muted-foreground w-12">
                        {(config.strategyWeights.conservative * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Label className="w-20 text-sm">平衡型</Label>
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={config.strategyWeights.balanced}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setConfig({
                            ...config,
                            strategyWeights: {
                              ...config.strategyWeights,
                              balanced: val
                            }
                          })
                        }}
                        className="flex-1"
                      />
                      <span className="text-xs text-muted-foreground w-12">
                        {(config.strategyWeights.balanced * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Label className="w-20 text-sm">激进型</Label>
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={config.strategyWeights.aggressive}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setConfig({
                            ...config,
                            strategyWeights: {
                              ...config.strategyWeights,
                              aggressive: val
                            }
                          })
                        }}
                        className="flex-1"
                      />
                      <span className="text-xs text-muted-foreground w-12">
                        {(config.strategyWeights.aggressive * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      权重总和: {(
                        config.strategyWeights.conservative + 
                        config.strategyWeights.balanced + 
                        config.strategyWeights.aggressive
                      ).toFixed(2)} 
                      {Math.abs(
                        config.strategyWeights.conservative + 
                        config.strategyWeights.balanced + 
                        config.strategyWeights.aggressive - 1.0
                      ) > 0.01 && (
                        <span className="text-red-500 ml-2">（必须等于1.0）</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

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
            <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">还没有生成预测</h3>
            <p className="text-muted-foreground mb-4">
              点击"生成统计分析预测"按钮，系统将基于统计分析生成预测号码
            </p>
          </CardContent>
        </Card>
      )}

      {/* 历史预测记录 */}
      <PredictionHistoryTable 
        defaultMethod="statistical"
        title="历史预测记录"
        description="统计分析预测历史记录列表"
      />
    </div>
  )
}

