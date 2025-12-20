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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import type { KeywordGroup } from "@/lib/types"
import { CustomWebsitesConfig, type CustomWebsite } from "./custom-websites-config"

// 表单用的 KeywordGroup（id 可选，name 转换为 string）
interface KeywordGroupForm extends Omit<KeywordGroup, 'id' | 'name' | 'customWebsites'> {
  id?: string
  name?: string
  customWebsites?: CustomWebsite[]
}

interface KeywordFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  keywordGroup?: KeywordGroup
  onSuccess?: () => void
}

export function KeywordFormDialog({
  open,
  onOpenChange,
  keywordGroup,
  onSuccess,
}: KeywordFormDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<KeywordGroupForm>({
    name: "",
    words: [],
    requiredWords: [],
    excludedWords: [],
    priority: 0,
    enabled: true,
    customWebsites: [],
  })

  useEffect(() => {
    if (keywordGroup) {
      // 解析 customWebsites
      let customWebsites: CustomWebsite[] = []
      if (keywordGroup.customWebsites) {
        if (Array.isArray(keywordGroup.customWebsites)) {
          customWebsites = keywordGroup.customWebsites as CustomWebsite[]
        } else if (typeof keywordGroup.customWebsites === 'object') {
          customWebsites = [keywordGroup.customWebsites as CustomWebsite]
        }
      }

      setFormData({
        id: keywordGroup.id,
        name: keywordGroup.name ?? "",
        words: keywordGroup.words,
        requiredWords: keywordGroup.requiredWords,
        excludedWords: keywordGroup.excludedWords,
        priority: keywordGroup.priority,
        enabled: keywordGroup.enabled,
        customWebsites,
      })
    } else {
      setFormData({
        name: "",
        words: [],
        requiredWords: [],
        excludedWords: [],
        priority: 0,
        enabled: true,
        customWebsites: [],
      })
    }
  }, [keywordGroup, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 验证自定义网站配置
      if (formData.customWebsites && formData.customWebsites.length > 0) {
        for (const website of formData.customWebsites) {
          if (!website.name || website.name.trim().length === 0) {
            throw new Error("自定义网站名称不能为空")
          }
          if (!website.config.list.url || website.config.list.url.trim().length === 0) {
            throw new Error(`网站 "${website.name}" 的列表页URL不能为空`)
          }
          if (!website.config.list.itemSelector || website.config.list.itemSelector.trim().length === 0) {
            throw new Error(`网站 "${website.name}" 的列表项选择器不能为空`)
          }
          if (!website.config.list.fields.title.selector || website.config.list.fields.title.selector.trim().length === 0) {
            throw new Error(`网站 "${website.name}" 的标题选择器不能为空`)
          }
          if (website.config.search) {
            if (!website.config.search.url || website.config.search.url.trim().length === 0) {
              throw new Error(`网站 "${website.name}" 的搜索页URL不能为空`)
            }
            if (!website.config.search.itemSelector || website.config.search.itemSelector.trim().length === 0) {
              throw new Error(`网站 "${website.name}" 的搜索页列表项选择器不能为空`)
            }
            if (!website.config.search.fields.title.selector || website.config.search.fields.title.selector.trim().length === 0) {
              throw new Error(`网站 "${website.name}" 的搜索页标题选择器不能为空`)
            }
          }
        }
      }

      const url = keywordGroup?.id
        ? `/api/config/keywords/${keywordGroup.id}`
        : "/api/config/keywords"
      const method = keywordGroup?.id ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          words: formData.words.filter(Boolean),
          requiredWords: formData.requiredWords.filter(Boolean),
          excludedWords: formData.excludedWords.filter(Boolean),
          priority: formData.priority,
          enabled: formData.enabled,
          customWebsites: formData.customWebsites && formData.customWebsites.length > 0
            ? formData.customWebsites
            : null,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast({
          title: "成功",
          description: keywordGroup?.id ? "关键词组已更新" : "关键词组已创建",
          variant: "success",
        })
        onOpenChange(false)
        onSuccess?.()
      } else {
        throw new Error(data.error?.message || "操作失败")
      }
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "操作失败",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {keywordGroup?.id ? "编辑关键词组" : "添加关键词组"}
          </DialogTitle>
          <DialogDescription>
            配置关键词匹配规则。普通词用换行分隔，必须词以+开头，过滤词以!开头。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">词组名称（可选）</Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="例如：AI 人工智能"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="words">普通词（每行一个）</Label>
            <Textarea
              id="words"
              value={formData.words.join("\n")}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  words: e.target.value.split("\n").map((w) => w.trim()),
                })
              }
              placeholder="AI&#10;人工智能&#10;机器学习"
              rows={5}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requiredWords">必须词（每行一个，以+开头）</Label>
            <Textarea
              id="requiredWords"
              value={formData.requiredWords.join("\n")}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  requiredWords: e.target.value.split("\n").map((w) => w.trim()),
                })
              }
              placeholder="+手机&#10;+芯片"
              rows={3}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="excludedWords">过滤词（每行一个，以!开头）</Label>
            <Textarea
              id="excludedWords"
              value={formData.excludedWords.join("\n")}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  excludedWords: e.target.value.split("\n").map((w) => w.trim()),
                })
              }
              placeholder="!水果&#10;!价格"
              rows={3}
              className="font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">优先级</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: parseInt(e.target.value) || 0,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                数字越小优先级越高
              </p>
            </div>

            <div className="space-y-2">
              <Label>状态</Label>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  checked={formData.enabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, enabled: checked })
                  }
                />
                <span className="text-sm">
                  {formData.enabled ? "启用" : "禁用"}
                </span>
              </div>
            </div>
          </div>

          {/* 自定义网站配置 */}
          <div className="border-t pt-4">
            <CustomWebsitesConfig
              websites={formData.customWebsites || []}
              discoveredWebsites={keywordGroup?.discoveredWebsites as any}
              onChange={(websitesOrUpdater) => {
                if (typeof websitesOrUpdater === 'function') {
                  setFormData((prev) => ({
                    ...prev,
                    customWebsites: websitesOrUpdater(prev.customWebsites || []),
                  }))
                } else {
                  setFormData({ ...formData, customWebsites: websitesOrUpdater })
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

