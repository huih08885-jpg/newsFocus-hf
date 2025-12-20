"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Heart } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface CollectButtonProps {
  newsId: string
  className?: string
}

export function CollectButton({ newsId, className }: CollectButtonProps) {
  const [collected, setCollected] = useState(false)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    checkCollectionStatus()
  }, [newsId])

  const checkCollectionStatus = async () => {
    try {
      const res = await fetch(`/api/news/${newsId}/collect`)
      const data = await res.json()
      if (data.success) {
        setCollected(data.collected)
      }
    } catch (error) {
      console.error("Error checking collection status:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCollect = async () => {
    if (loading) return

    try {
      const res = await fetch(`/api/news/${newsId}/collect`, {
        method: collected ? "DELETE" : "POST",
      })
      const data = await res.json()

      if (data.success) {
        setCollected(data.collected)
        toast({
          title: data.collected ? "收藏成功" : "取消收藏成功",
          description: data.collected
            ? "新闻已添加到收藏列表"
            : "新闻已从收藏列表移除",
        })

        // 记录行为
        if (data.collected) {
          try {
            await fetch(`/api/news/${newsId}/action`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "collect" }),
            })
          } catch (error) {
            // 忽略行为记录错误
          }
        }
      } else {
        toast({
          title: "操作失败",
          description: data.error?.message || "请先登录",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error toggling collection:", error)
      toast({
        title: "操作失败",
        description: "网络错误，请稍后重试",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <Button variant="outline" disabled className={className}>
        <Heart className="h-4 w-4 mr-2" />
        加载中...
      </Button>
    )
  }

  return (
    <Button
      variant={collected ? "default" : "outline"}
      onClick={handleCollect}
      className={cn(className)}
    >
      <Heart
        className={cn(
          "h-4 w-4 mr-2",
          collected && "fill-current"
        )}
      />
      {collected ? "已收藏" : "收藏"}
    </Button>
  )
}

