"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Sparkles, Loader2, CheckCircle2, XCircle, Clock, FileText, TrendingUp, Briefcase, RefreshCw } from "lucide-react"
import { formatDate } from "@/lib/utils"
import Link from "next/link"

interface AnalysisTask {
  id: string
  type: 'personal' | 'trend' | 'business'
  sourceType: 'keyword' | 'site_group'
  sourceId: string
  sourceName: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: any
  errorMessage?: string
  tokenUsage?: number
  itemCount: number
  createdAt: string
  completedAt?: string
}

interface Subscription {
  plan: string
  quota: number
  used: number
  remaining: number
  resetAt: string
}

export default function AnalysisPage() {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<AnalysisTask[]>([])
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedTask, setSelectedTask] = useState<AnalysisTask | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // 创建分析表单
  const [formData, setFormData] = useState({
    type: 'personal' as 'personal' | 'trend' | 'business',
    sourceType: 'keyword' as 'keyword' | 'site_group',
    sourceId: '',
    customPrompt: '',
  })
  const [sources, setSources] = useState<Array<{ id: string; name: string }>>([])
  const [loadingSources, setLoadingSources] = useState(false)

  useEffect(() => {
    loadData()
    // 每5秒刷新一次，检查任务状态
    const interval = setInterval(() => {
      if (tasks.some(t => t.status === 'pending' || t.status === 'processing')) {
        loadTasks()
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [filterType, filterStatus])

  // 当数据源类型改变时，加载对应的数据源列表
  useEffect(() => {
    if (createDialogOpen) {
      loadSources(formData.sourceType)
    }
  }, [formData.sourceType, createDialogOpen])

  const loadSources = async (type: 'keyword' | 'site_group') => {
    setLoadingSources(true)
    try {
      const res = await fetch(`/api/analysis/sources?type=${type}`)
      const data = await res.json()
      if (data.success) {
        setSources(data.data || [])
      }
    } catch (error) {
      console.error('加载数据源失败:', error)
    } finally {
      setLoadingSources(false)
    }
  }

  const loadData = async () => {
    await Promise.all([loadTasks(), loadSubscription()])
  }

  const loadTasks = async () => {
    try {
      const params = new URLSearchParams()
      if (filterType !== 'all') {
        params.set('type', filterType)
      }
      if (filterStatus !== 'all') {
        params.set('status', filterStatus)
      }

      const res = await fetch(`/api/analysis/list?${params.toString()}`)
      const data = await res.json()

      if (data.success) {
        setTasks(data.data.tasks || [])
      }
    } catch (error) {
      console.error('加载分析任务失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSubscription = async () => {
    try {
      const res = await fetch('/api/analysis/subscription')
      const data = await res.json()

      if (data.success) {
        setSubscription(data.data)
      }
    } catch (error) {
      console.error('加载订阅信息失败:', error)
    }
  }

  const handleCreate = async () => {
    if (!formData.sourceId) {
      toast({
        title: "创建失败",
        description: "请选择数据源",
        variant: "destructive",
      })
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/analysis/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (data.success) {
        toast({
          title: "创建成功",
          description: "分析任务已创建，正在处理中...",
        })
        setCreateDialogOpen(false)
        setFormData({
          type: 'personal',
          sourceType: 'keyword',
          sourceId: '',
          customPrompt: '',
        })
        // 等待一下再刷新，让任务创建完成
        setTimeout(() => {
          loadTasks()
          loadSubscription()
        }, 1000)
      } else {
        throw new Error(data.error?.message || '创建失败')
      }
    } catch (error) {
      toast({
        title: "创建失败",
        description: error instanceof Error ? error.message : '未知错误',
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />已完成</Badge>
      case 'processing':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />处理中</Badge>
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />失败</Badge>
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />等待中</Badge>
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'personal':
        return <FileText className="h-4 w-4" />
      case 'trend':
        return <TrendingUp className="h-4 w-4" />
      case 'business':
        return <Briefcase className="h-4 w-4" />
      default:
        return <Sparkles className="h-4 w-4" />
    }
  }

  const getTypeName = (type: string) => {
    switch (type) {
      case 'personal':
        return '个人消化建议'
      case 'trend':
        return '事态趋势分析'
      case 'business':
        return '商情价值情报'
      default:
        return type
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI 智能分析</h1>
          <p className="text-muted-foreground mt-1">
            将爬虫结果转换为深度洞察
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Sparkles className="h-4 w-4 mr-2" />
                创建分析
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>创建 AI 分析任务</DialogTitle>
                <DialogDescription>
                  选择数据源和分析类型，AI 将为您生成深度分析报告
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>分析类型</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: 'personal' | 'trend' | 'business') =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span>个人消化吸收建议</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="trend">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          <span>事态趋势分析</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="business">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          <span>商情价值情报分析</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>数据源类型</Label>
                  <Select
                    value={formData.sourceType}
                    onValueChange={(value: 'keyword' | 'site_group') =>
                      setFormData({ ...formData, sourceType: value, sourceId: '' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyword">关键词爬虫结果</SelectItem>
                      <SelectItem value="site_group">兴趣站点爬虫结果</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>数据源</Label>
                  {loadingSources ? (
                    <div className="text-sm text-muted-foreground">加载中...</div>
                  ) : sources.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      {formData.sourceType === 'keyword'
                        ? '暂无可用的关键词组，请先在"关键词配置"页面创建关键词组'
                        : '暂无可用的站点分组，请先在"兴趣站点爬虫"页面创建站点分组'}
                    </div>
                  ) : (
                    <Select
                      value={formData.sourceId}
                      onValueChange={(value) => setFormData({ ...formData, sourceId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择数据源" />
                      </SelectTrigger>
                      <SelectContent>
                        {sources.map((source) => (
                          <SelectItem key={source.id} value={source.id}>
                            {source.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>自定义 Prompt（可选）</Label>
                  <Input
                    placeholder="留空使用默认 Prompt"
                    value={formData.customPrompt}
                    onChange={(e) => setFormData({ ...formData, customPrompt: e.target.value })}
                  />
                </div>
                {subscription && (
                  <div className="p-3 bg-muted rounded-md">
                    <div className="text-sm">
                      <span className="font-medium">剩余分析次数：</span>
                      <span className={subscription.remaining > 0 ? 'text-green-600' : 'text-red-600'}>
                        {subscription.remaining} / {subscription.quota}
                      </span>
                    </div>
                    {subscription.plan === 'free' && subscription.remaining === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        免费版每月 3 次，已用完。请升级到专业版获得更多分析次数。
                      </p>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleCreate} disabled={creating || !formData.sourceId}>
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        创建中...
                      </>
                    ) : (
                      '创建分析'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 订阅信息卡片 */}
      {subscription && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">当前计划</div>
                <div className="text-lg font-semibold">
                  {subscription.plan === 'free' ? '免费版' : subscription.plan === 'pro' ? '专业版' : '企业版'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">剩余分析次数</div>
                <div className={`text-2xl font-bold ${subscription.remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {subscription.remaining} / {subscription.quota}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 筛选和列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>分析任务列表</CardTitle>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="分析类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="personal">个人消化建议</SelectItem>
                  <SelectItem value="trend">趋势分析</SelectItem>
                  <SelectItem value="business">商情分析</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="pending">等待中</SelectItem>
                  <SelectItem value="processing">处理中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={loadTasks}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">加载中...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>暂无分析任务</p>
              <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                创建第一个分析任务
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => (
                <Card key={task.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getTypeIcon(task.type)}
                          <span className="font-semibold">{getTypeName(task.type)}</span>
                          {getStatusBadge(task.status)}
                          <Badge variant="outline">{task.sourceName}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>数据源：{task.sourceType === 'keyword' ? '关键词组' : '站点分组'} - {task.sourceName}</div>
                          <div>数据量：{task.itemCount} 条</div>
                          {task.tokenUsage && <div>Token 使用：{task.tokenUsage}</div>}
                          <div>创建时间：{formatDate(task.createdAt)}</div>
                          {task.completedAt && <div>完成时间：{formatDate(task.completedAt)}</div>}
                        </div>
                        {task.errorMessage && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                            错误：{task.errorMessage}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {task.status === 'completed' && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              // 加载完整任务详情
                              fetch(`/api/analysis/${task.id}`)
                                .then(res => res.json())
                                .then(data => {
                                  if (data.success) {
                                    setSelectedTask(data.data)
                                  }
                                })
                            }}
                          >
                            查看结果
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分析结果对话框 */}
      {selectedTask && (
        <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{getTypeName(selectedTask.type)}</DialogTitle>
              <DialogDescription>
                数据源：{selectedTask.sourceName} | 数据量：{selectedTask.itemCount} 条
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedTask.result?.content ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {selectedTask.result.content}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  分析结果加载中...
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

