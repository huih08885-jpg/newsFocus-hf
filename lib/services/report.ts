interface ReportData {
  reportType: 'daily' | 'current' | 'incremental'
  stats: Array<{
    keywordGroup: {
      id: string
      name?: string | null
    }
    count: number
    percentage: number
    newsItems: Array<{
      newsItem: {
        id: string
        title: string
        url?: string | null
        mobileUrl?: string | null
        platform: {
          name: string
        }
        crawledAt: Date
      }
      weight: number
      isNew: boolean
    }>
  }>
  newItems: Array<{
    id: string
    title: string
    platform: {
      name: string
    }
    rank: number
    url?: string | null
    mobileUrl?: string | null
  }>
  totalCount: number
  matchedCount: number
  generatedAt: Date
}

export class ReportService {
  /**
   * 生成HTML报告
   */
  generateHTMLReport(data: ReportData): string {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>新闻热点报告 - ${data.reportType === 'daily' ? '当日汇总' : data.reportType === 'current' ? '当前榜单' : '增量监控'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #3b82f6;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header-info {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      color: #666;
      font-size: 14px;
    }
    .stats-section {
      margin-bottom: 40px;
    }
    .stats-section h2 {
      color: #333;
      font-size: 20px;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    .keyword-group {
      margin-bottom: 30px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
      border-left: 4px solid #3b82f6;
    }
    .keyword-group-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    .keyword-group-name {
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }
    .keyword-group-stats {
      color: #666;
      font-size: 14px;
    }
    .news-item {
      padding: 15px;
      background: white;
      border-radius: 6px;
      margin-bottom: 10px;
      border: 1px solid #e5e7eb;
    }
    .news-item:hover {
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .news-title {
      font-size: 16px;
      font-weight: 500;
      color: #333;
      margin-bottom: 8px;
    }
    .news-title a {
      color: #3b82f6;
      text-decoration: none;
    }
    .news-title a:hover {
      text-decoration: underline;
    }
    .news-meta {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      font-size: 13px;
      color: #666;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-platform {
      background: #e5e7eb;
      color: #374151;
    }
    .badge-weight {
      background: #10b981;
      color: white;
    }
    .badge-new {
      background: #ef4444;
      color: white;
    }
    .new-items-section {
      margin-top: 40px;
      padding-top: 30px;
      border-top: 2px solid #e5e7eb;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    @media (max-width: 768px) {
      .container {
        padding: 15px;
      }
      .header h1 {
        font-size: 24px;
      }
      .news-meta {
        flex-direction: column;
        gap: 5px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${data.reportType === 'daily' ? '当日汇总' : data.reportType === 'current' ? '当前榜单' : '增量监控'}</h1>
      <div class="header-info">
        <span>新闻总数: ${data.totalCount}</span>
        <span>匹配数量: ${data.matchedCount}</span>
        <span>生成时间: ${new Date(data.generatedAt).toLocaleString('zh-CN')}</span>
      </div>
    </div>

    <div class="stats-section">
      <h2>热点词汇统计</h2>
      ${data.stats.map(stat => `
        <div class="keyword-group">
          <div class="keyword-group-header">
            <span class="keyword-group-name">${stat.keywordGroup.name || '未命名'}</span>
            <span class="keyword-group-stats">${stat.count} 条 (${stat.percentage.toFixed(1)}%)</span>
          </div>
          ${stat.newsItems.map(item => `
            <div class="news-item">
              <div class="news-title">
                ${item.isNew ? '<span class="badge badge-new">🆕 新增</span> ' : ''}
                ${item.newsItem.url ? `<a href="${item.newsItem.url}" target="_blank">${item.newsItem.title}</a>` : item.newsItem.title}
              </div>
              <div class="news-meta">
                <span class="badge badge-platform">${item.newsItem.platform.name}</span>
                <span>时间: ${new Date(item.newsItem.crawledAt).toLocaleString('zh-CN')}</span>
                <span class="badge badge-weight">权重: ${item.weight.toFixed(1)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>

    ${data.newItems.length > 0 ? `
      <div class="new-items-section">
        <h2>新增新闻</h2>
        ${data.newItems.map(item => `
          <div class="news-item">
            <div class="news-title">
              <span class="badge badge-new">🆕 新增</span>
              ${item.url ? `<a href="${item.url}" target="_blank">${item.title}</a>` : item.title}
            </div>
            <div class="news-meta">
              <span class="badge badge-platform">${item.platform.name}</span>
              <span>排名: #${item.rank}</span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <div class="footer">
      <p>Generated by NewsFocus - 新闻热点聚合系统</p>
    </div>
  </div>
</body>
</html>
    `

    return html
  }

  /**
   * 生成飞书消息格式
   */
  generateFeishuMessage(data: ReportData): string {
    let message = `**${data.reportType === 'daily' ? '当日汇总' : data.reportType === 'current' ? '当前榜单' : '增量监控'}**\n\n`
    message += `📊 新闻总数: ${data.totalCount} | 匹配数量: ${data.matchedCount}\n`
    message += `⏰ 生成时间: ${new Date(data.generatedAt).toLocaleString('zh-CN')}\n\n`
    message += '━━━━━━━━━━━━━━━━━━━\n\n'

    for (const stat of data.stats) {
      message += `**${stat.keywordGroup.name || '未命名'}** (${stat.count}条, ${stat.percentage.toFixed(1)}%)\n\n`
      
      for (const item of stat.newsItems.slice(0, 5)) {
        const prefix = item.isNew ? '🆕 ' : ''
        message += `${prefix}${item.newsItem.title}\n`
        message += `平台: ${item.newsItem.platform.name} | 权重: ${item.weight.toFixed(1)}\n`
        if (item.newsItem.url) {
          message += `链接: ${item.newsItem.url}\n`
        }
        message += '\n'
      }
      
      if (stat.newsItems.length > 5) {
        message += `...还有 ${stat.newsItems.length - 5} 条\n\n`
      }
      
      message += '━━━━━━━━━━━━━━━━━━━\n\n'
    }

    return message
  }

  /**
   * 生成钉钉消息格式
   */
  generateDingtalkMessage(data: ReportData): string {
    let message = `# ${data.reportType === 'daily' ? '当日汇总' : data.reportType === 'current' ? '当前榜单' : '增量监控'}\n\n`
    message += `**新闻总数:** ${data.totalCount} | **匹配数量:** ${data.matchedCount}\n`
    message += `**生成时间:** ${new Date(data.generatedAt).toLocaleString('zh-CN')}\n\n`
    message += '---\n\n'

    for (const stat of data.stats) {
      message += `## ${stat.keywordGroup.name || '未命名'} (${stat.count}条, ${stat.percentage.toFixed(1)}%)\n\n`
      
      for (const item of stat.newsItems.slice(0, 5)) {
        const prefix = item.isNew ? '🆕 ' : ''
        message += `### ${prefix}${item.newsItem.title}\n`
        message += `- 平台: ${item.newsItem.platform.name}\n`
        message += `- 权重: ${item.weight.toFixed(1)}\n`
        if (item.newsItem.url) {
          message += `- [查看链接](${item.newsItem.url})\n`
        }
        message += '\n'
      }
      
      message += '---\n\n'
    }

    return message
  }

  /**
   * 生成企业微信消息格式
   */
  generateWeworkMessage(data: ReportData): string {
    return this.generateDingtalkMessage(data) // 企业微信也使用Markdown格式
  }

  /**
   * 生成Telegram消息格式
   */
  generateTelegramMessage(data: ReportData): string {
    let message = `<b>${data.reportType === 'daily' ? '当日汇总' : data.reportType === 'current' ? '当前榜单' : '增量监控'}</b>\n\n`
    message += `📊 新闻总数: ${data.totalCount} | 匹配数量: ${data.matchedCount}\n`
    message += `⏰ 生成时间: ${new Date(data.generatedAt).toLocaleString('zh-CN')}\n\n`

    for (const stat of data.stats.slice(0, 3)) {
      message += `<b>${stat.keywordGroup.name || '未命名'}</b> (${stat.count}条)\n\n`
      
      for (const item of stat.newsItems.slice(0, 3)) {
        const prefix = item.isNew ? '🆕 ' : ''
        message += `${prefix}<b>${item.newsItem.title}</b>\n`
        message += `平台: ${item.newsItem.platform.name} | 权重: ${item.weight.toFixed(1)}\n`
        if (item.newsItem.url) {
          message += `<a href="${item.newsItem.url}">查看链接</a>\n`
        }
        message += '\n'
      }
    }

    return message
  }

  /**
   * 生成邮件内容
   */
  generateEmailContent(data: ReportData): {
    subject: string
    html: string
    text: string
  } {
    const subject = `新闻热点报告 - ${data.reportType === 'daily' ? '当日汇总' : data.reportType === 'current' ? '当前榜单' : '增量监控'}`
    const html = this.generateHTMLReport(data) // 现在是同步函数，直接返回 string
    
    let text = `${subject}\n\n`
    text += `新闻总数: ${data.totalCount}\n`
    text += `匹配数量: ${data.matchedCount}\n`
    text += `生成时间: ${new Date(data.generatedAt).toLocaleString('zh-CN')}\n\n`
    
    for (const stat of data.stats) {
      text += `${stat.keywordGroup.name || '未命名'} (${stat.count}条)\n\n`
      for (const item of stat.newsItems) {
        text += `${item.newsItem.title}\n`
        text += `平台: ${item.newsItem.platform.name} | 权重: ${item.weight.toFixed(1)}\n`
        if (item.newsItem.url) {
          text += `链接: ${item.newsItem.url}\n`
        }
        text += '\n'
      }
    }

    return { subject, html, text }
  }

  /**
   * 生成ntfy消息格式
   */
  generateNtfyMessage(data: ReportData): string {
    let message = `${data.reportType === 'daily' ? '当日汇总' : data.reportType === 'current' ? '当前榜单' : '增量监控'}\n\n`
    message += `新闻总数: ${data.totalCount} | 匹配数量: ${data.matchedCount}\n\n`

    for (const stat of data.stats.slice(0, 3)) {
      message += `${stat.keywordGroup.name || '未命名'} (${stat.count}条):\n`
      for (const item of stat.newsItems.slice(0, 3)) {
        message += `- ${item.newsItem.title}\n`
      }
      message += '\n'
    }

    return message
  }

  /**
   * 分批处理消息
   */
  splitMessage(message: string, maxLength: number): string[] {
    if (message.length <= maxLength) {
      return [message]
    }

    const batches: string[] = []
    const separator = '\n━━━━━━━━━━━━━━━━━━━\n\n'
    const parts = message.split(separator)

    let currentBatch = ''
    for (const part of parts) {
      if (currentBatch.length + part.length + separator.length <= maxLength) {
        currentBatch += (currentBatch ? separator : '') + part
      } else {
        if (currentBatch) {
          batches.push(currentBatch)
        }
        currentBatch = part
      }
    }

    if (currentBatch) {
      batches.push(currentBatch)
    }

    return batches
  }
}
