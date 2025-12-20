"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Loader2, Search } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CrawlProgress {
  status: "pending" | "running" | "completed" | "failed"
  currentStep: "crawling" | "matching" | "completed"
  totalPlatforms: number
  completedPlatforms: number
  successCount: number
  failedCount: number
  fetchedNewsCount: number
  currentPlatform?: string
  matchedNews: number
  errorMessage?: string | null
  failedPlatforms?: Array<{ platformId: string; error: string }>
  startedAt?: string | null
  updatedAt?: string | null
}

interface CrawlProgressDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string | null
  onComplete?: () => void
}

export function CrawlProgressDialog({
  open,
  onOpenChange,
  taskId,
  onComplete,
}: CrawlProgressDialogProps) {
  const [progress, setProgress] = useState<CrawlProgress | null>(null)
  const [forceCleanupLoading, setForceCleanupLoading] = useState(false)
  const [allowClose, setAllowClose] = useState(false)
  const { toast } = useToast()

  console.log("CrawlProgressDialog渲染:", { open, taskId, hasProgress: !!progress })

  useEffect(() => {
    if (!open || !taskId) {
      setProgress(null)
      setAllowClose(false)
      return
    }

    let intervalId: NodeJS.Timeout | null = null
    let isMounted = true

    const fetchProgress = async (): Promise<boolean> => {
      if (!isMounted) return false

      try {
        const res = await fetch(`/api/crawl?taskId=${taskId}`)
        const data = await res.json()

        if (!isMounted) return false

        if (data.success && data.data) {
          const task = data.data
          
          let parsedProgress: CrawlProgress = {
            status: task.status as any,
            currentStep: task.status === "completed" ? "completed" : 
                        task.status === "running" ? "crawling" : "crawling", // pending 状态也显示为 crawling
            totalPlatforms: 0,
            completedPlatforms: 0,
            successCount: task.successCount || 0,
            failedCount: task.failedCount || 0,
            fetchedNewsCount: 0,
            matchedNews: 0,
            errorMessage: task.errorMessage,
          }

          parsedProgress.startedAt = task.startedAt
          parsedProgress.updatedAt = task.updatedAt

          if (task.errorMessage) {
            try {
              const progressData = JSON.parse(task.errorMessage)
              parsedProgress = {
                ...parsedProgress,
                ...progressData,
              }
            } catch {
              // 忽略JSON解析错误
            }
          }

          if (isMounted) {
            setProgress(parsedProgress)
            if (task.status !== "running" && task.status !== "pending") {
              setAllowClose(true)
            }
          }

          if (task.status === "completed" || task.status === "failed") {
            if (intervalId) {
              clearInterval(intervalId)
              intervalId = null
            }
            if (task.status === "completed" && onComplete && isMounted) {
              setTimeout(() => {
                if (isMounted) {
                  onComplete()
                }
              }, 2000)
            }
            return false
          }
          return true
        }
      } catch (error) {
        console.error("Error fetching progress:", error)
        return true
      }
      return true
    }

    fetchProgress().then((shouldContinue) => {
      if (!shouldContinue || !isMounted) return

      intervalId = setInterval(async () => {
        const shouldContinue = await fetchProgress()
        if (!shouldContinue) {
          if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
          }
        }
      }, 1000)
    })

    return () => {
      isMounted = false
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [open, taskId, onComplete])

  const canClose =
    allowClose ||
    (progress ? progress.status === "completed" || progress.status === "failed" : false)
  const startedAtDate = progress?.startedAt ? new Date(progress.startedAt) : null
  const updatedAtDate = progress?.updatedAt ? new Date(progress.updatedAt) : null
  const elapsedSeconds = startedAtDate ? Math.max(0, Math.floor((Date.now() - startedAtDate.getTime()) / 1000)) : 0
  const sinceUpdateSeconds = updatedAtDate ? Math.max(0, Math.floor((Date.now() - updatedAtDate.getTime()) / 1000)) : 0
  const STALE_THRESHOLD_SECONDS = 3 * 60
  const MAX_THRESHOLD_SECONDS = 12 * 60
  const isLikelyStuck =
    progress?.status === "running" &&
    (elapsedSeconds >= MAX_THRESHOLD_SECONDS || sinceUpdateSeconds >= STALE_THRESHOLD_SECONDS)
  const handleForceCleanup = async () => {
    if (!taskId) return
    setForceCleanupLoading(true)
    try {
      const res = await fetch("/api/crawl/cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId,
          reason: "任务已被用户在前端强制结束",
        }),
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error?.message || "强制结束失败")
      }
      toast({
        title: "已结束任务",
        description: "任务已标记为失败，可以重新发起爬取。",
      })
      setProgress((prev) =>
        prev
          ? {
              ...prev,
              status: "failed",
              errorMessage: "任务已被用户强制结束",
            }
          : prev
      )
      setAllowClose(true)
    } catch (error) {
      toast({
        title: "强制结束失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setForceCleanupLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    if (seconds <= 0) return "0秒"
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (minutes === 0) return `${secs}秒`
    return `${minutes}分${secs.toString().padStart(2, "0")}秒`
  }


  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !canClose) {
      return
    }
    onOpenChange(newOpen)
  }

  if (!progress) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>爬取进度</DialogTitle>
            <DialogDescription>正在初始化爬取任务...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const crawlProgress =
    progress.totalPlatforms > 0
      ? (progress.completedPlatforms / progress.totalPlatforms) * 100
      : 0

  const getStepProgress = () => {
    if (progress.status === "completed") return 100
    if (progress.currentStep === "matching") return 66
    if (progress.currentStep === "crawling") return 33
    return 0
  }

  const getStepLabel = () => {
    switch (progress.currentStep) {
      case "crawling":
        return "正在爬取新闻数据"
      case "matching":
        return "正在匹配关键词"
      case "completed":
        return "爬取完成"
      default:
        // TypeScript 类型检查确保这里不会被执行
        return "准备中"
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>爬取进度</DialogTitle>
          <DialogDescription>{getStepLabel()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">总体进度</span>
              <span className="text-muted-foreground">{getStepProgress().toFixed(0)}%</span>
            </div>
            <Progress value={getStepProgress()} className="h-2" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {progress.currentStep === "crawling" && (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
              {progress.currentStep === "matching" && (
                <Search className="h-4 w-4 text-primary" />
              )}
              {(progress.currentStep === "completed" || progress.status === "completed") && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              <span className="font-medium">{getStepLabel()}</span>
            </div>

            {progress.currentStep === "crawling" && (
              <div className="pl-6 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">平台爬取进度</span>
                  <span>
                    {progress.completedPlatforms} / {progress.totalPlatforms}
                  </span>
                </div>
                {progress.totalPlatforms > 0 && (
                  <Progress value={crawlProgress} className="h-2" />
                )}
                {progress.currentPlatform && (
                  <div className="text-sm text-muted-foreground">
                    正在爬取: <span className="font-medium">{progress.currentPlatform}</span>
                  </div>
                )}
              </div>
            )}

            {progress.currentStep === "matching" && (
              <div className="pl-6 space-y-2">
            {progress.status === "running" && (
              <div className="space-y-2 pl-6 text-xs text-muted-foreground">
                {startedAtDate && (
                  <div>已运行 {formatDuration(elapsedSeconds)}</div>
                )}
                {updatedAtDate && (
                  <div>最近进度更新于 {formatDuration(sinceUpdateSeconds)} 前</div>
                )}
                {isLikelyStuck && (
                  <div className="text-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800 rounded-md p-2">
                    任务可能已卡住，您可以选择强制结束并重新发起爬取。
                  </div>
                )}
              </div>
            )}

                <div className="text-sm text-muted-foreground">
                  正在匹配关键词并计算权重...
                </div>
                {progress.matchedNews > 0 && (
                  <div className="text-sm text-muted-foreground">
                    已匹配: <span className="font-medium">{progress.matchedNews}</span> 条新闻
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {progress.successCount}
              </div>
              <div className="text-sm text-muted-foreground">成功平台</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {progress.failedCount}
              </div>
              <div className="text-sm text-muted-foreground">失败平台</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {progress.fetchedNewsCount}
              </div>
              <div className="text-sm text-muted-foreground">已获取新闻</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {progress.matchedNews}
              </div>
              <div className="text-sm text-muted-foreground">匹配新闻</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            {progress.status === "running" && (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">正在执行中...</span>
              </>
            )}
            {progress.status === "completed" && (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600">爬取完成</span>
              </>
            )}
            {progress.status === "failed" && (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-600">爬取失败</span>
              </>
            )}
          </div>

          {/* 失败平台详情 */}
          {progress.failedPlatforms && progress.failedPlatforms.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-red-600 dark:text-red-400">
                失败平台详情 ({progress.failedPlatforms.length}个):
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {progress.failedPlatforms.map((fp, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-red-50 dark:bg-red-950 rounded text-xs text-red-800 dark:text-red-200"
                  >
                    <div className="font-medium">{fp.platformId}</div>
                    <div className="text-red-600 dark:text-red-400 mt-1">
                      {fp.error}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {progress.errorMessage && 
           progress.status === "failed" && 
           !progress.errorMessage.startsWith("{") && (
            <div className="p-3 bg-red-50 dark:bg-red-950 rounded-md text-sm text-red-800 dark:text-red-200">
              {progress.errorMessage}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {progress.status === "running"
              ? "爬取进行中..."
              : progress.status === "completed"
              ? "任务已完成"
              : progress.status === "failed"
              ? "任务已失败"
              : ""}
          </div>
          <div className="flex gap-2">
            {progress.status === "running" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleForceCleanup}
                disabled={forceCleanupLoading}
              >
                {forceCleanupLoading ? "处理中..." : "强制结束任务"}
              </Button>
            )}
            {canClose && (
              <Button onClick={() => handleOpenChange(false)}>
                关闭
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
