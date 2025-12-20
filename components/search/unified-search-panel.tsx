"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Globe, PlusCircle, Sparkles, Search, CheckCircle } from "lucide-react"

interface KeywordGroupOption {
  id: string
  name?: string | null
}

interface UnifiedSearchResult {
  title: string
  url: string
  source: string
  snippet?: string | null
  rank?: number
  confidence?: number
  publishedAt?: string | null // 发布时间
}

interface ConfigPreview {
  config: any
  stats: {
    itemSelector: string
    titleSelector: string
    urlSelector: string
    samples: Array<{ title: string; url?: string }>
  }
}

interface UnifiedSearchPanelProps {
  keywordGroups: KeywordGroupOption[]
}

const SEARCH_ENGINE_OPTIONS = [
  { id: "baidu", label: "百度搜索" },
  { id: "bing", label: "Bing搜索" },
  // { id: "nano", label: "360搜索" }, // 已禁用：暂无公开API，HTML解析不稳定
]

const PLATFORM_SEARCH_OPTIONS = [
  { id: "weibo", label: "微博" },
  { id: "bilibili", label: "B站" },
  { id: "baidu", label: "百度热榜" },
  { id: "toutiao", label: "今日头条" },
]

export function UnifiedSearchPanel({ keywordGroups }: UnifiedSearchPanelProps) {
  const [keywordsInput, setKeywordsInput] = useState("")
  const [selectedGroup, setSelectedGroup] = useState<string>("none")
  const [selectedEngines, setSelectedEngines] = useState<string[]>(["baidu", "bing"]) // 默认选择百度和Bing
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<UnifiedSearchResult[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const pageSize = 30 // 每页30条（10+10+10）
  const [inferLoading, setInferLoading] = useState(false)
  const [configPreview, setConfigPreview] = useState<ConfigPreview | null>(null)
  const [currentInferItem, setCurrentInferItem] = useState<UnifiedSearchResult | null>(null)
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [usingConfig, setUsingConfig] = useState(false)
  const { toast } = useToast()

  const parsedKeywords = () =>
    keywordsInput
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean)

  const handleSearch = async (page: number = 1) => {
    const keywords = parsedKeywords()
    if (keywords.length === 0) {
      toast({
        title: "请输入关键词",
        description: "支持换行或逗号分隔多个词。",
        variant: "destructive",
      })
      return
    }

    // 使用用户选择的搜索引擎，如果没有选择则使用默认的（百度和Bing）
    const enginesToUse = selectedEngines.length > 0 
      ? selectedEngines 
      : ['baidu', 'bing']

    try {
      setLoading(true)
      
      // 确保所有数据都是可序列化的纯数据
      const payload = {
        keywords: Array.isArray(keywords) ? keywords.filter(k => typeof k === 'string') : [],
          searchEngines: Array.isArray(enginesToUse) 
          ? enginesToUse.filter(e => typeof e === 'string') 
          : ['baidu', 'bing'],
        includePlatforms: Array.isArray(selectedPlatforms) && selectedPlatforms.length > 0
          ? selectedPlatforms.filter(p => typeof p === 'string')
          : undefined,
        limitPerPlatform: 10, // 每个搜索引擎每次返回10条
        page: typeof page === 'number' ? page : 1,
        pageSize: typeof pageSize === 'number' ? pageSize : 30,
      }
      
      const res = await fetch("/api/search/unified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "搜索失败")
      }
      
      // 新的API返回格式包含分页信息
      const resultData = data.data
      if (page === 1) {
        setResults(resultData.results || [])
      } else {
        // 追加结果
        setResults(prev => [...prev, ...(resultData.results || [])])
      }
      setTotalResults(resultData.total || 0)
      setHasMore(resultData.hasMore || false)
      setCurrentPage(page)
      
      toast({
        title: "搜索完成",
        description: `第${page}页：显示 ${resultData.results?.length || 0} 条，共 ${resultData.total || 0} 条结果`,
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "搜索失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      handleSearch(currentPage + 1)
    }
  }

  const handleSubscribe = async (item: UnifiedSearchResult) => {
    try {
    const payload = {
      keywordGroupId: selectedGroup && selectedGroup !== "none" ? selectedGroup : undefined,
        domain: safeDomain(item.url),
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        metadata: {
          source: item.source,
          confidence: item.confidence,
        },
      }
      const res = await fetch("/api/search/site/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "加入候选失败")
      }
      toast({
        title: "已加入候选",
        description: `${safeDomain(item.url)} 已记录到候选站点列表`,
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "加入候选失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    }
  }

  const handleInferConfig = async (item: UnifiedSearchResult) => {
    try {
      setInferLoading(true)
      const res = await fetch("/api/search/site/infer-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.url }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "推断失败")
      }
      setConfigPreview(data.data)
      setCurrentInferItem(item)
      setShowConfigDialog(true)
    } catch (error) {
      console.error(error)
      toast({
        title: "推断失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setInferLoading(false)
    }
  }

  const handleCopyConfig = () => {
    if (!configPreview) return
    navigator.clipboard.writeText(JSON.stringify(configPreview.config, null, 2))
    toast({
      title: "已复制配置",
      description: "可直接粘贴到自定义网站配置中。",
    })
  }

  const getDomainFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace(/^www\./, "")
    } catch {
      return url
    }
  }

  const handleUseConfig = async () => {
    if (!configPreview || !currentInferItem) {
      toast({
        title: "配置不可用",
        description: "请先推断配置",
        variant: "destructive",
      })
      return
    }

    if (!selectedGroup || selectedGroup === "none") {
      toast({
        title: "请选择关键词组",
        description: "需要先选择关键词组才能使用配置",
        variant: "destructive",
      })
      return
    }

    try {
      setUsingConfig(true)

      // 获取当前关键词组的配置
      const groupRes = await fetch(`/api/config/keywords/${selectedGroup}`)
      if (!groupRes.ok) {
        throw new Error("获取关键词组配置失败")
      }
      const groupData = await groupRes.json()
      if (!groupData.success) {
        throw new Error(groupData.error?.message || "获取关键词组配置失败")
      }

      const currentGroup = groupData.data
      const existingWebsites = Array.isArray(currentGroup.customWebsites)
        ? currentGroup.customWebsites
        : []

      // 从 URL 提取域名作为网站名称
      const domain = getDomainFromUrl(currentInferItem.url)
      const websiteName = domain || "新网站"

      // 检查是否已存在相同 URL 的网站
      const existingIndex = existingWebsites.findIndex(
        (ws: any) => ws.config?.list?.url === configPreview.config.list?.url
      )

      const newWebsite = {
        id: existingIndex >= 0
          ? existingWebsites[existingIndex].id
          : `website-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: websiteName,
        enabled: true,
        config: configPreview.config,
      }

      const updatedWebsites = existingIndex >= 0
        ? existingWebsites.map((ws: any, idx: number) =>
            idx === existingIndex ? newWebsite : ws
          )
        : [...existingWebsites, newWebsite]

      // 更新关键词组
      const updateRes = await fetch(`/api/config/keywords/${selectedGroup}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: currentGroup.name,
          words: currentGroup.words,
          requiredWords: currentGroup.requiredWords || [],
          excludedWords: currentGroup.excludedWords || [],
          priority: currentGroup.priority,
          enabled: currentGroup.enabled,
          customWebsites: updatedWebsites,
        }),
      })

      const updateData = await updateRes.json()
      if (!updateRes.ok || !updateData.success) {
        throw new Error(updateData.error?.message || "更新关键词组失败")
      }

      toast({
        title: "配置已添加",
        description: `${websiteName} 已添加到关键词组 "${currentGroup.name || "未命名组"}" 的自定义网站列表中`,
      })

      // 关闭对话框
      setShowConfigDialog(false)
      setConfigPreview(null)
      setCurrentInferItem(null)
    } catch (error) {
      console.error(error)
      toast({
        title: "使用配置失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setUsingConfig(false)
    }
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Search className="h-5 w-5 text-primary" />
          统一搜索（发现新站点）
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          使用多个搜索引擎（百度、Bing等）获取搜索结果。
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <Textarea
            value={keywordsInput}
            onChange={(e) => setKeywordsInput(e.target.value)}
            placeholder="例如：跨境电商, 锂电池, 台湾 数据要素"
            className="min-h-[90px]"
          />
          <div className="flex w-full flex-col gap-2 md:max-w-xs">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue placeholder="选择关键词组（可选）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不绑定关键词组</SelectItem>
                {keywordGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name || "未命名组"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => handleSearch(1)} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  搜索中...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  开始搜索
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 border rounded-md p-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">搜索引擎</p>
            <p className="text-xs text-muted-foreground">
              支持多个搜索引擎，每个引擎每次返回10条结果。Bing支持API和HTML解析两种方式。
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              {SEARCH_ENGINE_OPTIONS.map((engine) => (
                <label key={engine.id} className="flex items-center space-x-2 text-sm">
                  <Checkbox
                    checked={selectedEngines.includes(engine.id)}
                    onCheckedChange={(checked) => {
                      setSelectedEngines((prev) =>
                        checked
                          ? Array.from(new Set([...prev, engine.id]))
                          : prev.filter((id) => id !== engine.id)
                      )
                    }}
                  />
                  <span>{engine.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">可选：同时搜索内置平台</p>
            <p className="text-xs text-muted-foreground">
              默认关闭，避免重复消耗已有平台资源；如需即时搜索，可在此选择。
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              {PLATFORM_SEARCH_OPTIONS.map((platform) => (
                <label key={platform.id} className="flex items-center space-x-2 text-sm">
                  <Checkbox
                    checked={selectedPlatforms.includes(platform.id)}
                    onCheckedChange={(checked) => {
                      setSelectedPlatforms((prev) =>
                        checked
                          ? Array.from(new Set([...prev, platform.id]))
                          : prev.filter((id) => id !== platform.id)
                      )
                    }}
                  />
                  <span>{platform.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((item, index) => (
              <Card key={`${item.url}-${index}`} className="border-muted">
                <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary hover:underline"
                      >
                        {item.title}
                      </a>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {item.source}
                      </Badge>
                      {item.rank && (
                        <Badge variant="secondary">Rank #{item.rank}</Badge>
                      )}
                    </div>
                    {item.snippet && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.snippet}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <p className="break-all">{item.url}</p>
                      {item.publishedAt && (
                        <span className="whitespace-nowrap flex-shrink-0">【{item.publishedAt}】</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 md:w-[220px]">
                    <Button variant="outline" onClick={() => handleSubscribe(item)}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      加入候选
                    </Button>
                    <Button variant="outline" onClick={() => handleInferConfig(item)} disabled={inferLoading}>
                      {inferLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          推断中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          自动推断配置
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {results.length === 0 && !loading && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            暂无搜索结果，输入关键词后点击"开始搜索"即可从全平台获取实时线索。
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div className="text-sm text-muted-foreground">
              已显示 {results.length} / {totalResults} 条结果
            </div>
            {hasMore && (
              <Button onClick={handleLoadMore} disabled={loading} variant="outline">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    加载中...
                  </>
                ) : (
                  "加载更多"
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>自动推断的配置</DialogTitle>
          </DialogHeader>
          {configPreview ? (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm">
                <div>
                  <span className="font-medium">列表选择器：</span>
                  {configPreview.stats.itemSelector}
                </div>
                <div>
                  <span className="font-medium">标题选择器：</span>
                  {configPreview.stats.titleSelector}
                </div>
                <div>
                  <span className="font-medium">链接选择器：</span>
                  {configPreview.stats.urlSelector}
                </div>
              </div>
              {configPreview.stats.samples.length > 0 && (
                <div className="rounded-md border p-3 text-sm">
                  <div className="mb-2 font-semibold">样例预览</div>
                  <ul className="space-y-1">
                    {configPreview.stats.samples.map((sample, idx) => (
                      <li key={idx} className="text-muted-foreground">
                        • {sample.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">配置 JSON</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={handleCopyConfig}>
                      复制
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleUseConfig}
                      disabled={usingConfig || !selectedGroup || selectedGroup === "none"}
                    >
                      {usingConfig ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          添加中...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          直接使用
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <Textarea
                  readOnly
                  value={JSON.stringify(configPreview.config, null, 2)}
                  className="h-48 font-mono text-xs"
                />
                {(!selectedGroup || selectedGroup === "none") && (
                  <p className="text-xs text-muted-foreground">
                    💡 提示：选择关键词组后，可点击"直接使用"按钮将配置添加到该关键词组
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无配置。</p>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function safeDomain(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

