"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import type { KeywordGroup } from "@/lib/types"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"

interface KeywordTestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  keywordGroup: KeywordGroup
}

export function KeywordTestDialog({
  open,
  onOpenChange,
  keywordGroup,
}: KeywordTestDialogProps) {
  const { toast } = useToast()
  const [testTitle, setTestTitle] = useState("")
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<{
    matched: boolean
    matchedWords: string[]
    testTitle: string
  } | null>(null)

  const handleTest = async () => {
    if (!testTitle.trim()) {
      toast({
        title: "错误",
        description: "请输入测试文本",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setTestResult(null)

    try {
      const res = await fetch("/api/config/keywords/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: testTitle.trim(),
          keywordGroupId: keywordGroup.id,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setTestResult({
          matched: data.data.matched,
          matchedWords: data.data.matchedWords || [],
          testTitle: data.data.testTitle,
        })
      } else {
        throw new Error(data.error?.message || "测试失败")
      }
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "测试失败",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setTestTitle("")
    setTestResult(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>测试关键词组匹配</DialogTitle>
          <DialogDescription>
            输入新闻标题，测试是否能匹配当前关键词组
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 关键词组信息 */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">关键词组: {keywordGroup.name || "未命名"}</h4>
              <Badge variant={keywordGroup.enabled ? "default" : "secondary"}>
                {keywordGroup.enabled ? "启用" : "禁用"}
              </Badge>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              {keywordGroup.words.length > 0 && (
                <p>
                  <span className="font-medium">普通词:</span>{" "}
                  {keywordGroup.words.join(", ")}
                </p>
              )}
              {keywordGroup.requiredWords.length > 0 && (
                <p>
                  <span className="font-medium">必须词:</span>{" "}
                  {keywordGroup.requiredWords
                    .map((w) => w.replace(/^\+/, ""))
                    .join(", ")}
                </p>
              )}
              {keywordGroup.excludedWords.length > 0 && (
                <p>
                  <span className="font-medium">过滤词:</span>{" "}
                  {keywordGroup.excludedWords
                    .map((w) => w.replace(/^!/, ""))
                    .join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* 测试输入 */}
          <div className="space-y-2">
            <Label htmlFor="test-title">测试文本（新闻标题）</Label>
            <Textarea
              id="test-title"
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
              placeholder="例如：华为发布新款AI手机，搭载自研芯片"
              rows={3}
              disabled={loading}
            />
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div
              className={`p-4 rounded-lg border-2 ${
                testResult.matched
                  ? "border-green-500 bg-green-50 dark:bg-green-950"
                  : "border-red-500 bg-red-50 dark:bg-red-950"
              }`}
            >
              <div className="flex items-start gap-3">
                {testResult.matched ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                )}
                <div className="flex-1 space-y-2">
                  <div>
                    <p
                      className={`font-medium ${
                        testResult.matched
                          ? "text-green-900 dark:text-green-100"
                          : "text-red-900 dark:text-red-100"
                      }`}
                    >
                      {testResult.matched ? "✓ 匹配成功" : "✗ 匹配失败"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      测试文本: "{testResult.testTitle}"
                    </p>
                  </div>
                  {testResult.matched && testResult.matchedWords.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-green-900 dark:text-green-100">
                        匹配到的词语:
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {testResult.matchedWords.map((word, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700"
                          >
                            {word}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {!testResult.matched && (
                    <div className="text-sm text-red-900 dark:text-red-100">
                      <p>可能的原因:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {keywordGroup.words.length > 0 && (
                          <li>测试文本中不包含任何普通词</li>
                        )}
                        {keywordGroup.requiredWords.length > 0 && (
                          <li>测试文本中缺少必须词</li>
                        )}
                        {keywordGroup.excludedWords.length > 0 && (
                          <li>测试文本中包含过滤词</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            关闭
          </Button>
          <Button onClick={handleTest} disabled={loading || !testTitle.trim()}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                测试中...
              </>
            ) : (
              "测试匹配"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

