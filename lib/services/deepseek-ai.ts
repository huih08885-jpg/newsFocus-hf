/**
 * DeepSeek AI API 集成服务
 * 用于分析 HTML 结构，生成爬虫配置
 */

export interface DeepSeekAnalysisRequest {
  url: string
  html: string
}

export interface DeepSeekAnalysisResponse {
  success: boolean
  config?: {
    list: {
      url: string
      itemSelector: string
      fields: {
        title: {
          selector: string
          attribute?: string
        }
        url?: {
          selector: string
          attribute?: string
        }
        publishedAt?: {
          selector: string
          attribute?: string
        }
        summary?: {
          selector: string
          attribute?: string
        }
      }
    }
  }
  error?: string
}

export class DeepSeekAIService {
  private apiKey: string
  private apiUrl = 'https://api.deepseek.com/v1/chat/completions'

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || ''
    if (!this.apiKey) {
      console.warn('[DeepSeekAI] DEEPSEEK_API_KEY not configured')
    }
  }

  /**
   * 分析 HTML 结构，生成爬虫配置
   */
  async analyzeHtmlStructure(request: DeepSeekAnalysisRequest): Promise<DeepSeekAnalysisResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'DeepSeek API key not configured',
      }
    }

    try {
      const prompt = this.buildAnalysisPrompt(request.url, request.html)
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的网页爬虫配置专家。请分析网页的HTML结构，提取新闻列表的爬虫配置。返回JSON格式的配置，不要包含任何解释文字。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[DeepSeekAI] API error:', response.status, errorText)
        return {
          success: false,
          error: `API request failed: ${response.status}`,
        }
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        return {
          success: false,
          error: 'No response content from DeepSeek',
        }
      }

      // 尝试提取 JSON（可能包含 markdown 代码块）
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/)
      const jsonStr = jsonMatch ? jsonMatch[1] : content

      try {
        const config = JSON.parse(jsonStr)
        return {
          success: true,
          config: this.validateAndNormalizeConfig(config),
        }
      } catch (parseError) {
        console.error('[DeepSeekAI] JSON parse error:', parseError)
        console.error('[DeepSeekAI] Content:', content)
        return {
          success: false,
          error: 'Failed to parse JSON response',
        }
      }
    } catch (error) {
      console.error('[DeepSeekAI] Error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * 构建分析 Prompt
   */
  private buildAnalysisPrompt(url: string, html: string): string {
    // 限制 HTML 长度，避免超出 token 限制
    const maxHtmlLength = 50000
    const truncatedHtml = html.length > maxHtmlLength 
      ? html.substring(0, maxHtmlLength) + '\n... (truncated)'
      : html

    return `请分析以下网页的HTML结构，提取新闻列表的爬虫配置。

网页URL: ${url}

网页HTML:
${truncatedHtml}

请分析并返回JSON格式的爬虫配置，必须包含以下字段：
1. list.url: 列表页URL（通常是当前URL或相对路径）
2. list.itemSelector: 新闻项的选择器（CSS选择器，如 ".news-item" 或 "article"）
3. list.fields.title.selector: 标题选择器（相对于itemSelector）
4. list.fields.title.attribute: 属性名（通常是 "text" 或 "innerText"，如果是属性则填写属性名如 "title"）
5. list.fields.url.selector: URL选择器（相对于itemSelector）
6. list.fields.url.attribute: 属性名（通常是 "href"）

可选字段：
- list.fields.publishedAt.selector: 发布时间选择器
- list.fields.publishedAt.attribute: 属性名（通常是 "text" 或 "datetime"）
- list.fields.summary.selector: 摘要选择器
- list.fields.summary.attribute: 属性名（通常是 "text"）

返回格式示例：
{
  "list": {
    "url": "${url}",
    "itemSelector": ".news-item",
    "fields": {
      "title": {
        "selector": "h3 a",
        "attribute": "text"
      },
      "url": {
        "selector": "h3 a",
        "attribute": "href"
      },
      "publishedAt": {
        "selector": ".date",
        "attribute": "text"
      },
      "summary": {
        "selector": ".summary",
        "attribute": "text"
      }
    }
  }
}

注意：
- 选择器要尽量精确，避免匹配到导航栏、侧边栏等无关内容
- 如果URL是相对路径，需要确保可以转换为绝对路径
- 如果找不到某些字段，可以省略，但title和url是必需的`
  }

  /**
   * 验证和规范化配置
   */
  private validateAndNormalizeConfig(config: any): any {
    if (!config.list) {
      throw new Error('Missing list configuration')
    }

    if (!config.list.itemSelector) {
      throw new Error('Missing itemSelector')
    }

    if (!config.list.fields?.title) {
      throw new Error('Missing title field configuration')
    }

    // 规范化配置格式
    const normalized = {
      type: 'html',
      list: {
        url: config.list.url || '',
        itemSelector: config.list.itemSelector,
        fields: {
          title: {
            selector: config.list.fields.title.selector || 'a',
            attribute: config.list.fields.title.attribute || 'text',
          },
          url: config.list.fields.url ? {
            selector: config.list.fields.url.selector || 'a',
            attribute: config.list.fields.url.attribute || 'href',
          } : undefined,
          publishedAt: config.list.fields.publishedAt ? {
            selector: config.list.fields.publishedAt.selector,
            attribute: config.list.fields.publishedAt.attribute || 'text',
          } : undefined,
          summary: config.list.fields.summary ? {
            selector: config.list.fields.summary.selector,
            attribute: config.list.fields.summary.attribute || 'text',
          } : undefined,
        },
      },
    }

    return normalized
  }

  /**
   * 分析内容（用于生成个人消化建议、趋势分析、商情分析等）
   */
  async analyzeContent(
    type: 'personal' | 'trend' | 'business',
    corpus: string,
    customPrompt?: string
  ): Promise<{
    success: boolean
    result?: any
    error?: string
    tokenUsage?: number
    tokenDetails?: {
      prompt: number
      completion: number
      total: number
    }
  }> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'DeepSeek API key not configured',
      }
    }

    try {
      const prompt = customPrompt || this.buildContentAnalysisPrompt(type, corpus)
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(type),
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[DeepSeekAI] API error:', response.status, errorText)
        return {
          success: false,
          error: `API request failed: ${response.status}`,
        }
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      const usage = data.usage

      if (!content) {
        return {
          success: false,
          error: 'No response content from DeepSeek',
        }
      }

      return {
        success: true,
        result: {
          content,
          raw: data,
        },
        tokenUsage: usage?.total_tokens || 0,
        tokenDetails: usage ? {
          prompt: usage.prompt_tokens || 0,
          completion: usage.completion_tokens || 0,
          total: usage.total_tokens || 0,
        } : undefined,
      }
    } catch (error) {
      console.error('[DeepSeekAI] Error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * 获取系统 Prompt
   */
  private getSystemPrompt(type: 'personal' | 'trend' | 'business'): string {
    switch (type) {
      case 'personal':
        return '你是一位知识管理专家，擅长从大量信息中提取核心要点，并为用户提供学习建议。请以结构化的方式输出分析结果，使用 Markdown 格式。'
      case 'trend':
        return '你是一位趋势分析专家，擅长分析时间序列数据，识别趋势变化，并预测未来发展方向。请以结构化的方式输出分析结果，使用 Markdown 格式。'
      case 'business':
        return '你是一位商业情报分析专家，擅长从信息中识别商业机会、风险提示和竞争态势。请以结构化的方式输出分析结果，使用 Markdown 格式。'
      default:
        return '你是一位专业的内容分析专家。请以结构化的方式输出分析结果，使用 Markdown 格式。'
    }
  }

  /**
   * 构建内容分析 Prompt
   */
  private buildContentAnalysisPrompt(type: 'personal' | 'trend' | 'business', corpus: string): string {
    // 限制语料长度，避免超出 token 限制
    const maxCorpusLength = 50000
    const truncatedCorpus = corpus.length > maxCorpusLength 
      ? corpus.substring(0, maxCorpusLength) + '\n\n... (内容已截断，仅显示前部分)'
      : corpus

    switch (type) {
      case 'personal':
        return `请分析以下新闻语料，为用户提供个人消化吸收建议。

语料内容：
${truncatedCorpus}

请提供以下内容：
1. **核心知识点**：提取 3-5 个关键概念或要点
2. **知识结构**：这些知识点之间的关系
3. **学习建议**：如何系统学习这些知识（学习路径、学习方法）
4. **相关资源**：推荐相关书籍、课程、网站等学习资源
5. **实践建议**：如何将这些知识应用到实际工作中

请以结构化的方式输出，使用 Markdown 格式，确保内容清晰易读。`

      case 'trend':
        return `请分析以下时间序列新闻数据，提供事态趋势分析。

时间序列数据：
${truncatedCorpus}

请提供以下内容：
1. **趋势判断**：整体趋势是上升、下降还是波动？为什么？
2. **关键节点**：列出重要事件的时间线和影响
3. **影响因素**：导致趋势变化的主要原因
4. **未来预测**：基于当前趋势，预测未来 3 个月的发展方向
5. **风险提示**：需要注意的风险点

请以结构化的方式输出，使用 Markdown 格式，包含时间线和图表描述。`

      case 'business':
        return `请分析以下商业相关信息，提供商情价值情报分析。

信息内容：
${truncatedCorpus}

请提供以下内容：
1. **商业机会**：识别出的潜在商业机会和市场空白
2. **风险提示**：需要注意的商业风险和挑战
3. **竞争分析**：市场竞争态势和主要参与者
4. **市场趋势**：行业发展趋势和未来方向
5. **行动建议**：基于分析的商业行动建议

请以结构化的方式输出，使用 Markdown 格式，确保分析深入且具有可操作性。`

      default:
        return `请分析以下内容：

${truncatedCorpus}

请提供详细的分析报告，使用 Markdown 格式。`
    }
  }
}

export const deepSeekAI = new DeepSeekAIService()


