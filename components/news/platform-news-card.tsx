"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatUpdateTime } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { ExternalLink } from "lucide-react"

interface NewsItem {
  id: string
  title: string
  url?: string | null
  mobileUrl?: string | null
  content?: string | null
  publishedAt?: string | null
  rank: number
  crawledAt: string
  weight?: number
  keywordGroup?: string | null
  sentiment?: string | null
  sentimentScore?: number | null
}

interface PlatformNewsCardProps {
  platform: {
    id: string
    platformId: string
    name: string
  }
  items: NewsItem[]
  latestUpdate: string | null
  loading?: boolean
}

// 平台Logo映射（可以使用实际图片或图标）
const platformLogos: Record<string, string> = {
  zhihu: '知',
  weibo: '微',
  douyin: '抖',
  bilibili: 'B',
  baidu: 'du',
  toutiao: '头条',
  redbook: '红',
  netease: '网',
  sina: '新',
  qq: 'Q',
  douban: '豆',
  coolapk: '酷安',
  wallstreetcn: 'W',
  hupu: '虎扑',
  thepaper: '澎湃',
  cailianpress: 'C',
}

const platformColors: Record<string, string> = {
  zhihu: 'bg-blue-600 dark:bg-blue-600',
  weibo: 'bg-red-500 dark:bg-red-500',
  douyin: 'bg-gray-900 dark:bg-gray-900',
  bilibili: 'bg-pink-500 dark:bg-pink-500',
  baidu: 'bg-blue-500 dark:bg-blue-500',
  toutiao: 'bg-red-500 dark:bg-red-500',
  redbook: 'bg-red-600 dark:bg-red-600',
  netease: 'bg-red-400 dark:bg-red-400',
  sina: 'bg-yellow-500 dark:bg-yellow-500',
  qq: 'bg-blue-400 dark:bg-blue-400',
  douban: 'bg-green-600 dark:bg-green-600',
  coolapk: 'bg-green-500 dark:bg-green-500',
  wallstreetcn: 'bg-indigo-700 dark:bg-indigo-700',
  hupu: 'bg-red-500 dark:bg-red-500',
  thepaper: 'bg-red-500 dark:bg-red-500',
  cailianpress: 'bg-red-500 dark:bg-red-500',
}

const formatPublishedTime = (publishedAt?: string | null) => {
  if (!publishedAt) return null
  const date = new Date(publishedAt)
  if (isNaN(date.getTime())) return null
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 格式化热度显示
function formatHeat(weight?: number): string | null {
  if (!weight || weight <= 0) return null
  if (weight >= 10000) {
    return `${(weight / 10000).toFixed(0)}万热度`
  }
  return `${weight.toFixed(0)}热度`
}

// 判断是否显示"热"标签（热度较高）
function isHot(weight?: number): boolean {
  return weight ? weight >= 50000 : false
}

// 判断是否显示"新"标签（最近更新）
function isNew(crawledAt: string): boolean {
  const date = new Date(crawledAt)
  const now = new Date()
  const diffMinutes = (now.getTime() - date.getTime()) / (1000 * 60)
  return diffMinutes < 30 // 30分钟内算新
}

// 获取情感标识
function getSentimentBadge(sentiment?: string | null, score?: number | null) {
  if (!sentiment) return null
  
  const badges = {
    positive: {
      text: '正面',
      className: 'bg-green-500/20 text-green-600 dark:text-green-400',
    },
    negative: {
      text: '负面',
      className: 'bg-red-500/20 text-red-600 dark:text-red-400',
    },
    neutral: {
      text: '中性',
      className: 'bg-gray-500/20 text-gray-600 dark:text-gray-400',
    },
  }
  
  const badge = badges[sentiment as keyof typeof badges]
  if (!badge) return null
  
  return (
    <span className={`inline-flex items-center px-1 py-0 text-[10px] font-medium rounded ${badge.className}`}>
      {badge.text}
    </span>
  )
}

export function PlatformNewsCard({ platform, items, latestUpdate, loading }: PlatformNewsCardProps) {
  if (loading) {
    return (
      <Card className="h-full bg-card border-border">
        <CardHeader className="pb-2.5 px-4 pt-4">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="flex-1">
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const logo = platformLogos[platform.platformId] || platform.name[0]
  const bgColor = platformColors[platform.platformId] || 'bg-gray-600'

  return (
    <Card className="h-full flex flex-col bg-card border-border hover:shadow-md transition-shadow">
      <CardHeader className="pb-2.5 px-4 pt-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className={`${bgColor} text-white rounded-md w-9 h-9 flex items-center justify-center font-bold text-base flex-shrink-0`}>
            {logo}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <CardTitle className="text-sm font-semibold leading-tight">{platform.name}</CardTitle>
              {latestUpdate && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatUpdateTime(latestUpdate)}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-4 py-3 overflow-hidden">
        {items.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-xs">
            暂无数据
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => {
              const heatText = formatHeat(item.weight)
              const showHot = isHot(item.weight)
              const showNew = isNew(item.crawledAt)
              const sentimentBadge = getSentimentBadge(item.sentiment, item.sentimentScore)
              
              return (
                <div
                  key={item.id}
                  className="group cursor-pointer"
                >
                  <Link href={`/news/${item.id}`}>
                    <div className="flex items-start gap-2 py-1.5 -mx-1 px-1 rounded hover:bg-accent/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-1.5 mb-1">
                          <h3 className="text-xs leading-relaxed text-foreground group-hover:text-primary line-clamp-2 flex-1">
                            {item.title}
                          </h3>
                          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5 flex-wrap">
                            {showHot && (
                              <span className="inline-flex items-center px-1 py-0 text-[10px] font-medium bg-red-500/20 text-red-500 rounded">
                                热
                              </span>
                            )}
                            {showNew && (
                              <span className="inline-flex items-center px-1 py-0 text-[10px] font-medium bg-blue-500/20 text-blue-500 rounded">
                                新
                              </span>
                            )}
                            {sentimentBadge}
                          </div>
                        </div>
                        {item.publishedAt && (
                          <div className="text-[10px] text-muted-foreground">
                            发布时间：{formatPublishedTime(item.publishedAt)}
                          </div>
                        )}
                        {heatText && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {heatText}
                            </span>
                          </div>
                        )}
                        {item.content && (
                          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-3 whitespace-pre-line">
                            {item.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

