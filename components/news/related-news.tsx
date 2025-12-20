"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatRelativeTime } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface RelatedNewsProps {
  newsId: string
}

interface RelatedNewsItem {
  id: string
  title: string
  url: string | null
  platformId: string
  platformName: string
  rank: number
  crawledAt: string
  sentiment: string | null
  sentimentScore: number | null
  score: number
  reason: string
}

export function RelatedNews({ newsId }: RelatedNewsProps) {
  const [relatedNews, setRelatedNews] = useState<RelatedNewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRelatedNews()
  }, [newsId])

  const fetchRelatedNews = async () => {
    try {
      const res = await fetch(`/api/news/${newsId}/related?limit=5`)
      const data = await res.json()
      if (data.success) {
        setRelatedNews(data.data)
      }
    } catch (error) {
      console.error("Error fetching related news:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>相关新闻</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (relatedNews.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>相关新闻</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {relatedNews.map((news) => (
            <Link
              key={news.id}
              href={`/news/${news.id}`}
              className="block p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium line-clamp-2 mb-1">
                    {news.title}
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {news.platformName}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(news.crawledAt)}
                    </span>
                    {news.sentiment && (
                      <Badge
                        variant={
                          news.sentiment === "positive"
                            ? "success"
                            : news.sentiment === "negative"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {news.sentiment === "positive"
                          ? "积极"
                          : news.sentiment === "negative"
                          ? "负面"
                          : "中性"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

