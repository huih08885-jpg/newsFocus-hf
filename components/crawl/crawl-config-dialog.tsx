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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { RefreshCw, Eye, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Platform {
  platformId: string
  name: string
  enabled: boolean
}

interface KeywordGroup {
  id: string
  name: string | null
  enabled: boolean
}

interface PreviewData {
  totalNews: number
  matchedNews: number
  matchRate: number
  matchesByKeywordGroup: Array<{ name: string; count: number }>
  matchesByPlatform: Array<{ name: string; count: number }>
}

interface CrawlConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStart: (config: {
    platforms?: string[]
    keywordGroupIds?: string[]
    keywords?: string[] // 自定义关键词
    enableRealtimeMatching: boolean
    useWebSearch?: boolean // 是否使用全网搜索
  }) => void
}

export function CrawlConfigDialog({
  open,
  onOpenChange,
  onStart,
}: CrawlConfigDialogProps) {
  const { toast } = useToast()
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [selectedKeywordGroups, setSelectedKeywordGroups] = useState<string[]>([])
  const [customKeywords, setCustomKeywords] = useState<string>("") // 自定义关键词输入
  const [useCustomKeywords, setUseCustomKeywords] = useState(false) // 是否使用自定义关键词
  const [useWebSearch, setUseWebSearch] = useState(false) // 是否使用全网搜索
  const [enableRealtimeMatching, setEnableRealtimeMatching] = useState(true)
  const [loadingPlatforms, setLoadingPlatforms] = useState(true)
  const [loadingKeywords, setLoadingKeywords] = useState(true)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // 加载平台列表
  useEffect(() => {
    if (open) {
      setLoadingPlatforms(true)
      fetch("/api/config/platforms")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            const enabledPlatforms = (data.data.items || []).filter(
              (p: Platform) => p.enabled
            )
            setPlatforms(enabledPlatforms)
            // 默认选择所有启用的平台
            setSelectedPlatforms(enabledPlatforms.map((p: Platform) => p.platformId))
          }
        })
        .finally(() => setLoadingPlatforms(false))
    }
  }, [open])

  // 加载关键词组列表
  useEffect(() => {
    if (open) {
      setLoadingKeywords(true)
      fetch("/api/config/keywords")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            const enabledGroups = (data.data.items || []).filter(
              (g: KeywordGroup) => g.enabled
            )
            setKeywordGroups(enabledGroups)
            // 默认选择所有启用的关键词组
            setSelectedKeywordGroups(enabledGroups.map((g: KeywordGroup) => g.id))
          }
        })
        .finally(() => setLoadingKeywords(false))
    }
  }, [open])

  // 预览功能
  const handlePreview = async () => {
    setPreviewLoading(true)
    try {
      const res = await fetch("/api/crawl/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
          keywordGroupIds:
            selectedKeywordGroups.length > 0 ? selectedKeywordGroups : undefined,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setPreviewData(data.data)
      } else {
        throw new Error(data.error?.message || "预览失败")
      }
    } catch (error) {
      toast({
        title: "预览失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleStart = () => {
    // 解析自定义关键词（支持逗号、换行、空格分隔）
    let keywords: string[] | undefined
    if ((useCustomKeywords || useWebSearch) && customKeywords.trim()) {
      keywords = customKeywords
        .split(/[,\n\s]+/)
        .map(k => k.trim())
        .filter(k => k.length > 0)
    } else if (useWebSearch && selectedKeywordGroups.length > 0) {
      // 如果使用全网搜索但没有自定义关键词，使用关键词组的关键词
      // 这里需要从关键词组中提取关键词，但前端没有这个数据
      // 所以要求用户必须输入自定义关键词或选择关键词组模式
    }

    onStart({
      platforms: useWebSearch ? ['web-search'] : (selectedPlatforms.length > 0 ? selectedPlatforms : undefined),
      keywordGroupIds:
        !useCustomKeywords && !useWebSearch && selectedKeywordGroups.length > 0
          ? selectedKeywordGroups
          : undefined,
      keywords: (useCustomKeywords || useWebSearch) ? keywords : undefined,
      enableRealtimeMatching: useWebSearch ? false : enableRealtimeMatching, // 全网搜索不使用实时匹配
      useWebSearch,
    })
    onOpenChange(false)
  }

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((id) => id !== platformId)
        : [...prev, platformId]
    )
  }

  const toggleKeywordGroup = (groupId: string) => {
    setSelectedKeywordGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    )
  }

  const selectAllPlatforms = () => {
    setSelectedPlatforms(platforms.map((p) => p.platformId))
  }

  const deselectAllPlatforms = () => {
    setSelectedPlatforms([])
  }

  const selectAllKeywordGroups = () => {
    setSelectedKeywordGroups(keywordGroups.map((g) => g.id))
  }

  const deselectAllKeywordGroups = () => {
    setSelectedKeywordGroups([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>配置爬取任务</DialogTitle>
          <DialogDescription>
            选择要爬取的平台和关键词组，系统将自动匹配相关新闻
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 平台选择 */}
          {!useWebSearch && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">选择平台</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllPlatforms}
                    disabled={loadingPlatforms}
                  >
                    全选
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAllPlatforms}
                    disabled={loadingPlatforms}
                  >
                    全不选
                  </Button>
                </div>
              </div>
            {loadingPlatforms ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                {platforms.map((platform) => (
                  <div
                    key={platform.platformId}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`platform-${platform.platformId}`}
                      checked={selectedPlatforms.includes(platform.platformId)}
                      onCheckedChange={() => togglePlatform(platform.platformId)}
                    />
                    <Label
                      htmlFor={`platform-${platform.platformId}`}
                      className="cursor-pointer flex-1"
                    >
                      {platform.name}
                    </Label>
                  </div>
                ))}
                {platforms.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-2">
                    暂无启用的平台
                  </p>
                )}
              </div>
            )}
            </div>
          )}

          {/* 爬取模式选择 */}
          <div className="space-y-3 border rounded-md p-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">爬取模式</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={!useCustomKeywords && !useWebSearch ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setUseCustomKeywords(false)
                    setUseWebSearch(false)
                  }}
                >
                  使用关键词组
                </Button>
                <Button
                  variant={useCustomKeywords && !useWebSearch ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setUseCustomKeywords(true)
                    setUseWebSearch(false)
                  }}
                >
                  自定义关键词
                </Button>
                <Button
                  variant={useWebSearch ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setUseWebSearch(true)
                    setUseCustomKeywords(false)
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  🌐 全网搜索
                </Button>
              </div>
            </div>
            {useWebSearch && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 全网搜索将使用多个搜索引擎（Google、Bing、DuckDuckGo等）搜索关键词，
                  不局限于已配置的平台，能够获取更广泛的信息源。
                </p>
              </div>
            )}
          </div>

          {/* 关键词组选择 */}
          {!useCustomKeywords && !useWebSearch && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">选择关键词组</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllKeywordGroups}
                    disabled={loadingKeywords}
                  >
                    全选
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAllKeywordGroups}
                    disabled={loadingKeywords}
                  >
                    全不选
                  </Button>
                </div>
              </div>
            {loadingKeywords ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                {keywordGroups.map((group) => (
                  <div key={group.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`keyword-${group.id}`}
                      checked={selectedKeywordGroups.includes(group.id)}
                      onCheckedChange={() => toggleKeywordGroup(group.id)}
                    />
                    <Label
                      htmlFor={`keyword-${group.id}`}
                      className="cursor-pointer flex-1"
                    >
                      {group.name || "未命名"}
                    </Label>
                  </div>
                ))}
                {keywordGroups.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-2">
                    暂无启用的关键词组
                  </p>
                )}
              </div>
            )}
            </div>
          )}

          {/* 自定义关键词输入 */}
          {(useCustomKeywords || useWebSearch) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">输入关键词</Label>
              </div>
              <Textarea
                placeholder="请输入关键词，支持用逗号、换行或空格分隔&#10;例如：&#10;电商&#10;人工智能,AI&#10;或者：电商 人工智能 AI"
                value={customKeywords}
                onChange={(e) => setCustomKeywords(e.target.value)}
                className="min-h-[120px]"
              />
              <p className="text-sm text-muted-foreground">
                {useWebSearch 
                  ? "提示：输入的关键词将用于全网搜索，使用多个搜索引擎获取信息，不局限于已配置的平台"
                  : "提示：输入的关键词将用于在各平台搜索相关新闻，而不是爬取热点"}
              </p>
              {customKeywords.trim() && (
                <div className="flex flex-wrap gap-2">
                  {customKeywords
                    .split(/[,\n\s]+/)
                    .map((k) => k.trim())
                    .filter((k) => k.length > 0)
                    .map((keyword, idx) => (
                      <Badge key={idx} variant="secondary">
                        {keyword}
                      </Badge>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* 实时匹配开关 */}
          <div className="flex items-center justify-between border rounded-md p-3">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold">实时匹配</Label>
              <p className="text-sm text-muted-foreground">
                在爬取过程中实时匹配关键词，无需等待爬取完成
              </p>
            </div>
            <Switch
              checked={enableRealtimeMatching}
              onCheckedChange={setEnableRealtimeMatching}
            />
          </div>

          {/* 预览功能 */}
          <div className="space-y-3 border rounded-md p-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">预览匹配结果</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreview}
                disabled={previewLoading || loadingPlatforms || loadingKeywords}
              >
                {previewLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    预览中...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    预览
                  </>
                )}
              </Button>
            </div>
            {previewData && (
              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">总新闻数:</span>
                  <span className="font-medium">{previewData.totalNews}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">匹配新闻数:</span>
                  <span className="font-medium text-primary">
                    {previewData.matchedNews}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">匹配率:</span>
                  <span className="font-medium">
                    {(previewData.matchRate * 100).toFixed(1)}%
                  </span>
                </div>
                {previewData.matchesByKeywordGroup.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-2">按关键词组:</p>
                    <div className="flex flex-wrap gap-2">
                      {previewData.matchesByKeywordGroup.map((item) => (
                        <Badge key={item.name} variant="outline">
                          {item.name}: {item.count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {previewData.matchesByPlatform.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-2">按平台:</p>
                    <div className="flex flex-wrap gap-2">
                      {previewData.matchesByPlatform.map((item) => (
                        <Badge key={item.name} variant="outline">
                          {item.name}: {item.count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleStart}
            disabled={
              (!useWebSearch && selectedPlatforms.length === 0) ||
              (!useCustomKeywords && !useWebSearch && selectedKeywordGroups.length === 0) ||
              ((useCustomKeywords || useWebSearch) && !customKeywords.trim())
            }
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            开始爬取
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


