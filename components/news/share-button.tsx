"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Share2,
  MessageCircle,
  Link2,
  Copy,
  Check,
} from "lucide-react"
import { ShareService, SharePlatform } from "@/lib/services/share"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface ShareButtonProps {
  newsItem: {
    id: string
    title: string
    url: string | null
    platform: {
      name: string
    }
    sentiment?: string | null
  }
  className?: string
}

export function ShareButton({ newsItem, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()
  const shareService = new ShareService()

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "https://newsfocus.app"
  const newsUrl = newsItem.url || `${baseUrl}/news/${newsItem.id}`

  const handleShare = async (platform: SharePlatform) => {
    try {
      const shareCard = shareService.generateShareCard({
        title: newsItem.title,
        url: newsItem.url,
        platform: newsItem.platform,
        sentiment: newsItem.sentiment,
      })

      const shareUrl = shareService.generateShareUrl({
        title: shareCard.title,
        url: shareCard.url,
        description: shareCard.description,
        platform,
      })

      // 记录分享行为
      try {
        await fetch(`/api/news/${newsItem.id}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform }),
        })
      } catch (error) {
        // 忽略记录错误
      }

      if (platform === "copy") {
        // 复制链接
        const success = await shareService.copyToClipboard(shareCard.url)
        if (success) {
          setCopied(true)
          toast({
            title: "已复制",
            description: "链接已复制到剪贴板",
          })
          setTimeout(() => setCopied(false), 2000)
        } else {
          toast({
            title: "复制失败",
            description: "请手动复制链接",
            variant: "destructive",
          })
        }
      } else if (platform === "wechat") {
        // 微信分享需要特殊处理（可能需要二维码）
        toast({
          title: "微信分享",
          description: "请使用微信内置浏览器打开",
        })
      } else {
        // 打开分享窗口
        window.open(
          shareUrl,
          "_blank",
          "width=600,height=400,scrollbars=yes,resizable=yes"
        )
      }
    } catch (error) {
      console.error("Error sharing:", error)
      toast({
        title: "分享失败",
        description: "请稍后重试",
        variant: "destructive",
      })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn(className)}>
          <Share2 className="h-4 w-4 mr-2" />
          分享
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleShare("weibo")}>
          <MessageCircle className="h-4 w-4 mr-2" />
          分享到微博
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare("qq")}>
          <MessageCircle className="h-4 w-4 mr-2" />
          分享到QQ
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare("douban")}>
          <MessageCircle className="h-4 w-4 mr-2" />
          分享到豆瓣
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleShare("copy")}>
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              已复制
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              复制链接
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            window.open(newsUrl, "_blank")
          }}
        >
          <Link2 className="h-4 w-4 mr-2" />
          在新窗口打开
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

