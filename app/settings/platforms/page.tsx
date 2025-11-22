"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Save, RefreshCw } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface Platform {
  id: string
  platformId: string
  name: string
  enabled: boolean
}

export default function PlatformsPage() {
  const { toast } = useToast()
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadPlatforms = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/config/platforms")
      const data = await res.json()
      if (data.success) {
        setPlatforms(data.data.items || [])
      }
    } catch (error) {
      toast({
        title: "错误",
        description: "加载平台列表失败",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlatforms()
  }, [])

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/config/platforms`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, enabled }),
      })

      const data = await res.json()

      if (data.success) {
        setPlatforms((prev) =>
          prev.map((p) => (p.id === id ? { ...p, enabled } : p))
        )
        toast({
          title: "成功",
          description: `平台已${enabled ? "启用" : "禁用"}`,
          variant: "success",
        })
      } else {
        throw new Error(data.error?.message || "操作失败")
      }
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "操作失败",
        variant: "destructive",
      })
    }
  }

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      // 这里可以批量保存，目前逐个更新
      await Promise.all(
        platforms.map((platform) =>
          fetch(`/api/config/platforms`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: platform.id,
              enabled: platform.enabled,
            }),
          })
        )
      )

      toast({
        title: "成功",
        description: "所有平台配置已保存",
        variant: "success",
      })
    } catch (error) {
      toast({
        title: "错误",
        description: "保存配置失败",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">平台管理</h1>
          <p className="text-muted-foreground mt-1">
            启用或禁用数据源平台
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadPlatforms}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button onClick={handleSaveAll} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>平台列表</CardTitle>
          <CardDescription>
            共 {platforms.length} 个平台，{platforms.filter((p) => p.enabled).length} 个已启用
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : platforms.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>暂无平台数据</p>
            </div>
          ) : (
            <div className="space-y-4">
              {platforms.map((platform) => (
                <div
                  key={platform.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium text-lg">{platform.name}</div>
                      <div className="text-sm text-muted-foreground">
                        ID: {platform.platformId}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={platform.enabled}
                        onCheckedChange={(checked) =>
                          handleToggle(platform.id, checked)
                        }
                      />
                      <Label className="text-sm">
                        {platform.enabled ? "启用" : "禁用"}
                      </Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

