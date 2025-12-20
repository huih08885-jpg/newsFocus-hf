"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Globe, Sparkles, Play, Edit, Trash2, Plus, FolderPlus, ExternalLink, Calendar, Filter, RefreshCw, Eye, Code, Search, ChevronDown, ChevronUp } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatRelativeTime, formatDate } from "@/lib/utils"
import Link from "next/link"

interface Site {
  id: string
  domain: string
  name?: string
  status: string
  analysis_status: string
  analysis_error?: string
  last_crawled_at?: string
  group_id?: string
  group_name?: string
  group_color?: string
  result_count?: number
  last_result_time?: string
  stats_json?: any
  config_json?: any
}

interface Group {
  id: string
  name: string
  description?: string
  color?: string
}

interface CrawlResult {
  id: string
  title: string
  url: string
  summary?: string
  published_at?: string
  crawled_at: string
  domain: string
  site_name?: string
  group_name?: string
  group_color?: string
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [showGroupDialog, setShowGroupDialog] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [activeTab, setActiveTab] = useState<string>("sites")
  const [viewingConfig, setViewingConfig] = useState<Site | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [selectedGroup])

  const loadData = async () => {
    try {
      setLoading(true)
      const [sitesRes, groupsRes] = await Promise.all([
        fetch(`/api/sites?groupId=${selectedGroup === "all" ? "" : selectedGroup}`),
        fetch("/api/sites/groups"),
      ])

      const sitesData = await sitesRes.json()
      const groupsData = await groupsRes.json()

      console.log('[SitesPage] Sites data:', sitesData)
      console.log('[SitesPage] Groups data:', groupsData)

      if (sitesData.success) {
        console.log('[SitesPage] Loaded sites:', sitesData.data)
        // 检查每个站点的配置
        sitesData.data?.forEach((site: Site) => {
          console.log(`[SitesPage] Site ${site.name || site.domain}:`, {
            id: site.id,
            analysis_status: site.analysis_status,
            has_config: !!site.config_json,
            config_json: site.config_json,
          })
        })
        setSites(sitesData.data || [])
      } else {
        console.error('[SitesPage] Failed to load sites:', sitesData.error)
        toast({ title: "加载失败", description: sitesData.error, variant: "destructive" })
      }
      
      if (groupsData.success) {
        setGroups(groupsData.data || [])
      }
    } catch (error) {
      console.error("Error loading data:", error)
      toast({ title: "加载失败", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyze = async (siteId: string) => {
    try {
      setAnalyzing(siteId)
      const res = await fetch(`/api/sites/${siteId}/analyze`, { method: "POST" })
      const data = await res.json()

      if (data.success) {
        toast({ title: "分析成功", description: "已生成爬虫配置" })
        loadData()
      } else {
        toast({ title: "分析失败", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "分析失败", variant: "destructive" })
    } finally {
      setAnalyzing(null)
    }
  }

  const handleCrawl = async (siteId: string, type: "today" | "range" = "today") => {
    try {
      console.log('[SitesPage] handleCrawl called for site:', siteId, 'type:', type)
      
      // 检查站点状态
      const site = sites.find(s => s.id === siteId)
      console.log('[SitesPage] Site found:', site)
      
      if (site && site.analysis_status !== "success") {
        toast({ 
          title: "无法执行爬虫", 
          description: "请先分析站点HTML结构，生成爬虫配置后再执行爬虫", 
          variant: "destructive" 
        })
        return
      }

      console.log('[SitesPage] Sending crawl request...')
      const requestBody = {
        siteIds: [siteId],
        type,
      }
      console.log('[SitesPage] Request body:', requestBody)
      
      const res = await fetch("/api/sites/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })
      
      console.log('[SitesPage] Response status:', res.status, res.statusText)
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('[SitesPage] Response error:', errorText)
        throw new Error(`HTTP ${res.status}: ${errorText}`)
      }
      
      const data = await res.json()
      console.log('[SitesPage] Response data:', data)

      if (data.success) {
        if (data.data && data.data.length === 0) {
          toast({ 
            title: "无法创建任务", 
            description: "站点未启用爬虫或配置不存在，请先分析站点", 
            variant: "destructive" 
          })
          return
        }
        
        console.log('[SitesPage] Tasks created:', data.data)
        toast({ 
          title: "爬虫任务已创建", 
          description: "正在后台执行，3秒后自动跳转到「爬虫结果」标签页" 
        })
        loadData()
        // 3秒后自动切换到爬虫结果标签页
        setTimeout(() => {
          setActiveTab("results")
        }, 3000)
      } else {
        console.error('[SitesPage] Task creation failed:', data.error)
        toast({ title: "创建失败", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      console.error('[SitesPage] Error in handleCrawl:', error)
      toast({ title: "创建失败", description: error instanceof Error ? error.message : 'Unknown error', variant: "destructive" })
    }
  }

  const handleCreateGroup = async () => {
    try {
      const res = await fetch("/api/sites/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName }),
      })
      const data = await res.json()

      if (data.success) {
        toast({ title: "分组已创建" })
        setShowGroupDialog(false)
        setNewGroupName("")
        loadData()
      }
    } catch (error) {
      toast({ title: "创建失败", variant: "destructive" })
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      new: { label: "新站点", variant: "outline" },
      analyzing: { label: "分析中", variant: "secondary" },
      success: { label: "已配置", variant: "default" },
      failed: { label: "分析失败", variant: "destructive" },
    }
    const config = statusMap[status] || { label: status, variant: "outline" }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">兴趣站点爬虫</h1>
          <p className="text-muted-foreground mt-1">管理从发现站点中添加的站点，进行HTML分析和爬虫</p>
        </div>
        <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
          <DialogTrigger asChild>
            <Button>
              <FolderPlus className="mr-2 h-4 w-4" />
              新建分组
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建分组</DialogTitle>
              <DialogDescription>创建一个新的站点分组</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>分组名称</Label>
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="输入分组名称"
                />
              </div>
              <Button onClick={handleCreateGroup} className="w-full">
                创建
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value)
        // 当切换到爬虫结果标签页时，触发刷新
        if (value === "results") {
          // 通过事件通知 CrawlResultsTab 刷新
          window.dispatchEvent(new CustomEvent('refreshCrawlResults'))
        }
      }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="sites">站点管理</TabsTrigger>
          <TabsTrigger value="results">爬虫结果</TabsTrigger>
        </TabsList>

        <TabsContent value="sites" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>站点列表</CardTitle>
              <CardDescription>管理已添加的站点，进行HTML分析和爬虫配置</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-2">
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="选择分组" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部分组</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="text-center py-8">加载中...</div>
              ) : sites.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">暂无站点</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sites.map((site) => (
                    <Card key={site.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{site.name || site.domain}</CardTitle>
                            <CardDescription className="mt-1">{site.domain}</CardDescription>
                          </div>
                          {site.group_name && (
                            <Badge style={{ backgroundColor: site.group_color || undefined }}>
                              {site.group_name}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(site.analysis_status)}
                          {site.result_count !== undefined && (
                            <Badge variant="outline">{site.result_count} 条结果</Badge>
                          )}
                        </div>

                        {site.analysis_error && (
                          <p className="text-sm text-destructive">{site.analysis_error}</p>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {site.analysis_status !== "success" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAnalyze(site.id)}
                              disabled={analyzing === site.id}
                            >
                              <Sparkles className="mr-1 h-3 w-3" />
                              {analyzing === site.id ? "分析中..." : "分析HTML"}
                            </Button>
                          )}
                          {site.analysis_status === "success" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setViewingConfig(site)}
                              >
                                <Eye className="mr-1 h-3 w-3" />
                                查看配置
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleCrawl(site.id, "today")}
                              >
                                <Play className="mr-1 h-3 w-3" />
                                今日爬虫
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          <CrawlResultsTab groups={groups} sites={sites} />
        </TabsContent>
      </Tabs>

      {/* 查看配置对话框 */}
      <Dialog open={!!viewingConfig} onOpenChange={(open) => !open && setViewingConfig(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>爬虫配置详情</DialogTitle>
            <DialogDescription>
              {viewingConfig?.name || viewingConfig?.domain} 的分析结果
            </DialogDescription>
          </DialogHeader>
          {viewingConfig && (
            <ConfigViewer config={viewingConfig.config_json} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// 配置查看器组件
function ConfigViewer({ config }: { config: any }) {
  if (!config) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        暂无配置信息
      </div>
    )
  }

  const renderFieldConfig = (field: any, label: string) => {
    if (!field) return null
    return (
      <div className="space-y-1">
        <div className="font-medium text-sm">{label}:</div>
        <div className="pl-4 space-y-1 text-sm">
          {field.selector && (
            <div className="flex items-center gap-2">
              <Code className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">选择器:</span>
              <code className="px-2 py-0.5 bg-muted rounded text-xs">{field.selector}</code>
            </div>
          )}
          {field.attribute && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">属性:</span>
              <code className="px-2 py-0.5 bg-muted rounded text-xs">{field.attribute}</code>
            </div>
          )}
          {field.regex && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">正则:</span>
              <code className="px-2 py-0.5 bg-muted rounded text-xs">{field.regex}</code>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 基础信息 */}
      {config.baseUrl && (
        <div>
          <div className="font-medium mb-2">基础URL:</div>
          <code className="px-3 py-2 bg-muted rounded block text-sm">{config.baseUrl}</code>
        </div>
      )}

      {/* 列表配置 */}
      {config.list && (
        <div className="space-y-4 p-4 border rounded-lg">
          <div className="font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4" />
            列表页配置
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="font-medium text-sm mb-1">列表URL:</div>
              <code className="px-2 py-1 bg-muted rounded text-xs block">{config.list.url}</code>
            </div>

            {config.list.method && (
              <div>
                <div className="font-medium text-sm mb-1">请求方法:</div>
                <Badge variant="outline">{config.list.method}</Badge>
              </div>
            )}

            {config.list.itemSelector && (
              <div>
                <div className="font-medium text-sm mb-1">项目选择器:</div>
                <code className="px-2 py-1 bg-muted rounded text-xs">{config.list.itemSelector}</code>
              </div>
            )}

            {config.list.limit && (
              <div>
                <div className="font-medium text-sm mb-1">限制数量:</div>
                <Badge variant="outline">{config.list.limit} 条</Badge>
              </div>
            )}

            {config.list.fields && (
              <div className="space-y-3 pt-2 border-t">
                <div className="font-medium text-sm">字段映射:</div>
                <div className="space-y-3 pl-4">
                  {renderFieldConfig(config.list.fields.title, "标题")}
                  {renderFieldConfig(config.list.fields.url, "链接")}
                  {renderFieldConfig(config.list.fields.publishedAt, "发布时间")}
                  {renderFieldConfig(config.list.fields.snippet, "摘要")}
                </div>
              </div>
            )}

            {config.list.headers && Object.keys(config.list.headers).length > 0 && (
              <div>
                <div className="font-medium text-sm mb-1">请求头:</div>
                <pre className="px-3 py-2 bg-muted rounded text-xs overflow-x-auto">
                  {JSON.stringify(config.list.headers, null, 2)}
                </pre>
              </div>
            )}

            {config.list.params && Object.keys(config.list.params).length > 0 && (
              <div>
                <div className="font-medium text-sm mb-1">请求参数:</div>
                <pre className="px-3 py-2 bg-muted rounded text-xs overflow-x-auto">
                  {JSON.stringify(config.list.params, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 搜索配置 */}
      {config.search && (
        <div className="space-y-4 p-4 border rounded-lg">
          <div className="font-semibold flex items-center gap-2">
            <Search className="h-4 w-4" />
            搜索配置
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="font-medium text-sm mb-1">搜索URL:</div>
              <code className="px-2 py-1 bg-muted rounded text-xs block">{config.search.url}</code>
            </div>

            {config.search.itemSelector && (
              <div>
                <div className="font-medium text-sm mb-1">项目选择器:</div>
                <code className="px-2 py-1 bg-muted rounded text-xs">{config.search.itemSelector}</code>
              </div>
            )}

            {config.search.fields && (
              <div className="space-y-3 pt-2 border-t">
                <div className="font-medium text-sm">字段映射:</div>
                <div className="space-y-3 pl-4">
                  {renderFieldConfig(config.search.fields.title, "标题")}
                  {renderFieldConfig(config.search.fields.url, "链接")}
                  {renderFieldConfig(config.search.fields.publishedAt, "发布时间")}
                  {renderFieldConfig(config.search.fields.snippet, "摘要")}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 原始JSON（可折叠） */}
      <details className="mt-4">
        <summary className="cursor-pointer font-medium text-sm text-muted-foreground hover:text-foreground">
          查看原始JSON配置
        </summary>
        <pre className="mt-2 px-4 py-3 bg-muted rounded text-xs overflow-x-auto">
          {JSON.stringify(config, null, 2)}
        </pre>
      </details>
    </div>
  )
}

// 爬虫结果项组件（支持展开/收起）
function CrawlResultItem({ result }: { result: CrawlResult }) {
  const [expanded, setExpanded] = useState(false)
  const summaryLength = result.summary?.length || 0
  const shouldShowExpand = summaryLength > 150
  
  // 将摘要按换行符分割成段落
  const summaryParagraphs = result.summary ? result.summary.split('\n').filter(line => line.trim() !== '') : []
  const visibleParagraphs = expanded ? summaryParagraphs : summaryParagraphs.slice(0, 3)

  return (
    <Card key={result.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {result.group_name && (
                <Badge
                  variant="outline"
                  style={{ backgroundColor: result.group_color || undefined }}
                >
                  {result.group_name}
                </Badge>
              )}
              <Badge variant="secondary">{result.site_name || result.domain}</Badge>
              {result.published_at ? (
                <Badge variant="outline" className="text-xs">
                  <Calendar className="inline h-3 w-3 mr-1" />
                  {formatDate(result.published_at)}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">
                  <Calendar className="inline h-3 w-3 mr-1" />
                  爬取：{formatDate(result.crawled_at)}
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold mb-2 line-clamp-2">
              {result.title}
            </h3>
            {/* 来源标注 */}
            <div className="mb-2 text-xs text-muted-foreground">
              <span>来源：</span>
              <a
                href={`https://${result.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {result.site_name || result.domain}
              </a>
            </div>
            {result.summary && (
              <div className="text-sm text-muted-foreground mb-3">
                <div 
                  style={{
                    wordBreak: 'break-word',
                    lineHeight: '1.6',
                  }}
                >
                  {visibleParagraphs.map((paragraph, index) => (
                    <p key={index} className="mb-3 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                  {!expanded && summaryParagraphs.length > 3 && (
                    <p className="mb-3 text-muted-foreground/70 italic">
                      ...还有 {summaryParagraphs.length - 3} 段内容
                    </p>
                  )}
                </div>
                {shouldShowExpand && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-auto p-0 text-primary hover:text-primary/80"
                    onClick={() => setExpanded(!expanded)}
                  >
                    {expanded ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-1" />
                        收起
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-1" />
                        展开
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                <span>查看原文</span>
              </a>
              <span className="text-xs text-muted-foreground">|</span>
              <span className="text-xs text-muted-foreground">
                本文内容来源于网络，版权归原作者所有
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// 爬虫结果标签页组件
function CrawlResultsTab({ groups, sites }: { groups: Group[]; sites: Site[] }) {
  const [results, setResults] = useState<CrawlResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroupTab, setSelectedGroupTab] = useState<string>("all")
  const [selectedSite, setSelectedSite] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20
  const { toast } = useToast()

  useEffect(() => {
    loadResults()
  }, [selectedGroupTab, selectedSite, dateFrom, dateTo, page])

  // 监听刷新事件
  useEffect(() => {
    const handleRefresh = () => {
      loadResults()
    }
    window.addEventListener('refreshCrawlResults', handleRefresh)
    return () => {
      window.removeEventListener('refreshCrawlResults', handleRefresh)
    }
  }, [selectedGroupTab, selectedSite, dateFrom, dateTo, page])

  const loadResults = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      })

      if (selectedGroupTab !== "all") {
        params.append("groupId", selectedGroupTab)
      }
      if (selectedSite !== "all") {
        params.append("siteId", selectedSite)
      }
      if (dateFrom) {
        params.append("startDate", dateFrom)
      }
      if (dateTo) {
        params.append("endDate", dateTo)
      }

      const res = await fetch(`/api/sites/crawl/results?${params.toString()}`)
      const data = await res.json()

      if (data.success) {
        setResults(data.data.items || [])
        setTotal(data.data.total || 0)
      }
    } catch (error) {
      console.error("Error loading results:", error)
      toast({ title: "加载失败", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleResetFilters = () => {
    setSelectedGroupTab("all")
    setSelectedSite("all")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  // 获取分组统计（每个分组的结果数量）
  const [groupStats, setGroupStats] = useState<Record<string, number>>({})
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => {
    const loadGroupStats = async () => {
      if (groups.length === 0) return
      
      setStatsLoading(true)
      const stats: Record<string, number> = {}
      
      try {
        // 并行获取所有统计
        const promises = [
          fetch("/api/sites/crawl/results?pageSize=1").then(r => r.json()),
          ...groups.map(group =>
            fetch(`/api/sites/crawl/results?groupId=${group.id}&pageSize=1`).then(r => r.json())
          )
        ]

        const results = await Promise.all(promises)
        
        // 全部结果
        if (results[0]?.success) {
          stats.all = results[0].data?.total || 0
        }

        // 各分组结果
        results.slice(1).forEach((result, index) => {
          if (result?.success) {
            stats[groups[index].id] = result.data?.total || 0
          }
        })
        
        setGroupStats(stats)
      } catch (error) {
        console.error("Error loading group stats:", error)
      } finally {
        setStatsLoading(false)
      }
    }

    loadGroupStats()
  }, [groups])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>爬虫结果</CardTitle>
          <CardDescription>查看所有站点的爬虫结果，支持按分组和站点筛选</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 操作栏 */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              爬虫结果会在任务完成后自动显示，请稍后刷新查看
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadResults()}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>

          {/* 筛选器 */}
          <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">筛选：</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">站点：</Label>
              <Select value={selectedSite} onValueChange={(v) => { setSelectedSite(v); setPage(1) }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部站点</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name || site.domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">开始日期：</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                className="w-[150px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">结束日期：</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                className="w-[150px]"
              />
            </div>

            <Button variant="outline" size="sm" onClick={handleResetFilters}>
              重置
            </Button>
          </div>

          {/* 分组标签页 */}
          <Tabs value={selectedGroupTab} onValueChange={(v) => { setSelectedGroupTab(v); setPage(1) }}>
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="all" className="flex items-center gap-2">
                全部
                {groupStats.all !== undefined && (
                  <Badge variant="secondary" className="ml-1">
                    {groupStats.all}
                  </Badge>
                )}
              </TabsTrigger>
              {groups.map((group) => (
                <TabsTrigger key={group.id} value={group.id} className="flex items-center gap-2">
                  {group.name}
                  {groupStats[group.id] !== undefined && (
                    <Badge variant="secondary" className="ml-1" style={{ backgroundColor: group.color || undefined }}>
                      {groupStats[group.id]}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedGroupTab} className="mt-4">
              {loading ? (
                <div className="text-center py-8">加载中...</div>
              ) : results.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {selectedGroupTab === "all" ? "暂无爬虫结果" : "该分组暂无结果"}
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {results.map((result) => (
                      <CrawlResultItem key={result.id} result={result} />
                    ))}
                  </div>

                  {/* 分页 */}
                  {total > pageSize && (
                    <div className="flex items-center justify-between mt-6">
                      <div className="text-sm text-muted-foreground">
                        共 {total} 条结果，第 {page} 页，共 {Math.ceil(total / pageSize)} 页
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          上一页
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
                          disabled={page >= Math.ceil(total / pageSize)}
                        >
                          下一页
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

