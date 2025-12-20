/**
 * 福利彩票AI预测服务（使用DeepSeek大模型）
 * 业务逻辑：使用大模型分析历史数据的复杂模式，生成预测建议
 * 技术实现：调用DeepSeek API，传入历史数据和统计分析结果，让AI进行深度分析
 */

import { logger } from '@/lib/utils/logger'
import { ComprehensiveAnalysis } from './lottery-analysis'

export interface AIPrediction {
  redBalls: string[]
  blueBall: string
  confidence: number
  reasoning: string
  strategy: string
}

export interface AIPredictionResult {
  predictions: AIPrediction[]
  analysis: string
  recommendations: string[]
}

export class LotteryAIPredictor {
  private apiKey: string
  private apiUrl: string = 'https://api.deepseek.com/v1/chat/completions'

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.DEEPSEEK_API_KEY || ''
    if (!this.apiKey) {
      logger.warn('DeepSeek API Key未配置，AI预测功能将不可用', 'LotteryAIPredictor')
    }
  }

  /**
   * 生成分析Prompt
   * 业务逻辑：将历史数据和统计分析结果组织成结构化的Prompt，让AI理解上下文
   * 技术实现：格式化数据为JSON，添加分析指令和输出格式要求
   */
  private generatePrompt(
    historyData: Array<{
      period: string
      date: Date
      redBalls: string[]
      blueBall: string
    }>,
    analysis: ComprehensiveAnalysis
  ): string {
    // 准备最近20期的详细数据
    const recentData = historyData.slice(-20).map(item => ({
      期号: item.period,
      日期: item.date.toISOString().split('T')[0],
      红球: item.redBalls,
      蓝球: item.blueBall
    }))

    // 准备统计分析摘要
    const analysisSummary = {
      频率分析: {
        热号: analysis.frequency.hotNumbers.slice(0, 10),
        冷号: analysis.frequency.coldNumbers.slice(0, 10),
        温号: analysis.frequency.warmNumbers.slice(0, 10)
      },
      遗漏分析: {
        高遗漏号码: analysis.omission.highOmission.slice(0, 10),
        低遗漏号码: analysis.omission.lowOmission.slice(0, 10)
      },
      分布分析: {
        区间分布: analysis.distribution.zoneDistribution,
        奇偶比: analysis.distribution.oddEvenRatio,
        大小比: analysis.distribution.sizeRatio,
        和值范围: analysis.distribution.sumRange,
        跨度范围: analysis.distribution.spanRange
      },
      模式分析: {
        连号频率: analysis.patterns.consecutiveNumbers.frequency,
        常见连号: analysis.patterns.consecutiveNumbers.patterns.slice(0, 5),
        常见组合: analysis.patterns.combinationPatterns.slice(0, 5)
      }
    }

    const prompt = `你是一位资深的彩票数据分析专家，擅长从历史数据中发现规律并做出预测。

## 历史数据（最近20期）
${JSON.stringify(recentData, null, 2)}

## 统计分析结果
${JSON.stringify(analysisSummary, null, 2)}

## 分析任务
请基于以上数据，进行深度分析并生成预测：

1. **模式识别**：识别历史数据中的隐藏规律和模式
2. **趋势分析**：分析号码出现的趋势（上升、下降、波动）
3. **概率评估**：评估各号码出现的概率
4. **综合判断**：综合考虑频率、遗漏、分布、模式等因素

## 预测要求
请生成5组预测号码，每组包含：
- 6个红球号码（01-33）
- 1个蓝球号码（01-16）
- 预测理由（基于哪些分析）
- 置信度（0-1之间的数值）
- 策略类型（保守型/平衡型/激进型）

## 输出格式
请以JSON格式输出，格式如下：
{
  "predictions": [
    {
      "redBalls": ["01", "05", "12", "18", "25", "31"],
      "blueBall": "08",
      "confidence": 0.75,
      "reasoning": "基于热号频率和遗漏回补分析...",
      "strategy": "平衡型"
    }
  ],
  "analysis": "综合分析说明...",
  "recommendations": ["建议1", "建议2"]
}

请确保：
1. 红球号码不重复，范围在01-33
2. 蓝球号码范围在01-16
3. 每组号码都有合理的预测理由
4. 置信度反映预测的可靠性`

    return prompt
  }

  /**
   * 使用DeepSeek API进行分析
   * 业务逻辑：调用大模型API，传入Prompt，获取AI分析结果
   * 技术实现：使用fetch调用DeepSeek API，处理响应和错误
   */
  async analyzeWithLLM(
    historyData: Array<{
      period: string
      date: Date
      redBalls: string[]
      blueBall: string
    }>,
    analysis: ComprehensiveAnalysis,
    options: {
      temperature?: number
      maxTokens?: number
    } = {}
  ): Promise<AIPredictionResult> {
    if (!this.apiKey) {
      throw new Error('DeepSeek API Key未配置，请在环境变量中设置 DEEPSEEK_API_KEY')
    }

    const prompt = this.generatePrompt(historyData, analysis)

    logger.info('调用DeepSeek API进行AI分析', 'LotteryAIPredictor', {
      historyCount: historyData.length,
      hasAnalysis: !!analysis
    })

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一位专业的彩票数据分析专家，擅长从历史数据中发现规律并做出合理的预测。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2000
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`DeepSeek API错误: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content

      if (!content) {
        throw new Error('DeepSeek API返回空内容')
      }

      // 解析JSON响应
      let result: AIPredictionResult
      try {
        // 尝试提取JSON（可能包含markdown代码块）
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                         content.match(/```\s*([\s\S]*?)\s*```/) ||
                         [null, content]
        const jsonStr = jsonMatch[1] || content
        result = JSON.parse(jsonStr)
      } catch (parseError) {
        logger.error('解析AI响应失败', parseError instanceof Error ? parseError : new Error(String(parseError)), 'LotteryAIPredictor', {
          content: content.substring(0, 500)
        })
        // 如果解析失败，返回默认结果
        result = this.generateFallbackPrediction(analysis)
      }

      // 验证和修正结果
      result = this.validateAndFixResult(result, analysis)

      logger.info('AI分析完成', 'LotteryAIPredictor', {
        predictionCount: result.predictions.length
      })

      return result

    } catch (error) {
      logger.error('DeepSeek API调用失败', error instanceof Error ? error : new Error(String(error)), 'LotteryAIPredictor')
      
      // 返回基于统计分析的备用预测
      return this.generateFallbackPrediction(analysis)
    }
  }

  /**
   * 验证和修正AI返回的结果
   * 业务逻辑：确保AI返回的号码符合规则（范围、数量、格式）
   * 技术实现：检查号码范围、数量、格式，自动修正错误
   */
  private validateAndFixResult(
    result: AIPredictionResult,
    analysis: ComprehensiveAnalysis
  ): AIPredictionResult {
    const validPredictions: AIPrediction[] = []

    result.predictions.forEach((pred, index) => {
      try {
        // 验证红球
        if (!Array.isArray(pred.redBalls) || pred.redBalls.length !== 6) {
          logger.warn(`预测 ${index + 1} 红球数量不正确，使用备用方案`, 'LotteryAIPredictor')
          pred.redBalls = this.generateRedBalls(analysis)
        } else {
          // 验证红球范围和格式
          const validRedBalls = pred.redBalls
            .map(b => {
              const num = parseInt(b)
              if (isNaN(num) || num < 1 || num > 33) return null
              return num.toString().padStart(2, '0')
            })
            .filter((b): b is string => b !== null)
            .filter((v, i, a) => a.indexOf(v) === i) // 去重

          if (validRedBalls.length !== 6) {
            logger.warn(`预测 ${index + 1} 红球验证失败，补充号码`, 'LotteryAIPredictor')
            pred.redBalls = this.generateRedBalls(analysis, validRedBalls)
          } else {
            pred.redBalls = validRedBalls.sort((a, b) => parseInt(a) - parseInt(b))
          }
        }

        // 验证蓝球
        const blueNum = parseInt(pred.blueBall)
        if (isNaN(blueNum) || blueNum < 1 || blueNum > 16) {
          logger.warn(`预测 ${index + 1} 蓝球无效，使用高频蓝球`, 'LotteryAIPredictor')
          pred.blueBall = analysis.frequency.blueBalls[0]?.number || '01'
        } else {
          pred.blueBall = blueNum.toString().padStart(2, '0')
        }

        // 验证置信度
        if (typeof pred.confidence !== 'number' || pred.confidence < 0 || pred.confidence > 1) {
          pred.confidence = 0.5
        }

        validPredictions.push(pred)
      } catch (error) {
        logger.error(`验证预测 ${index + 1} 失败`, error instanceof Error ? error : new Error(String(error)), 'LotteryAIPredictor')
      }
    })

    // 如果有效预测不足5个，补充
    while (validPredictions.length < 5) {
      validPredictions.push({
        redBalls: this.generateRedBalls(analysis),
        blueBall: analysis.frequency.blueBalls[validPredictions.length % analysis.frequency.blueBalls.length]?.number || '01',
        confidence: 0.5,
        reasoning: '基于统计分析生成的备用预测',
        strategy: '平衡型'
      })
    }

    return {
      predictions: validPredictions.slice(0, 5),
      analysis: result.analysis || '基于历史数据的统计分析',
      recommendations: result.recommendations || []
    }
  }

  /**
   * 生成红球号码（备用方案）
   * 业务逻辑：当AI预测失败时，基于统计分析生成合理的号码组合
   * 技术实现：结合热号、温号、遗漏分析，生成平衡的号码组合
   */
  private generateRedBalls(
    analysis: ComprehensiveAnalysis,
    existing: string[] = []
  ): string[] {
    const result = [...existing]
    const used = new Set(existing.map(b => parseInt(b)))

    // 策略：2个热号 + 2个温号 + 1个冷号 + 1个高遗漏
    const hot = analysis.frequency.hotNumbers.filter(b => !used.has(parseInt(b)))
    const warm = analysis.frequency.warmNumbers.filter(b => !used.has(parseInt(b)))
    const cold = analysis.frequency.coldNumbers.filter(b => !used.has(parseInt(b)))
    const highOmission = analysis.omission.highOmission.filter(b => !used.has(parseInt(b)))

    // 添加热号
    if (result.length < 6 && hot.length > 0) {
      result.push(hot[result.length % hot.length])
      used.add(parseInt(hot[result.length % hot.length]))
    }

    // 添加温号
    while (result.length < 4 && warm.length > 0) {
      const num = warm.find(b => !used.has(parseInt(b)))
      if (num) {
        result.push(num)
        used.add(parseInt(num))
      } else break
    }

    // 添加冷号
    if (result.length < 6 && cold.length > 0) {
      const num = cold.find(b => !used.has(parseInt(b)))
      if (num) {
        result.push(num)
        used.add(parseInt(num))
      }
    }

    // 添加高遗漏
    if (result.length < 6 && highOmission.length > 0) {
      const num = highOmission.find(b => !used.has(parseInt(b)))
      if (num) {
        result.push(num)
        used.add(parseInt(num))
      }
    }

    // 如果还不够，随机补充
    while (result.length < 6) {
      const num = Math.floor(Math.random() * 33) + 1
      const numStr = num.toString().padStart(2, '0')
      if (!used.has(num)) {
        result.push(numStr)
        used.add(num)
      }
    }

    return result.slice(0, 6).sort((a, b) => parseInt(a) - parseInt(b))
  }

  /**
   * 生成备用预测（当AI调用失败时）
   * 业务逻辑：基于统计分析生成合理的预测，确保系统可用性
   * 技术实现：使用频率分析和遗漏分析生成5组预测
   */
  generateFallbackPrediction(analysis: ComprehensiveAnalysis): AIPredictionResult {
    logger.info('使用备用预测方案（基于统计分析）', 'LotteryAIPredictor')

    const predictions: AIPrediction[] = []
    const strategies = ['保守型', '平衡型', '激进型', '平衡型', '保守型']

    for (let i = 0; i < 5; i++) {
      const strategy = strategies[i]
      let redBalls: string[]

      if (strategy === '保守型') {
        // 主要选择热号
        redBalls = this.generateRedBallsFromHot(analysis)
      } else if (strategy === '激进型') {
        // 主要选择冷号和高遗漏
        redBalls = this.generateRedBallsFromCold(analysis)
      } else {
        // 平衡型：热号+温号+冷号
        redBalls = this.generateRedBalls(analysis)
      }

      const blueBall = analysis.frequency.blueBalls[i % analysis.frequency.blueBalls.length]?.number || '01'

      predictions.push({
        redBalls,
        blueBall,
        confidence: 0.6,
        reasoning: `基于${strategy}策略，结合频率分析和遗漏分析生成`,
        strategy
      })
    }

    return {
      predictions,
      analysis: '基于统计分析的备用预测（AI服务不可用时使用）',
      recommendations: [
        '建议关注热号和温号的组合',
        '适当考虑高遗漏号码的回补',
        '注意号码的分布平衡'
      ]
    }
  }

  private generateRedBallsFromHot(analysis: ComprehensiveAnalysis): string[] {
    const hot = [...analysis.frequency.hotNumbers]
    const result: string[] = []
    const used = new Set<number>()

    // 选择6个热号
    for (let i = 0; i < 6 && hot.length > 0; i++) {
      const num = parseInt(hot[i % hot.length])
      if (!used.has(num)) {
        result.push(hot[i % hot.length])
        used.add(num)
      }
    }

    // 如果不够，补充温号
    while (result.length < 6) {
      const warm = analysis.frequency.warmNumbers.find(b => !used.has(parseInt(b)))
      if (warm) {
        result.push(warm)
        used.add(parseInt(warm))
      } else break
    }

    return result.slice(0, 6).sort((a, b) => parseInt(a) - parseInt(b))
  }

  private generateRedBallsFromCold(analysis: ComprehensiveAnalysis): string[] {
    const cold = [...analysis.frequency.coldNumbers]
    const highOmission = [...analysis.omission.highOmission]
    const result: string[] = []
    const used = new Set<number>()

    // 选择冷号和高遗漏
    for (let i = 0; i < 3 && cold.length > 0; i++) {
      const num = parseInt(cold[i % cold.length])
      if (!used.has(num)) {
        result.push(cold[i % cold.length])
        used.add(num)
      }
    }

    for (let i = 0; i < 3 && highOmission.length > 0; i++) {
      const num = parseInt(highOmission[i % highOmission.length])
      if (!used.has(num)) {
        result.push(highOmission[i % highOmission.length])
        used.add(num)
      }
    }

    return result.slice(0, 6).sort((a, b) => parseInt(a) - parseInt(b))
  }
}

