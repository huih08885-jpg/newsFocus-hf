import { PrismaClient } from '@prisma/client'
import nodemailer from 'nodemailer'

interface NotificationConfig {
  feishu?: { webhookUrl: string }
  dingtalk?: { webhookUrl: string }
  wework?: { webhookUrl: string }
  telegram?: { botToken: string; chatId: string }
  email?: {
    from: string
    password: string
    to: string[]
    smtpServer: string
    smtpPort: number
  }
  ntfy?: {
    serverUrl: string
    topic: string
    token?: string
  }
}

interface PushWindowConfig {
  enabled: boolean
  timeRange: {
    start: string // "20:00"
    end: string   // "22:00"
  }
  oncePerDay: boolean
}

export class NotifierService {
  private prisma: PrismaClient
  private config: NotificationConfig
  private pushWindow: PushWindowConfig

  constructor(
    prisma: PrismaClient,
    config: NotificationConfig,
    pushWindow?: PushWindowConfig
  ) {
    this.prisma = prisma
    this.config = config
    this.pushWindow = pushWindow ?? {
      enabled: false,
      timeRange: { start: '00:00', end: '23:59' },
      oncePerDay: false,
    }
  }

  /**
   * 发送通知到所有配置的渠道
   */
  async sendNotifications(
    message: string,
    reportType: string,
    reportDate: Date
  ): Promise<{
    success: string[]
    failed: Array<{ channel: string; error: string }>
  }> {
    // 检查推送时间窗口
    if (this.pushWindow.enabled && !this.isInPushWindow()) {
      return {
        success: [],
        failed: [{ channel: 'all', error: '不在推送时间窗口内' }],
      }
    }

    const success: string[] = []
    const failed: Array<{ channel: string; error: string }> = []

    // 发送到各渠道
    if (this.config.feishu?.webhookUrl) {
      const hasPushed = this.pushWindow.oncePerDay
        ? await this.hasPushedToday('feishu', reportType, reportDate)
        : false

      if (!hasPushed) {
        const result = await this.sendFeishu(message)
        if (result) {
          success.push('feishu')
          await this.recordPush('feishu', reportType, reportDate, true)
        } else {
          failed.push({ channel: 'feishu', error: '发送失败' })
          await this.recordPush('feishu', reportType, reportDate, false, '发送失败')
        }
      }
    }

    if (this.config.dingtalk?.webhookUrl) {
      const hasPushed = this.pushWindow.oncePerDay
        ? await this.hasPushedToday('dingtalk', reportType, reportDate)
        : false

      if (!hasPushed) {
        const result = await this.sendDingtalk(message)
        if (result) {
          success.push('dingtalk')
          await this.recordPush('dingtalk', reportType, reportDate, true)
        } else {
          failed.push({ channel: 'dingtalk', error: '发送失败' })
          await this.recordPush('dingtalk', reportType, reportDate, false, '发送失败')
        }
      }
    }

    if (this.config.wework?.webhookUrl) {
      const hasPushed = this.pushWindow.oncePerDay
        ? await this.hasPushedToday('wework', reportType, reportDate)
        : false

      if (!hasPushed) {
        const result = await this.sendWework(message)
        if (result) {
          success.push('wework')
          await this.recordPush('wework', reportType, reportDate, true)
        } else {
          failed.push({ channel: 'wework', error: '发送失败' })
          await this.recordPush('wework', reportType, reportDate, false, '发送失败')
        }
      }
    }

    if (this.config.telegram?.botToken && this.config.telegram?.chatId) {
      const hasPushed = this.pushWindow.oncePerDay
        ? await this.hasPushedToday('telegram', reportType, reportDate)
        : false

      if (!hasPushed) {
        const result = await this.sendTelegram(message)
        if (result) {
          success.push('telegram')
          await this.recordPush('telegram', reportType, reportDate, true)
        } else {
          failed.push({ channel: 'telegram', error: '发送失败' })
          await this.recordPush('telegram', reportType, reportDate, false, '发送失败')
        }
      }
    }

    if (this.config.email?.from && this.config.email?.to?.length > 0) {
      const hasPushed = this.pushWindow.oncePerDay
        ? await this.hasPushedToday('email', reportType, reportDate)
        : false

      if (!hasPushed) {
        const result = await this.sendEmail(message, '新闻热点推送')
        if (result) {
          success.push('email')
          await this.recordPush('email', reportType, reportDate, true)
        } else {
          failed.push({ channel: 'email', error: '发送失败' })
          await this.recordPush('email', reportType, reportDate, false, '发送失败')
        }
      }
    }

    if (this.config.ntfy?.serverUrl && this.config.ntfy?.topic) {
      const hasPushed = this.pushWindow.oncePerDay
        ? await this.hasPushedToday('ntfy', reportType, reportDate)
        : false

      if (!hasPushed) {
        const result = await this.sendNtfy(message)
        if (result) {
          success.push('ntfy')
          await this.recordPush('ntfy', reportType, reportDate, true)
        } else {
          failed.push({ channel: 'ntfy', error: '发送失败' })
          await this.recordPush('ntfy', reportType, reportDate, false, '发送失败')
        }
      }
    }

    return { success, failed }
  }

  /**
   * 发送飞书消息
   */
  private async sendFeishu(message: string): Promise<boolean> {
    if (!this.config.feishu?.webhookUrl) return false

    try {
      const response = await fetch(this.config.feishu.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          msg_type: 'text',
          content: {
            text: message,
          },
        }),
      })

      const data = await response.json()
      return data.code === 0 || data.StatusCode === 0
    } catch (error) {
      console.error('Feishu send error:', error)
      return false
    }
  }

  /**
   * 发送钉钉消息
   */
  private async sendDingtalk(message: string): Promise<boolean> {
    if (!this.config.dingtalk?.webhookUrl) return false

    try {
      const response = await fetch(this.config.dingtalk.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          msgtype: 'markdown',
          markdown: {
            title: '新闻热点推送',
            text: message,
          },
        }),
      })

      const data = await response.json()
      return data.errcode === 0
    } catch (error) {
      console.error('Dingtalk send error:', error)
      return false
    }
  }

  /**
   * 发送企业微信消息
   */
  private async sendWework(message: string): Promise<boolean> {
    if (!this.config.wework?.webhookUrl) return false

    try {
      const response = await fetch(this.config.wework.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          msgtype: 'markdown',
          markdown: {
            content: message,
          },
        }),
      })

      const data = await response.json()
      return data.errcode === 0
    } catch (error) {
      console.error('Wework send error:', error)
      return false
    }
  }

  /**
   * 发送Telegram消息
   */
  private async sendTelegram(message: string): Promise<boolean> {
    if (!this.config.telegram?.botToken || !this.config.telegram?.chatId) return false

    try {
      const url = `https://api.telegram.org/bot${this.config.telegram.botToken}/sendMessage`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.config.telegram.chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      })

      const data = await response.json()
      return data.ok === true
    } catch (error) {
      console.error('Telegram send error:', error)
      return false
    }
  }

  /**
   * 发送邮件
   */
  private async sendEmail(message: string, subject: string): Promise<boolean> {
    if (!this.config.email) return false

    try {
      // 创建邮件传输器
      const transporter = nodemailer.createTransport({
        host: this.config.email.smtpServer,
        port: this.config.email.smtpPort,
        secure: this.config.email.smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: this.config.email.from,
          pass: this.config.email.password,
        },
      })

      // 发送邮件到所有收件人
      const results = await Promise.allSettled(
        this.config.email.to.map((to) =>
          transporter.sendMail({
            from: this.config.email!.from,
            to: to.trim(),
            subject,
            html: message.replace(/\n/g, '<br>'),
            text: message,
          })
        )
      )

      // 检查是否所有邮件都发送成功
      const allSuccess = results.every(
        (result) => result.status === 'fulfilled'
      )

      if (!allSuccess) {
        const failures = results
          .map((result, index) =>
            result.status === 'rejected'
              ? { to: this.config.email!.to[index], error: result.reason }
              : null
          )
          .filter(Boolean)
        console.error('部分邮件发送失败:', failures)
      }

      return allSuccess
    } catch (error) {
      console.error('Email send error:', error)
      return false
    }
  }

  /**
   * 发送ntfy消息
   */
  private async sendNtfy(message: string): Promise<boolean> {
    if (!this.config.ntfy?.serverUrl || !this.config.ntfy?.topic) return false

    try {
      const url = `${this.config.ntfy.serverUrl}/${this.config.ntfy.topic}`
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain',
      }

      if (this.config.ntfy.token) {
        headers['Authorization'] = `Bearer ${this.config.ntfy.token}`
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: message,
      })

      return response.ok
    } catch (error) {
      console.error('Ntfy send error:', error)
      return false
    }
  }

  /**
   * 检查推送时间窗口
   */
  private isInPushWindow(): boolean {
    if (!this.pushWindow.enabled) return true

    const now = new Date()
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    const [startHour, startMin] = this.pushWindow.timeRange.start.split(':').map(Number)
    const [endHour, endMin] = this.pushWindow.timeRange.end.split(':').map(Number)

    const startTime = startHour * 60 + startMin
    const endTime = endHour * 60 + endMin
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes()

    if (startTime <= endTime) {
      return currentTimeMinutes >= startTime && currentTimeMinutes <= endTime
    } else {
      // 跨天情况
      return currentTimeMinutes >= startTime || currentTimeMinutes <= endTime
    }
  }

  /**
   * 检查今天是否已推送
   */
  private async hasPushedToday(
    channel: string,
    reportType: string,
    reportDate: Date
  ): Promise<boolean> {
    const today = new Date(reportDate)
    today.setHours(0, 0, 0, 0)

    const record = await this.prisma.pushRecord.findUnique({
      where: {
        channel_reportDate_reportType: {
          channel,
          reportDate: today,
          reportType,
        },
      },
    })

    return !!record && record.success
  }

  /**
   * 记录推送状态
   */
  private async recordPush(
    channel: string,
    reportType: string,
    reportDate: Date,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    const date = new Date(reportDate)
    date.setHours(0, 0, 0, 0)

    await this.prisma.pushRecord.upsert({
      where: {
        channel_reportDate_reportType: {
          channel,
          reportDate: date,
          reportType,
        },
      },
      update: {
        pushedAt: new Date(),
        success,
        errorMessage,
      },
      create: {
        channel,
        reportType,
        reportDate: date,
        pushedAt: new Date(),
        success,
        errorMessage,
      },
    })
  }
}
