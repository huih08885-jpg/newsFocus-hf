/**
 * 情感分析服务
 * 支持多种情感分析API（百度AI、腾讯云、本地模型等）
 */

export type SentimentLabel = 'positive' | 'negative' | 'neutral'
export type SentimentProvider = 'baidu' | 'tencent' | 'local' | 'openai'

export interface SentimentResult {
  label: SentimentLabel
  score: number // 0-1之间的分数，越高表示该情感越强烈
  confidence?: number // 置信度
}

export interface SentimentConfig {
  provider: SentimentProvider
  apiKey?: string
  apiSecret?: string
  endpoint?: string
}

/**
 * 情感分析服务类
 */
export class SentimentService {
  private config: SentimentConfig

  constructor(config?: Partial<SentimentConfig>) {
    this.config = {
      provider: (process.env.SENTIMENT_PROVIDER as SentimentProvider) || 'local',
      apiKey: process.env.SENTIMENT_API_KEY,
      apiSecret: process.env.SENTIMENT_API_SECRET,
      endpoint: process.env.SENTIMENT_ENDPOINT,
      ...config,
    }
  }

  /**
   * 分析文本情感
   */
  async analyzeSentiment(text: string): Promise<SentimentResult> {
    if (!text || text.trim().length === 0) {
      return {
        label: 'neutral',
        score: 0.5,
        confidence: 0,
      }
    }

    try {
      switch (this.config.provider) {
        case 'baidu':
          return await this.analyzeWithBaidu(text)
        case 'tencent':
          return await this.analyzeWithTencent(text)
        case 'openai':
          return await this.analyzeWithOpenAI(text)
        case 'local':
        default:
          return await this.analyzeWithLocal(text)
      }
    } catch (error) {
      console.error('情感分析失败:', error)
      // 失败时返回中性
      return {
        label: 'neutral',
        score: 0.5,
        confidence: 0,
      }
    }
  }

  /**
   * 批量分析文本情感
   */
  async analyzeBatch(texts: string[]): Promise<SentimentResult[]> {
    // 对于批量分析，可以并行处理或使用批量API
    return Promise.all(texts.map((text) => this.analyzeSentiment(text)))
  }

  /**
   * 使用本地规则分析情感（无需API）
   * 基于关键词匹配的简单情感分析
   */
  private async analyzeWithLocal(text: string): Promise<SentimentResult> {
    const textLower = text.toLowerCase()

    // 正面关键词
    const positiveKeywords = [
      '好', '棒', '优秀', '出色', '成功', '胜利', '突破', '创新', '领先',
      '增长', '提升', '改善', '优化', '完善', '进步', '发展', '繁荣',
      '好评', '点赞', '支持', '认可', '赞扬', '表扬', '鼓励',
      'good', 'great', 'excellent', 'amazing', 'wonderful', 'success',
      'positive', 'improve', 'increase', 'growth', 'win', 'victory',
    ]

    // 负面关键词
    const negativeKeywords = [
      '坏', '差', '失败', '错误', '问题', '困难', '危机', '下降', '下跌',
      '亏损', '损失', '事故', '灾难', '冲突', '争议', '批评', '质疑',
      '负面', '不利', '困难', '挑战', '风险', '威胁', '警告',
      'bad', 'poor', 'fail', 'error', 'problem', 'crisis', 'decline',
      'negative', 'loss', 'accident', 'disaster', 'conflict', 'criticism',
    ]

    let positiveCount = 0
    let negativeCount = 0

    for (const keyword of positiveKeywords) {
      if (textLower.includes(keyword)) {
        positiveCount++
      }
    }

    for (const keyword of negativeKeywords) {
      if (textLower.includes(keyword)) {
        negativeCount++
      }
    }

    // 计算情感分数
    const totalKeywords = positiveCount + negativeCount
    if (totalKeywords === 0) {
      return {
        label: 'neutral',
        score: 0.5,
        confidence: 0.3,
      }
    }

    const positiveRatio = positiveCount / totalKeywords
    const negativeRatio = negativeCount / totalKeywords

    if (positiveRatio > negativeRatio && positiveRatio > 0.6) {
      return {
        label: 'positive',
        score: positiveRatio,
        confidence: Math.min(positiveRatio, 0.9),
      }
    } else if (negativeRatio > positiveRatio && negativeRatio > 0.6) {
      return {
        label: 'negative',
        score: 1 - negativeRatio, // 负面情感分数越低
        confidence: Math.min(negativeRatio, 0.9),
      }
    } else {
      return {
        label: 'neutral',
        score: 0.5,
        confidence: Math.max(positiveRatio, negativeRatio),
      }
    }
  }

  /**
   * 使用百度AI情感分析
   */
  private async analyzeWithBaidu(text: string): Promise<SentimentResult> {
    if (!this.config.apiKey || !this.config.apiSecret) {
      console.warn('百度AI配置缺失，使用本地分析')
      return this.analyzeWithLocal(text)
    }

    // TODO: 实现百度AI情感分析API调用
    // 需要先获取access_token，然后调用情感分析API
    // 参考：https://ai.baidu.com/ai-doc/NLP/zk6z52hds
    
    // 临时使用本地分析
    return this.analyzeWithLocal(text)
  }

  /**
   * 使用腾讯云NLP情感分析
   */
  private async analyzeWithTencent(text: string): Promise<SentimentResult> {
    if (!this.config.apiKey || !this.config.apiSecret) {
      console.warn('腾讯云配置缺失，使用本地分析')
      return this.analyzeWithLocal(text)
    }

    // TODO: 实现腾讯云NLP情感分析API调用
    // 参考：https://cloud.tencent.com/document/product/271/35486
    
    // 临时使用本地分析
    return this.analyzeWithLocal(text)
  }

  /**
   * 使用OpenAI情感分析
   */
  private async analyzeWithOpenAI(text: string): Promise<SentimentResult> {
    if (!this.config.apiKey) {
      console.warn('OpenAI配置缺失，使用本地分析')
      return this.analyzeWithLocal(text)
    }

    // TODO: 实现OpenAI情感分析
    // 可以使用GPT模型进行情感分析
    
    // 临时使用本地分析
    return this.analyzeWithLocal(text)
  }

  /**
   * 判断是否为负面情感
   */
  isNegative(result: SentimentResult, threshold: number = 0.6): boolean {
    return result.label === 'negative' && result.score < threshold
  }

  /**
   * 判断是否为正面情感
   */
  isPositive(result: SentimentResult, threshold: number = 0.6): boolean {
    return result.label === 'positive' && result.score > threshold
  }
}

