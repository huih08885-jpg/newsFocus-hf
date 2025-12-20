import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type SharePlatform = 'weibo' | 'wechat' | 'qq' | 'douban' | 'link' | 'copy'

export interface ShareOptions {
  title: string
  url: string
  description?: string
  image?: string
  platform: SharePlatform
}

export interface ShareResult {
  success: boolean
  url?: string
  message?: string
}

/**
 * 分享服务类
 * 支持分享到多个社交平台
 */
export class ShareService {
  private prisma: PrismaClient

  constructor(prismaClient: PrismaClient = prisma) {
    this.prisma = prismaClient
  }

  /**
   * 生成分享URL
   */
  generateShareUrl(options: ShareOptions): string {
    const { title, url, description, platform } = options
    const encodedTitle = encodeURIComponent(title)
    const encodedUrl = encodeURIComponent(url)
    const encodedDescription = description
      ? encodeURIComponent(description)
      : encodedTitle

    switch (platform) {
      case 'weibo':
        return `https://service.weibo.com/share/share.php?url=${encodedUrl}&title=${encodedTitle}`
      case 'qq':
        return `https://connect.qq.com/widget/shareqq/index.html?url=${encodedUrl}&title=${encodedTitle}&summary=${encodedDescription}`
      case 'douban':
        return `https://www.douban.com/share/service?href=${encodedUrl}&name=${encodedTitle}`
      case 'link':
      case 'copy':
      default:
        return url
    }
  }

  /**
   * 记录分享行为
   */
  async recordShare(
    userId: string | null,
    newsItemId: string,
    platform: SharePlatform
  ): Promise<void> {
    try {
      // 可以扩展为记录分享统计到数据库
      // await this.prisma.shareRecord.create({...})
    } catch (error) {
      console.error('Error recording share:', error)
      // 忽略错误，不影响分享功能
    }
  }

  /**
   * 生成分享卡片数据（用于OG标签）
   */
  generateShareCard(newsItem: {
    title: string
    url: string | null
    platform: { name: string }
    sentiment?: string | null
  }): {
    title: string
    description: string
    url: string
    image?: string
  } {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || 'https://newsfocus.app'
    const newsUrl = newsItem.url || `${baseUrl}/news/${newsItem.url}`

    const description = `来自${newsItem.platform.name}的热点新闻`

    return {
      title: newsItem.title,
      description,
      url: newsUrl,
      image: `${baseUrl}/og-image.png`, // 可以生成动态OG图片
    }
  }

  /**
   * 复制链接到剪贴板
   */
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      } else {
        // 降级方案：使用传统方法
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        try {
          document.execCommand('copy')
          document.body.removeChild(textArea)
          return true
        } catch (err) {
          document.body.removeChild(textArea)
          return false
        }
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      return false
    }
  }
}

