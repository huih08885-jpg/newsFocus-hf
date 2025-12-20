"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, TestTube, RefreshCw, Eye, Globe } from "lucide-react"
import { KeywordFormDialog } from "@/components/keywords/keyword-form-dialog"
import { KeywordTestDialog } from "@/components/keywords/keyword-test-dialog"
import { useToast } from "@/hooks/use-toast"
import type { KeywordGroup } from "@/lib/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function KeywordsPage() {
  const { toast } = useToast()
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<KeywordGroup | undefined>()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testingGroup, setTestingGroup] = useState<KeywordGroup | undefined>()
  const [candidateGroup, setCandidateGroup] = useState<KeywordGroup | null>(null)

  const loadKeywordGroups = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/config/keywords")
      const data = await res.json()
      if (data.success) {
        setKeywordGroups(data.data.items || [])
      }
    } catch (error) {
      toast({
        title: "错误",
        description: "加载关键词组失败",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadKeywordGroups()
  }, [])

  const handleDelete = async () => {
    if (!deletingId) return

    try {
      const res = await fetch(`/api/config/keywords/${deletingId}`, {
        method: "DELETE",
      })
      const data = await res.json()

      if (data.success) {
        toast({
          title: "成功",
          description: "关键词组已删除",
          variant: "success",
        })
        loadKeywordGroups()
      } else {
        throw new Error(data.error?.message || "删除失败")
      }
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "删除失败",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setDeletingId(null)
    }
  }

  const handleTest = (group: KeywordGroup) => {
    setTestingGroup(group)
    setTestDialogOpen(true)
  }

  const handleMatchAll = async () => {
    try {
      const res = await fetch("/api/news/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ all: true }),
      })

      const data = await res.json()

      if (data.success) {
        toast({
          title: "匹配成功",
          description: `成功匹配 ${data.data.matchedCount} 条新闻（共 ${data.data.totalNews} 条）`,
          variant: "success",
        })
      } else {
        throw new Error(data.error?.message || "匹配失败")
      }
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "匹配失败",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">关键词配置</h1>
          <p className="text-muted-foreground mt-1">
            管理关键词匹配规则
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleMatchAll}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            手动匹配所有新闻
          </Button>
          <Button
            onClick={() => {
              setEditingGroup(undefined)
              setDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            添加关键词组
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>关键词组列表</CardTitle>
          <CardDescription>配置和管理关键词匹配规则</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border rounded-lg p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : keywordGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>暂无关键词组</p>
              <Button
                className="mt-4"
                onClick={() => {
                  setEditingGroup(undefined)
                  setDialogOpen(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                添加第一个关键词组
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {keywordGroups.map((group) => (
                <div
                  key={group.id}
                  className="border rounded-lg p-4 hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-lg">
                          {group.name || "未命名"}
                        </h3>
                        <Badge variant={group.enabled ? "success" : "secondary"}>
                          {group.enabled ? "启用" : "禁用"}
                        </Badge>
                        <Badge variant="outline">优先级: {group.priority}</Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium">普通词:</span>{" "}
                          {group.words.length > 0
                            ? group.words.join(", ")
                            : "无"}
                        </p>
                        {group.requiredWords.length > 0 && (
                          <p>
                            <span className="font-medium">必须词:</span>{" "}
                            {group.requiredWords
                              .map((w) => w.replace(/^\+/, ""))
                              .join(", ")}
                          </p>
                        )}
                        {group.excludedWords.length > 0 && (
                          <p>
                            <span className="font-medium">过滤词:</span>{" "}
                            {group.excludedWords
                              .map((w) => w.replace(/^!/, ""))
                              .join(", ")}
                          </p>
                        )}
                        {group.customWebsites && Array.isArray(group.customWebsites) && group.customWebsites.length > 0 && (
                          <p>
                            <span className="font-medium">自定义网站:</span>{" "}
                            {group.customWebsites
                              .filter((ws: any) => ws && ws.enabled !== false)
                              .map((ws: any) => ws.name || "未命名")
                              .join(", ")}
                            {group.customWebsites.filter((ws: any) => ws && ws.enabled === false).length > 0 && (
                              <span className="text-muted-foreground ml-2">
                                (已禁用: {group.customWebsites.filter((ws: any) => ws && ws.enabled === false).length}个)
                              </span>
                            )}
                          </p>
                        )}
                        <DiscoveredWebsitesPreview
                          group={group}
                          onView={() => setCandidateGroup(group)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(group)}
                      >
                        <TestTube className="h-4 w-4 mr-1" />
                        测试
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingGroup(group)
                          setDialogOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        编辑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDeletingId(group.id)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <KeywordFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        keywordGroup={editingGroup}
        onSuccess={loadKeywordGroups}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个关键词组吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {testingGroup && (
        <KeywordTestDialog
          open={testDialogOpen}
          onOpenChange={setTestDialogOpen}
          keywordGroup={testingGroup}
        />
      )}

      <CandidateDialog
        group={candidateGroup}
        onClose={() => setCandidateGroup(null)}
        onEdit={() => {
          if (candidateGroup) {
            setEditingGroup(candidateGroup)
            setDialogOpen(true)
          }
          setCandidateGroup(null)
        }}
      />
    </div>
  )
}

type DiscoveredCandidate = {
  candidateId?: string
  domain?: string
  title?: string
  url?: string
  snippet?: string
  createdAt?: string
}

function parseDiscoveredWebsites(value: KeywordGroup["discoveredWebsites"]): DiscoveredCandidate[] {
  if (!Array.isArray(value)) return []
  const list: DiscoveredCandidate[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const candidate = {
      candidateId: (item as any).candidateId ?? (item as any).id,
      domain: (item as any).domain ?? tryExtractDomain((item as any).url),
      title: (item as any).title,
      url: (item as any).url,
      snippet: (item as any).snippet,
      createdAt: (item as any).createdAt,
    }
    const key = candidate.candidateId || candidate.url || candidate.domain
    if (!key || seen.has(key)) continue
    seen.add(key)
    list.push(candidate)
  }
  return list.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return tb - ta
  })
}

function tryExtractDomain(url?: string) {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return undefined
  }
}

function DiscoveredWebsitesPreview({
  group,
  onView,
}: {
  group: KeywordGroup
  onView: () => void
}) {
  const candidates = parseDiscoveredWebsites(group.discoveredWebsites)
  if (!candidates.length) return null
  const preview = candidates.slice(0, 3)
  return (
    <div className="pt-2 border-t mt-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium">候选站点</span>
        <Badge variant="outline">{candidates.length}</Badge>
        <Button variant="ghost" size="sm" onClick={onView}>
          <Eye className="h-4 w-4 mr-1" />
          查看
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {preview.map((item) => (
          <span
            key={item.candidateId || item.url || item.domain}
            className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground flex items-center gap-1"
          >
            <Globe className="h-3 w-3" />
            {item.domain || item.title || item.url}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        可在“编辑”对话框中使用「导入候选」快速生成配置。
      </p>
    </div>
  )
}

function CandidateDialog({
  group,
  onClose,
  onEdit,
}: {
  group: KeywordGroup | null
  onClose: () => void
  onEdit: () => void
}) {
  const candidates = group ? parseDiscoveredWebsites(group.discoveredWebsites) : []
  return (
    <Dialog open={!!group} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            候选站点 - {group?.name || "未命名"}
          </DialogTitle>
        </DialogHeader>
        {!candidates.length ? (
          <p className="text-sm text-muted-foreground">暂无候选站点。</p>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {candidates.map((item) => (
              <Card key={item.candidateId || item.url || item.domain}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{item.title || item.domain || item.url}</span>
                    {item.url && (
                      <span className="text-xs text-muted-foreground break-all">
                        {item.url}
                      </span>
                    )}
                  </div>
                  {item.snippet && (
                    <p className="text-sm text-muted-foreground">{item.snippet}</p>
                  )}
                  {item.createdAt && (
                    <p className="text-xs text-muted-foreground">
                      发现时间：{new Date(item.createdAt).toLocaleString("zh-CN")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={onEdit} disabled={!group}>
            打开编辑并导入
          </Button>
          <p className="text-xs text-muted-foreground">
            在“自定义网站配置”中使用「导入候选」按钮，可自动推断并添加选中的站点。
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

