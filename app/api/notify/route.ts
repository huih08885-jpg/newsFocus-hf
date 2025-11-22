import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { NotifierService } from '@/lib/services/notifier'
import { ReportService } from '@/lib/services/report'

// 根据channels参数选择消息格式
function selectMessageFormat(
  reportService: ReportService,
  reportData: any,
  channels: string[]
): string {
  // 如果包含飞书，使用飞书格式
  if (channels.includes('feishu')) {
    return reportService.generateFeishuMessage(reportData)
  }
  // 如果包含钉钉或企业微信，使用Markdown格式
  if (channels.includes('dingtalk') || channels.includes('wework')) {
    return reportService.generateDingtalkMessage(reportData)
  }
  // 如果包含Telegram，使用HTML格式
  if (channels.includes('telegram')) {
    return reportService.generateTelegramMessage(reportData)
  }
  // 默认使用飞书格式
  return reportService.generateFeishuMessage(reportData)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reportType, reportDate, channels } = body

    if (!reportType || !reportDate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARAM',
            message: 'reportType and reportDate are required',
          },
        },
        { status: 400 }
      )
    }

    // 生成报告数据
    const reportDateObj = new Date(reportDate)
    const startOfDay = new Date(reportDateObj)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(reportDateObj)
    endOfDay.setHours(23, 59, 59, 999)

    // 查询匹配的新闻
    const matches = await prisma.newsMatch.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        newsItem: {
          include: {
            platform: true,
          },
        },
        keywordGroup: true,
      },
      orderBy: { weight: 'desc' },
      take: 100,
    })

    // 按关键词组分组
    const statsMap = new Map<string, any>()
    for (const match of matches) {
      const groupId = match.keywordGroupId
      if (!statsMap.has(groupId)) {
        statsMap.set(groupId, {
          keywordGroup: match.keywordGroup,
          newsItems: [],
        })
      }
      statsMap.get(groupId)!.newsItems.push({
        newsItem: match.newsItem,
        weight: match.weight,
        isNew: false, // TODO: 检测新增
      })
    }

    const stats = Array.from(statsMap.values()).map((stat) => ({
      ...stat,
      count: stat.newsItems.length,
      percentage: (stat.newsItems.length / matches.length) * 100,
    }))

    const reportData = {
      reportType,
      stats,
      newItems: [],
      totalCount: await prisma.newsItem.count({
        where: {
          crawledAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
      matchedCount: matches.length,
      generatedAt: new Date(),
    }

    const reportService = new ReportService()
    const selectedChannels = channels || ['feishu', 'dingtalk', 'wework', 'telegram', 'email', 'ntfy']
    const message = selectMessageFormat(reportService, reportData, selectedChannels)

    // 从数据库加载配置
    const configRecords = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            'notification.feishu_webhook_url',
            'notification.dingtalk_webhook_url',
            'notification.wework_webhook_url',
            'notification.telegram_bot_token',
            'notification.telegram_chat_id',
            'notification.email_from',
            'notification.email_password',
            'notification.email_to',
            'notification.email_smtp_server',
            'notification.email_smtp_port',
            'notification.ntfy_server_url',
            'notification.ntfy_topic',
            'notification.ntfy_token',
            'notification.push_window_enabled',
            'notification.push_window_start',
            'notification.push_window_end',
            'notification.once_per_day',
          ],
        },
      },
    })

    const configMap: Record<string, any> = {}
    for (const record of configRecords) {
      configMap[record.key] = record.value
    }

    // 配置通知服务
    const notificationConfig = {
      feishu: configMap['notification.feishu_webhook_url'] || process.env.FEISHU_WEBHOOK_URL
        ? { webhookUrl: configMap['notification.feishu_webhook_url'] || process.env.FEISHU_WEBHOOK_URL }
        : undefined,
      dingtalk: configMap['notification.dingtalk_webhook_url'] || process.env.DINGTALK_WEBHOOK_URL
        ? { webhookUrl: configMap['notification.dingtalk_webhook_url'] || process.env.DINGTALK_WEBHOOK_URL }
        : undefined,
      wework: configMap['notification.wework_webhook_url'] || process.env.WEWORK_WEBHOOK_URL
        ? { webhookUrl: configMap['notification.wework_webhook_url'] || process.env.WEWORK_WEBHOOK_URL }
        : undefined,
      telegram: configMap['notification.telegram_bot_token'] || process.env.TELEGRAM_BOT_TOKEN
        ? {
            botToken: configMap['notification.telegram_bot_token'] || process.env.TELEGRAM_BOT_TOKEN,
            chatId: configMap['notification.telegram_chat_id'] || process.env.TELEGRAM_CHAT_ID,
          }
        : undefined,
      email: configMap['notification.email_from'] || process.env.EMAIL_FROM
        ? {
            from: configMap['notification.email_from'] || process.env.EMAIL_FROM,
            password: configMap['notification.email_password'] || process.env.EMAIL_PASSWORD,
            to: (configMap['notification.email_to'] || process.env.EMAIL_TO || '').split(',').filter(Boolean),
            smtpServer: configMap['notification.email_smtp_server'] || process.env.EMAIL_SMTP_SERVER,
            smtpPort: Number(configMap['notification.email_smtp_port'] || process.env.EMAIL_SMTP_PORT || 587),
          }
        : undefined,
      ntfy: configMap['notification.ntfy_topic'] || process.env.NTFY_TOPIC
        ? {
            serverUrl: configMap['notification.ntfy_server_url'] || process.env.NTFY_SERVER_URL || 'https://ntfy.sh',
            topic: configMap['notification.ntfy_topic'] || process.env.NTFY_TOPIC,
            token: configMap['notification.ntfy_token'] || process.env.NTFY_TOKEN,
          }
        : undefined,
    }

    const pushWindow = {
      enabled: configMap['notification.push_window_enabled'] || false,
      timeRange: {
        start: configMap['notification.push_window_start'] || '00:00',
        end: configMap['notification.push_window_end'] || '23:59',
      },
      oncePerDay: configMap['notification.once_per_day'] || false,
    }

    const notifier = new NotifierService(prisma, notificationConfig, pushWindow)
    const result = await notifier.sendNotifications(
      message,
      reportType,
      reportDateObj
    )

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Error sending notification:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NOTIFY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

