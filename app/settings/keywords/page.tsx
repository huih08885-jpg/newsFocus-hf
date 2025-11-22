"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, TestTube, RefreshCw } from "lucide-react"
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
    </div>
  )
}

