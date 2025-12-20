"use client"

import { useEffect } from "react"

interface NewsViewTrackerProps {
  newsId: string
}

/**
 * 新闻查看追踪组件
 * 当用户查看新闻详情时，自动记录"view"行为
 */
export function NewsViewTracker({ newsId }: NewsViewTrackerProps) {
  useEffect(() => {
    // 延迟记录，避免影响页面加载
    const timer = setTimeout(() => {
      fetch(`/api/news/${newsId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "view" }),
      }).catch((error) => {
        // 忽略错误，不影响用户体验
        console.warn("Failed to record view action:", error)
      })
    }, 1000) // 1秒后记录，表示用户确实查看了内容

    return () => clearTimeout(timer)
  }, [newsId])

  return null
}

