import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink, Share2 } from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/db/prisma"
import { formatDate, formatRelativeTime } from "@/lib/utils"

interface PageProps {
  params: { id: string }
}

export default async function NewsDetailPage({ params }: PageProps) {
  const newsItem = await prisma.newsItem.findUnique({
    where: { id: params.id },
    include: {
      platform: true,
      matches: {
        include: {
          keywordGroup: true,
        },
      },
      appearances: {
        orderBy: { appearedAt: "desc" },
      },
    },
  })

  if (!newsItem) {
    notFound()
  }

  const getRankBadgeVariant = (rank: number) => {
    if (rank <= 3) return "success"
    if (rank <= 5) return "warning"
    return "secondary"
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Link href="/news">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回列表
        </Button>
      </Link>

      {/* 标题区域 */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl mb-4">{newsItem.title}</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={getRankBadgeVariant(newsItem.rank)}>
                  排名 #{newsItem.rank}
                </Badge>
                <Badge variant="secondary">{newsItem.platform.name}</Badge>
                <span className="text-sm text-muted-foreground">
                  {formatRelativeTime(newsItem.crawledAt)}
                </span>
                {newsItem.matches.length > 0 && (
                  <Badge variant="outline">
                    权重: {newsItem.matches[0].weight.toFixed(1)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 匹配信息 */}
      {newsItem.matches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>匹配信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {newsItem.matches.map((match) => (
              <div key={match.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">关键词组:</span>
                  <Badge variant="outline">{match.keywordGroup.name || "未命名"}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">权重分数:</span>
                    <div className="font-medium">{match.weight.toFixed(1)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">匹配次数:</span>
                    <div className="font-medium">{match.matchCount} 次</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">首次匹配:</span>
                    <div className="font-medium">
                      {formatDate(match.firstMatchedAt)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">最后匹配:</span>
                    <div className="font-medium">
                      {formatDate(match.lastMatchedAt)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 排名历史 */}
      {newsItem.appearances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>排名历史</CardTitle>
            <CardDescription>新闻排名变化趋势</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              图表占位符（将使用Recharts实现折线图）
            </div>
          </CardContent>
        </Card>
      )}

      {/* 出现记录 */}
      {newsItem.appearances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>出现记录</CardTitle>
            <CardDescription>详细排名记录</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 p-2 border-b font-medium text-sm">
                <div>时间</div>
                <div>平台</div>
                <div>排名</div>
              </div>
              {newsItem.appearances.map((appearance) => (
                <div
                  key={appearance.id}
                  className="grid grid-cols-3 gap-4 p-2 border-b hover:bg-accent transition-colors"
                >
                  <div className="text-sm">
                    {formatDate(appearance.appearedAt)}
                  </div>
                  <div className="text-sm">{newsItem.platform.name}</div>
                  <div>
                    <Badge variant={getRankBadgeVariant(appearance.rank)}>
                      #{appearance.rank}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {newsItem.url && (
          <a
            href={newsItem.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              打开PC链接
            </Button>
          </a>
        )}
        {newsItem.mobileUrl && (
          <a
            href={newsItem.mobileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button variant="outline" className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              打开移动链接
            </Button>
          </a>
        )}
        <Button variant="outline">
          <Share2 className="h-4 w-4 mr-2" />
          分享
        </Button>
      </div>
    </div>
  )
}

