"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, TrendingUp, Info, Sparkles, ChevronDown, ChevronUp, Settings } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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

interface MLConfig {
  periods: number
  featureWeights: {
    frequency: number
    omission: number
    hot: number
    cold: number
    highOmission: number
  }
}

export function MLPredict() {
  const [predictions, setPredictions] = useState<PredictionResult[]>([])
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<MLConfig>({
    periods: 100,
    featureWeights: {
      frequency: 0.3,
      omission: 0.2,
      hot: 0.2,
      cold: 0.15,
      highOmission: 0.15
    }
  })
  const [featureImportance, setFeatureImportance] = useState<Record<string, number> | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [configLoaded, setConfigLoaded] = useState(false)
  const { toast } = useToast()

  // 加载用户配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/lottery/config?method=ml')
        const result = await response.json()
        if (result.success && result.data.config) {
          setConfig({
            periods: result.data.config.periods || 100,
            featureWeights: result.data.config.featureWeights || {
              frequency: 0.3,
              omission: 0.2,
              hot: 0.2,
              cold: 0.15,
              highOmission: 0.15
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

    // 验证特征权重总和
    const totalWeight = Object.values(config.featureWeights).reduce((sum, w) => sum + w, 0)
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      toast({
        title: "参数错误",
        description: "特征权重总和必须等于1.0",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/lottery/predict/ml", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          periods: config.periods,
          featureWeights: config.featureWeights,
          saveConfig: true // 保存配置
        }),
      })

      const result = await response.json()

      if (result.success) {
        setPredictions(result.data.predictions)
        setFeatureImportance(result.data.analysis?.ml?.featureImportance || null)
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
          <h1 className="text-2xl font-bold inline-block mr-3">机器学习预测</h1>
          <span className="text-sm text-muted-foreground">
            使用机器学习模型计算每个号码的出现概率，生成预测号码
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
                  <p className="text-sm mb-2">使用最近N期的历史数据，提取特征并训练模型。</p>
                  <p className="font-semibold mb-1">技术实现：</p>
                  <p className="text-sm">提取频率、遗漏、分布等特征，使用加权评分模型计算概率，选择概率较高的号码组合。</p>
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
              <div className="mt-4 space-y-4 pt-4 border-t">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="frequency">
                      频率权重
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="inline ml-1 h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="max-w-xs">
                              <p className="font-semibold mb-1">业务逻辑：</p>
                              <p className="text-sm mb-2">频率特征在预测中的权重，值越高，频率越重要。</p>
                              <p className="font-semibold mb-1">技术实现：</p>
                              <p className="text-sm">用于计算号码出现概率的权重参数，所有权重之和应为1.0。</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="frequency"
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={config.featureWeights.frequency}
                      onChange={(e) => setConfig({
                        ...config,
                        featureWeights: {
                          ...config.featureWeights,
                          frequency: parseFloat(e.target.value) || 0.3
                        }
                      })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="omission">
                      遗漏权重
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="inline ml-1 h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="max-w-xs">
                              <p className="font-semibold mb-1">业务逻辑：</p>
                              <p className="text-sm mb-2">遗漏特征在预测中的权重，值越高，遗漏越重要。</p>
                              <p className="font-semibold mb-1">技术实现：</p>
                              <p className="text-sm">用于计算号码出现概率的权重参数，所有权重之和应为1.0。</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="omission"
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={config.featureWeights.omission}
                      onChange={(e) => setConfig({
                        ...config,
                        featureWeights: {
                          ...config.featureWeights,
                          omission: parseFloat(e.target.value) || 0.2
                        }
                      })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hot">
                      热号权重
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="inline ml-1 h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="max-w-xs">
                              <p className="font-semibold mb-1">业务逻辑：</p>
                              <p className="text-sm mb-2">热号特征在预测中的权重，值越高，热号越重要。</p>
                              <p className="font-semibold mb-1">技术实现：</p>
                              <p className="text-sm">用于计算号码出现概率的权重参数，所有权重之和应为1.0。</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="hot"
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={config.featureWeights.hot}
                      onChange={(e) => setConfig({
                        ...config,
                        featureWeights: {
                          ...config.featureWeights,
                          hot: parseFloat(e.target.value) || 0.2
                        }
                      })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cold">
                      冷号权重
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="inline ml-1 h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="max-w-xs">
                              <p className="font-semibold mb-1">业务逻辑：</p>
                              <p className="text-sm mb-2">冷号特征在预测中的权重，值越高，冷号越重要。</p>
                              <p className="font-semibold mb-1">技术实现：</p>
                              <p className="text-sm">用于计算号码出现概率的权重参数，所有权重之和应为1.0。</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="cold"
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={config.featureWeights.cold}
                      onChange={(e) => setConfig({
                        ...config,
                        featureWeights: {
                          ...config.featureWeights,
                          cold: parseFloat(e.target.value) || 0.15
                        }
                      })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="highOmission">
                      高遗漏权重
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="inline ml-1 h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="max-w-xs">
                              <p className="font-semibold mb-1">业务逻辑：</p>
                              <p className="text-sm mb-2">高遗漏特征在预测中的权重，值越高，高遗漏越重要。</p>
                              <p className="font-semibold mb-1">技术实现：</p>
                              <p className="text-sm">用于计算号码出现概率的权重参数，所有权重之和应为1.0。</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="highOmission"
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={config.featureWeights.highOmission}
                      onChange={(e) => setConfig({
                        ...config,
                        featureWeights: {
                          ...config.featureWeights,
                          highOmission: parseFloat(e.target.value) || 0.15
                        }
                      })}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* 特征重要性 */}
      {featureImportance && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>特征重要性</CardTitle>
            <CardDescription>
              机器学习模型使用的特征及其权重
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(featureImportance).map(([feature, importance]) => (
                <div key={feature} className="flex items-center justify-between p-2 rounded border">
                  <span className="text-sm font-medium">
                    {feature === 'frequency' ? '频率' :
                     feature === 'omission' ? '遗漏' :
                     feature === 'hot' ? '热号' :
                     feature === 'cold' ? '冷号' :
                     feature === 'highOmission' ? '高遗漏' : feature}
                  </span>
                  <Badge variant="outline">
                    {(importance * 100).toFixed(0)}%
                  </Badge>
                </div>
              ))}
            </div>
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
            <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">还没有生成预测</h3>
            <p className="text-muted-foreground mb-4">
              点击"生成ML预测"按钮，系统将使用机器学习模型生成预测号码
            </p>
          </CardContent>
        </Card>
      )}

      {/* 历史预测记录 */}
      <PredictionHistoryTable 
        defaultMethod="ml"
        title="历史预测记录"
        description="机器学习预测历史记录列表"
      />
    </div>
  )
}

