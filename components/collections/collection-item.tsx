"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ExternalLink, Edit2, Tag, FileText } from "lucide-react"
import Link from "next/link"
import { formatRelativeTime } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface CollectionItemProps {
  id: string
  newsItem: {
    id: string
    title: string
    url: string | null
    platformId: string
    platformName: string
    rank: number
    crawledAt: string
    sentiment: string | null
    sentimentScore: number | null
    keywordGroup: string | null
    weight: number
  }
  tags: string[]
  notes: string | null
  collectedAt: string
  onUpdate?: () => void
}

export function CollectionItem({
  newsItem,
  tags,
  notes,
  collectedAt,
  onUpdate,
}: CollectionItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTags, setEditTags] = useState(tags.join(", "))
  const [editNotes, setEditNotes] = useState(notes || "")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    setSaving(true)
    try {
      // 解析标签（逗号分隔）
      const tagArray = editTags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      const res = await fetch(`/api/news/${newsItem.id}/collect`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tags: tagArray,
          notes: editNotes.trim() || null,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast({
          title: "更新成功",
          description: "收藏信息已更新",
        })
        setIsEditing(false)
        if (onUpdate) {
          onUpdate()
        }
      } else {
        toast({
          title: "更新失败",
          description: data.error?.message || "请稍后重试",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating collection:", error)
      toast({
        title: "更新失败",
        description: "网络错误，请稍后重试",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    try {
      const res = await fetch(`/api/news/${newsItem.id}/collect`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast({
          title: "取消收藏成功",
          description: "新闻已从收藏列表移除",
        })
        if (onUpdate) {
          onUpdate()
        }
      }
    } catch (error) {
      console.error("Error removing collection:", error)
    }
  }

  return (
    <div className="group">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <Link href={`/news/${newsItem.id}`} className="block">
                <h3 className="text-base font-semibold mb-2 line-clamp-2 hover:text-primary transition-colors">
                  {newsItem.title}
                </h3>
              </Link>
              {notes && (
                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                  {notes}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge variant="secondary">{newsItem.platformName}</Badge>
                <span className="text-xs text-muted-foreground">
                  排名 #{newsItem.rank}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(newsItem.crawledAt)}
                </span>
                {newsItem.sentiment && (
                  <Badge
                    variant={
                      newsItem.sentiment === "positive"
                        ? "success"
                        : newsItem.sentiment === "negative"
                        ? "destructive"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {newsItem.sentiment === "positive"
                      ? "积极"
                      : newsItem.sentiment === "negative"
                      ? "负面"
                      : "中性"}
                  </Badge>
                )}
                {newsItem.keywordGroup && (
                  <Badge variant="outline" className="text-xs">
                    {newsItem.keywordGroup}
                  </Badge>
                )}
              </div>
              {tags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                收藏于 {formatRelativeTime(collectedAt)}
              </p>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              {newsItem.url && (
                <a
                  href={newsItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="outline">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    打开
                  </Button>
                </a>
              )}
              <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Edit2 className="h-3 w-3 mr-1" />
                    编辑
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>编辑收藏</DialogTitle>
                    <DialogDescription>
                      添加标签和备注，方便后续查找和管理
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        标签（逗号分隔）
                      </label>
                      <Input
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                        placeholder="例如: 重要, 待读, AI"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        备注
                      </label>
                      <Textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="添加备注..."
                        rows={4}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                    >
                      取消
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? "保存中..." : "保存"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRemove}
              >
                取消收藏
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

