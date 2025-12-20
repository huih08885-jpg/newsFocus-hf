"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Search, Sparkles, Calendar, Filter } from "lucide-react"
import { Label } from "@/components/ui/label"

interface AISearchResult {
  items: Array<{
    url: string
    snippet?: string | null
    publishedAt?: string | null
  }>
  totalFound: number
  totalFiltered: number
  timeRange?: {
    start: string
    end: string
  }
  tokenUsage?: {
    total: number
    prompt: number
    completion: number
  }
}

export default function AISearchPage() {
  const [keywordsInput, setKeywordsInput] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AISearchResult | null>(null)
  const { toast } = useToast()

  const parsedKeywords = () =>
    keywordsInput
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean)

  const handleSearch = async () => {
    const keywords = parsedKeywords()
    if (keywords.length === 0) {
      toast({
        title: "请输入关键词",
        description: "支持换行或逗号分隔多个词。",
        variant: "destructive",
      })
      return
    }

    // 验证日期范围
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast({
        title: "日期范围错误",
        description: "开始日期不能晚于结束日期。",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      
      const payload = {
        keywords,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        maxResults: 20,
        includeAnalysis: true,
      }
      
      const res = await fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "AI 搜索失败")
      }
      
      setResult(data.data)
      
      toast({
        title: "搜索完成",
        description: `找到 ${data.data.totalFound} 条结果，AI 筛选出 ${data.data.totalFiltered} 条最相关的新闻`,
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          AI 智能搜索
        </h1>
        <p className="text-muted-foreground mt-2">
          利用 DeepSeek AI 的能力，智能筛选和分析搜索结果，找到最相关、最有价值的新闻
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            搜索配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>关键词</Label>
            <Textarea
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
              placeholder="例如：跨境电商, 锂电池, 台湾 数据要素（支持换行或逗号分隔）"
              className="min-h-[100px]"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                开始日期（可选）
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="选择开始日期"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                结束日期（可选）
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="选择结束日期"
              />
            </div>
          </div>

          <Button onClick={handleSearch} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                AI 搜索中...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                开始 AI 搜索
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          {/* 统计信息 */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{result.totalFound}</div>
                  <div className="text-sm text-muted-foreground">搜索引擎找到</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{result.totalFiltered}</div>
                  <div className="text-sm text-muted-foreground">AI 筛选后</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.totalFound > 0
                      ? Math.round((result.totalFiltered / result.totalFound) * 100)
                      : 0}
                    %
                  </div>
                  <div className="text-sm text-muted-foreground">筛选率</div>
                </div>
                {result.tokenUsage && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {result.tokenUsage.total.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Token 消耗
                      {result.tokenUsage.prompt > 0 && result.tokenUsage.completion > 0 && (
                        <div className="text-xs mt-1">
                          (输入: {result.tokenUsage.prompt.toLocaleString()}, 
                          输出: {result.tokenUsage.completion.toLocaleString()})
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {result.timeRange && (
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  <Filter className="h-4 w-4 inline mr-1" />
                  时间范围：{result.timeRange.start} 至 {result.timeRange.end}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 搜索结果列表 */}
          <Card>
            <CardHeader>
              <CardTitle>筛选后的新闻（{result.items.length} 条）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.items.map((item, index) => (
                <Card key={`${item.url}-${index}`} className="border-muted">
                  <CardContent className="p-4 space-y-2">
                    {item.snippet && (
                      <p className="text-sm text-muted-foreground">{item.snippet}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all flex-1"
                      >
                        {item.url}
                      </a>
                      {item.publishedAt && (
                        <span className="whitespace-nowrap flex-shrink-0 text-muted-foreground">
                          {item.publishedAt}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {!result && !loading && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>输入关键词和时间范围，点击"开始 AI 搜索"即可获取智能筛选的新闻</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

