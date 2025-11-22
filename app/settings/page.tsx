"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { Save } from "lucide-react"

export default function SettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    requestInterval: 1000,
    rankThreshold: 5,
    reportMode: "daily",
    rankWeight: 0.6,
    frequencyWeight: 0.3,
    hotnessWeight: 0.1,
  })

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const res = await fetch("/api/config")
      const data = await res.json()
      if (data.success) {
        // 加载配置到表单
        if (data.data.crawler) {
          setFormData((prev) => ({
            ...prev,
            requestInterval: data.data.crawler.request_interval || 1000,
            rankThreshold: data.data.report?.rank_threshold || 5,
            reportMode: data.data.report?.mode || "daily",
          }))
        }
        if (data.data.weight) {
          setFormData((prev) => ({
            ...prev,
            rankWeight: data.data.weight.rank_weight || 0.6,
            frequencyWeight: data.data.weight.frequency_weight || 0.3,
            hotnessWeight: data.data.weight.hotness_weight || 0.1,
          }))
        }
      }
    } catch (error) {
      console.error("Error loading config:", error)
    }
  }

  const handleSave = async (section: string) => {
    setLoading(true)
    try {
      const config: any = {}
      
      if (section === "crawler") {
        config.crawler = {
          request_interval: formData.requestInterval,
        }
        config.report = {
          mode: formData.reportMode,
          rank_threshold: formData.rankThreshold,
        }
      } else if (section === "weight") {
        config.weight = {
          rank_weight: formData.rankWeight,
          frequency_weight: formData.frequencyWeight,
          hotness_weight: formData.hotnessWeight,
        }
      }

      const res = await fetch("/api/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      })

      const data = await res.json()

      if (data.success) {
        toast({
          title: "成功",
          description: "配置已保存",
          variant: "success",
        })
      } else {
        throw new Error(data.error?.message || "保存失败")
      }
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "保存失败",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">设置</h1>
        <p className="text-muted-foreground mt-1">
          管理系统配置和参数
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">基础设置</TabsTrigger>
          <TabsTrigger value="keywords">关键词</TabsTrigger>
          <TabsTrigger value="notifications">通知</TabsTrigger>
          <TabsTrigger value="platforms">平台</TabsTrigger>
          <TabsTrigger value="advanced">高级</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>爬取设置</CardTitle>
              <CardDescription>配置数据爬取相关参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="requestInterval">请求间隔（毫秒）</Label>
                <Input
                  id="requestInterval"
                  type="number"
                  value={formData.requestInterval}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      requestInterval: parseInt(e.target.value) || 1000,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rankThreshold">排名阈值</Label>
                <Input
                  id="rankThreshold"
                  type="number"
                  value={formData.rankThreshold}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      rankThreshold: parseInt(e.target.value) || 5,
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  排名小于等于此值的新闻被认为是高排名
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportMode">报告模式</Label>
                <select
                  id="reportMode"
                  value={formData.reportMode}
                  onChange={(e) =>
                    setFormData({ ...formData, reportMode: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="daily">当日汇总</option>
                  <option value="current">当前榜单</option>
                  <option value="incremental">增量监控</option>
                </select>
              </div>
              <Button onClick={() => handleSave("crawler")} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>权重配置</CardTitle>
              <CardDescription>调整权重计算参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rankWeight">排名权重</Label>
                <Input
                  id="rankWeight"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.rankWeight}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      rankWeight: parseFloat(e.target.value) || 0.6,
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  当前值: {formData.rankWeight} ({(formData.rankWeight * 100).toFixed(0)}%)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequencyWeight">频次权重</Label>
                <Input
                  id="frequencyWeight"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.frequencyWeight}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      frequencyWeight: parseFloat(e.target.value) || 0.3,
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  当前值: {formData.frequencyWeight} ({(formData.frequencyWeight * 100).toFixed(0)}%)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hotnessWeight">热度权重</Label>
                <Input
                  id="hotnessWeight"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.hotnessWeight}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hotnessWeight: parseFloat(e.target.value) || 0.1,
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  当前值: {formData.hotnessWeight} ({(formData.hotnessWeight * 100).toFixed(0)}%)
                </p>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm">
                  总和:{" "}
                  {(
                    formData.rankWeight +
                    formData.frequencyWeight +
                    formData.hotnessWeight
                  ).toFixed(2)}{" "}
                  (应为1.0)
                </p>
              </div>
              <Button onClick={() => handleSave("weight")} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keywords" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>关键词组管理</CardTitle>
              <CardDescription>配置关键词匹配规则</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings/keywords">
                <Button className="w-full">前往关键词配置页面</Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>通知配置</CardTitle>
              <CardDescription>配置各渠道推送设置</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings/notifications">
                <Button className="w-full">前往通知配置页面</Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platforms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>平台管理</CardTitle>
              <CardDescription>启用或禁用数据源平台</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings/platforms">
                <Button className="w-full">前往平台管理页面</Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>高级设置</CardTitle>
              <CardDescription>系统高级配置选项</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>数据库连接</Label>
                <Input
                  type="text"
                  value="已配置"
                  disabled
                  className="bg-muted"
                />
                <p className="text-sm text-muted-foreground">
                  数据库连接字符串在环境变量中配置
                </p>
              </div>
              <div className="space-y-2">
                <Label>缓存配置</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option>Vercel KV (如果配置)</option>
                  <option>内存缓存 (默认)</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
