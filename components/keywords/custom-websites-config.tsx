"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Trash2, ChevronDown, ChevronUp, Settings, Sparkles, Globe, Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ConfigurableHtmlCrawlerConfig } from "@/lib/services/crawlers/configurable-html"
import { useToast } from "@/hooks/use-toast"

export interface CustomWebsite {
  id?: string
  name: string
  enabled: boolean
  config: ConfigurableHtmlCrawlerConfig
}

interface CustomWebsitesConfigProps {
  websites: CustomWebsite[]
  onChange: (websites: CustomWebsite[] | ((prev: CustomWebsite[]) => CustomWebsite[])) => void
  discoveredWebsites?: DiscoveredCandidate[] | null
}

interface DiscoveredCandidate {
  candidateId?: string
  domain?: string
  title?: string
  url?: string
  snippet?: string
  createdAt?: string
}

const getSafeListConfig = (
  list?: ConfigurableHtmlCrawlerConfig["list"]
) => {
  const fields = (list?.fields ?? {}) as ConfigurableHtmlCrawlerConfig["list"]["fields"]
  return {
    url: list?.url || "",
    itemSelector: list?.itemSelector || "",
    fields: {
      title: {
        selector: fields.title?.selector || "",
        attribute: fields.title?.attribute,
        regex: fields.title?.regex,
      },
      url: fields.url,
      publishedAt: fields.publishedAt,
      summary: fields.summary,
    },
  }
}

export function CustomWebsitesConfig({
  websites,
  onChange,
  discoveredWebsites,
}: CustomWebsitesConfigProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [tabValues, setTabValues] = useState<Record<string, string>>({})
  const { toast } = useToast()
  const candidateList = normalizeCandidates(discoveredWebsites)
  const [importingId, setImportingId] = useState<string | null>(null)

  const getTabValue = (websiteId: string) => {
    return tabValues[websiteId] || "ultra-simple"
  }

  const setTabValue = (websiteId: string, value: string) => {
    setTabValues((prev) => ({
      ...prev,
      [websiteId]: value,
    }))
  }

  const addWebsite = () => {
    const newWebsite: CustomWebsite = {
      name: "",
      enabled: true,
      config: {
        type: "html",
        baseUrl: "",
        list: {
          url: "",
          itemSelector: "",
          fields: {
            title: { selector: "" },
          },
        },
      },
    }
    onChange([...websites, newWebsite])
  }

  const appendWebsite = (website: CustomWebsite) => {
    onChange((prev) => [...prev, website])
  }

  const handleImportCandidate = async (candidate: DiscoveredCandidate) => {
    if (!candidate.url) {
      toast({
        title: "无法导入",
        description: "候选站点缺少 URL，无法推断配置。",
        variant: "destructive",
      })
      return false
    }
    try {
      setImportingId(candidate.candidateId || candidate.url)
      const res = await fetch("/api/search/site/infer-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: candidate.url }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "推断失败")
      }
      const safeName = candidate.domain || candidate.title || candidate.url
      const newWebsite: CustomWebsite = {
        id: candidate.candidateId || `candidate-${Date.now()}`,
        name: safeName || "候选站点",
        enabled: true,
        config: data.data.config,
      }
      appendWebsite(newWebsite)
      toast({
        title: "已导入候选站点",
        description: `${safeName} 已添加到自定义站点列表。`,
      })
      return true
    } catch (error) {
      console.error(error)
      toast({
        title: "导入失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
      return false
    } finally {
      setImportingId(null)
    }
  }

  const removeWebsite = (index: number) => {
    const newWebsites = websites.filter((_, i) => i !== index)
    onChange(newWebsites)
  }

  const updateWebsite = (index: number, updates: Partial<CustomWebsite>) => {
    const newWebsites = [...websites]
    newWebsites[index] = { ...newWebsites[index], ...updates }
    onChange(newWebsites)
  }

  const updateConfig = (
    index: number,
    configUpdates: Partial<ConfigurableHtmlCrawlerConfig>
  ) => {
    // 使用函数式更新确保基于最新状态
    const updater = (prevWebsites: CustomWebsite[]) => {
      const newWebsites = [...prevWebsites]
      const website = newWebsites[index]
      if (!website) return prevWebsites
      
      newWebsites[index] = {
        ...website,
        config: {
          ...website.config,
          ...configUpdates,
        },
      }
      return newWebsites
    }
    onChange(updater)
  }

  const updateListConfig = (
    index: number,
    listUpdates: Partial<ConfigurableHtmlCrawlerConfig["list"]>
  ) => {
    // 使用函数式更新确保基于最新状态
    const updater = (prevWebsites: CustomWebsite[]) => {
      const newWebsites = [...prevWebsites]
      const website = newWebsites[index]
      if (!website) return prevWebsites
      
      newWebsites[index] = {
        ...website,
        config: {
          ...website.config,
          list: {
            ...website.config.list,
            ...listUpdates,
          },
        },
      }
      return newWebsites
    }
    onChange(updater)
  }

  const updateFieldConfig = (
    index: number,
    fieldName: "title" | "url" | "publishedAt",
    fieldUpdates: Partial<ConfigurableHtmlCrawlerConfig["list"]["fields"]["title"]>
  ) => {
    const website = websites[index]
    updateListConfig(index, {
      fields: {
        ...website.config.list.fields,
        [fieldName]: {
          ...(website.config.list.fields[fieldName] || {}),
          ...fieldUpdates,
        },
      },
    })
  }

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedIds(newExpanded)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">自定义网站配置</Label>
          <p className="text-sm text-muted-foreground mt-1">
            配置需要从哪些网站爬取数据，系统会使用HTML解析方式爬取这些网站
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addWebsite}>
            <Plus className="h-4 w-4 mr-2" />
            添加网站
          </Button>
          <ImportCandidateButton
            candidates={candidateList}
            onImport={handleImportCandidate}
            importingId={importingId}
          />
        </div>
      </div>

      {websites.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
          <p>暂无自定义网站</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={addWebsite}
          >
            <Plus className="h-4 w-4 mr-2" />
            添加第一个网站
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {websites.map((website, index) => {
            const websiteId = website.id || `website-${index}`
            const isExpanded = expandedIds.has(websiteId)
            const listConfig = getSafeListConfig(website.config.list)
            const fieldsConfig = listConfig.fields

            return (
              <Card key={websiteId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="p-0 h-auto"
                        onClick={() => toggleExpanded(websiteId)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronUp className="h-4 w-4" />
                        )}
                      </Button>
                      <Input
                        placeholder="网站名称"
                        value={website.name}
                        onChange={(e) =>
                          updateWebsite(index, { name: e.target.value })
                        }
                        className="flex-1 max-w-xs"
                      />
                      <Switch
                        checked={website.enabled}
                        onCheckedChange={(checked) =>
                          updateWebsite(index, { enabled: checked })
                        }
                      />
                      <span className="text-sm text-muted-foreground">
                        {website.enabled ? "启用" : "禁用"}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeWebsite(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <div>
                    <CardContent className="space-y-4 pt-0">
                      <Tabs
                        value={getTabValue(websiteId)}
                        onValueChange={(value) => setTabValue(websiteId, value)}
                        className="w-full"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <TabsList>
                            <TabsTrigger value="ultra-simple">超简单模式</TabsTrigger>
                            <TabsTrigger value="simple">简单模式</TabsTrigger>
                            <TabsTrigger value="advanced">高级模式</TabsTrigger>
                          </TabsList>
                        </div>

                        {/* 超简单模式 - 只需要输入URL */}
                        <TabsContent value="ultra-simple" className="space-y-4">
                          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                            <p className="text-sm text-green-800 dark:text-green-200">
                              ✨ <strong>超简单模式：</strong>只需输入网站URL，系统会自动尝试识别页面结构并提取数据
                            </p>
                          </div>

                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label htmlFor={`ultra-url-${index}`}>
                                网站URL <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id={`ultra-url-${index}`}
                                type="text"
                                placeholder="请输入网站URL，例如：https://forum.eepw.com.cn/"
                                value={listConfig.url || ""}
                                onChange={(e) => {
                                  const rawValue = e.target.value
                                  
                                  // 立即更新URL，使用函数式更新确保基于最新状态
                                  const updater = (prevWebsites: CustomWebsite[]) => {
                                    const newWebsites = [...prevWebsites]
                                    const currentWebsite = newWebsites[index]
                                    if (!currentWebsite) return prevWebsites

                                    const trimmedValue = rawValue.trim()
                                    const currentList = currentWebsite.config.list || {}
                                    const currentFields = currentList.fields || {}

                                    // 准备更新列表配置
                                    const listUpdates: Partial<ConfigurableHtmlCrawlerConfig["list"]> = {
                                      url: rawValue, // 保持原始值，不trim
                                    }

                                    // 自动设置默认选择器（仅在字段为空时）
                                    if (
                                      trimmedValue &&
                                      (!currentList.itemSelector || currentList.itemSelector.trim().length === 0)
                                    ) {
                                      listUpdates.itemSelector = "article, .item, li, .news-item, .post-item"

                                      const updatedFields: ConfigurableHtmlCrawlerConfig["list"]["fields"] = {
                                        ...currentFields,
                                      }

                                      if (
                                        !currentFields.title?.selector ||
                                        currentFields.title.selector.trim().length === 0
                                      ) {
                                        updatedFields.title = {
                                          selector: "h1, h2, h3, .title, a",
                                        }
                                      }

                                      if (
                                        !currentFields.url?.selector ||
                                        currentFields.url.selector.trim().length === 0
                                      ) {
                                        updatedFields.url = {
                                          selector: "a@href",
                                        }
                                      }

                                      listUpdates.fields = updatedFields
                                    }

                                    // 更新网站配置
                                    newWebsites[index] = {
                                      ...currentWebsite,
                                      config: {
                                        ...currentWebsite.config,
                                        list: {
                                          ...currentList,
                                          ...listUpdates,
                                        },
                                      },
                                    }

                                    return newWebsites
                                  }
                                  onChange(updater)

                                  // 异步处理基础URL提取，避免阻塞输入
                                  const trimmedValue = rawValue.trim()
                                  if (
                                    trimmedValue &&
                                    (trimmedValue.startsWith("http://") || trimmedValue.startsWith("https://"))
                                  ) {
                                    setTimeout(() => {
                                      try {
                                        const urlObj = new URL(trimmedValue)
                                        const baseUrlUpdater = (prevWebsites: CustomWebsite[]) => {
                                          const newWebsites = [...prevWebsites]
                                          const currentWebsite = newWebsites[index]
                                          if (!currentWebsite) return prevWebsites
                                          
                                          newWebsites[index] = {
                                            ...currentWebsite,
                                            config: {
                                              ...currentWebsite.config,
                                              baseUrl: `${urlObj.protocol}//${urlObj.host}`,
                                            },
                                          }
                                          return newWebsites
                                        }
                                        onChange(baseUrlUpdater)
                                      } catch {}
                                    }, 100) // 稍微延迟，确保URL更新已完成
                                  }
                                }}
                                onBlur={(e) => {
                                  const trimmedUrl = e.target.value.trim()
                                  if (trimmedUrl !== e.target.value) {
                                    const blurUpdater = (prevWebsites: CustomWebsite[]) => {
                                      const newWebsites = [...prevWebsites]
                                      const currentWebsite = newWebsites[index]
                                      if (!currentWebsite) return prevWebsites
                                      
                                      newWebsites[index] = {
                                        ...currentWebsite,
                                        config: {
                                          ...currentWebsite.config,
                                          list: {
                                            ...currentWebsite.config.list,
                                            url: trimmedUrl,
                                          },
                                        },
                                      }
                                      return newWebsites
                                    }
                                    onChange(blurUpdater)
                                  }
                                }}
                                className="w-full"
                                autoComplete="off"
                                spellCheck={false}
                              />
                              <p className="text-xs text-muted-foreground">
                                <strong>请在此输入框中输入要爬取的网站URL</strong>，例如：https://forum.eepw.com.cn/ 或 https://example.com/news
                                <br />
                                系统会自动尝试识别页面结构并提取数据
                              </p>
                            </div>

                            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                                💡 <strong>提示：</strong>系统会尝试使用常见的HTML结构（如 article、.item、h2、a 等）来提取数据。
                                <br />
                                如果自动识别失败，可以切换到"简单模式"手动指定选择器。
                              </p>
                            </div>
                          </div>
                        </TabsContent>

                        {/* 简单模式 */}
                        <TabsContent value="simple" className="space-y-4">
                          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              💡 <strong>简单模式：</strong>只需填写最核心的信息，系统会自动尝试提取数据
                            </p>
                          </div>

                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label htmlFor={`list-url-${index}`}>
                                新闻列表页URL <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id={`list-url-${index}`}
                                placeholder="https://example.com/news 或 https://example.com"
                                value={listConfig.url}
                                onChange={(e) =>
                                  updateListConfig(index, { url: e.target.value })
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                输入要爬取的新闻列表页面地址
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`item-selector-${index}`}>
                                新闻项选择器 <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id={`item-selector-${index}`}
                                placeholder="例如：article, .news-item, li.item"
                                value={listConfig.itemSelector}
                                onChange={(e) =>
                                  updateListConfig(index, { itemSelector: e.target.value })
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                在浏览器中按F12打开开发者工具，找到每个新闻项的HTML标签，输入它的类名或标签名
                                <br />
                                例如：如果每个新闻是 <code className="bg-muted px-1 rounded">&lt;article class="news"&gt;</code>，就输入 <code className="bg-muted px-1 rounded">article</code> 或 <code className="bg-muted px-1 rounded">.news</code>
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`title-selector-${index}`}>
                                标题选择器 <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id={`title-selector-${index}`}
                                placeholder="例如：h2, .title, a"
                                value={fieldsConfig.title?.selector || ""}
                                onChange={(e) =>
                                  updateFieldConfig(index, "title", {
                                    selector: e.target.value,
                                  })
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                在新闻项内部，标题所在的HTML标签选择器
                                <br />
                                例如：如果标题是 <code className="bg-muted px-1 rounded">&lt;h2&gt;</code>，就输入 <code className="bg-muted px-1 rounded">h2</code>
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`link-selector-${index}`}>
                                链接选择器（可选）
                              </Label>
                              <Input
                                id={`link-selector-${index}`}
                                placeholder="例如：a, a@href（如果链接在a标签的href属性中）"
                                value={fieldsConfig.url?.selector || ""}
                                onChange={(e) =>
                                  updateFieldConfig(index, "url", {
                                    selector: e.target.value || undefined,
                                  })
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                如果标题本身就是链接，可以不填。如果需要单独指定链接，输入 <code className="bg-muted px-1 rounded">a</code> 或 <code className="bg-muted px-1 rounded">a@href</code>
                              </p>
                            </div>
                          </div>
                        </TabsContent>

                        {/* 高级模式 */}
                        <TabsContent value="advanced" className="space-y-4">
                          <div className="space-y-2">
                            <Label>基础URL（可选）</Label>
                            <Input
                              placeholder="https://example.com"
                              value={website.config.baseUrl || ""}
                              onChange={(e) =>
                                updateConfig(index, { baseUrl: e.target.value || undefined })
                              }
                            />
                            <p className="text-xs text-muted-foreground">
                              用于将相对URL转换为绝对URL
                            </p>
                          </div>

                          <div className="space-y-3 border-t pt-4">
                            <Label className="text-base">列表页配置</Label>
                            
                            <div className="space-y-2">
                              <Label>列表页URL</Label>
                              <Input
                                placeholder="https://example.com/news"
                                value={listConfig.url}
                                onChange={(e) =>
                                  updateListConfig(index, { url: e.target.value })
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>列表项选择器（CSS选择器）</Label>
                              <Input
                                placeholder="article.item, .news-item"
                                value={listConfig.itemSelector}
                                onChange={(e) =>
                                  updateListConfig(index, { itemSelector: e.target.value })
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                用于选择每个新闻项的CSS选择器
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label>标题选择器</Label>
                              <Input
                                placeholder="h2.title, .title"
                                value={fieldsConfig.title?.selector || ""}
                                onChange={(e) =>
                                  updateFieldConfig(index, "title", {
                                    selector: e.target.value,
                                  })
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>链接选择器（可选）</Label>
                              <Input
                                placeholder="a.link"
                                value={fieldsConfig.url?.selector || ""}
                                onChange={(e) =>
                                  updateFieldConfig(index, "url", {
                                    selector: e.target.value || undefined,
                                  })
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                如果链接在属性中，使用"选择器@属性名"格式，如"a@href"
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label>发布时间选择器（可选）</Label>
                              <Input
                                placeholder=".date, time"
                                value={fieldsConfig.publishedAt?.selector || ""}
                                onChange={(e) =>
                                  updateFieldConfig(index, "publishedAt", {
                                    selector: e.target.value || undefined,
                                  })
                                }
                              />
                            </div>
                          </div>

                          {/* 搜索页配置（可选） */}
                          <div className="space-y-3 border-t pt-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-base">搜索页配置（可选）</Label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (website.config.search) {
                                    updateConfig(index, { search: undefined })
                                  } else {
                                    updateConfig(index, {
                                      search: {
                                        url: "",
                                        itemSelector: "",
                                        keywordParam: "q",
                                        fields: {
                                          title: { selector: "" },
                                        },
                                      },
                                    })
                                  }
                                }}
                              >
                                {website.config.search ? "移除搜索配置" : "添加搜索配置"}
                              </Button>
                            </div>

                            {website.config.search && (
                              <div className="space-y-3 pl-4 border-l-2">
                                <div className="space-y-2">
                                  <Label>搜索页URL</Label>
                                  <Input
                                    placeholder="https://example.com/search"
                                    value={website.config.search.url}
                                    onChange={(e) =>
                                      updateConfig(index, {
                                        search: {
                                          ...website.config.search!,
                                          url: e.target.value,
                                        },
                                      })
                                    }
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>关键词参数名</Label>
                                  <Input
                                    placeholder="q, keyword, search"
                                    value={website.config.search.keywordParam || "q"}
                                    onChange={(e) =>
                                      updateConfig(index, {
                                        search: {
                                          ...website.config.search!,
                                          keywordParam: e.target.value || "q",
                                        },
                                      })
                                    }
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    搜索URL中的关键词参数名，如 ?q=关键词
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <Label>列表项选择器</Label>
                                  <Input
                                    placeholder="article.item, .result-item"
                                    value={website.config.search.itemSelector}
                                    onChange={(e) =>
                                      updateConfig(index, {
                                        search: {
                                          ...website.config.search!,
                                          itemSelector: e.target.value,
                                        },
                                      })
                                    }
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>标题选择器</Label>
                                  <Input
                                    placeholder="h2.title, .title"
                                    value={website.config.search.fields.title.selector || ""}
                                    onChange={(e) =>
                                      updateConfig(index, {
                                        search: {
                                          ...website.config.search!,
                                          fields: {
                                            ...website.config.search!.fields,
                                            title: {
                                              selector: e.target.value,
                                            },
                                          },
                                        },
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface ImportCandidateButtonProps {
  candidates: DiscoveredCandidate[]
  onImport: (candidate: DiscoveredCandidate) => Promise<boolean>
  importingId: string | null
}

function ImportCandidateButton({ candidates, onImport, importingId }: ImportCandidateButtonProps) {
  const [open, setOpen] = useState(false)

  const handleImport = async (candidate: DiscoveredCandidate) => {
    const ok = await onImport(candidate)
    if (ok) {
      setOpen(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={candidates.length === 0}
      >
        <Sparkles className="h-4 w-4 mr-2" />
        导入候选
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>候选站点</DialogTitle>
            <DialogDescription>
              以下站点来自统一搜索或订阅候选，可一键生成配置并加入自定义列表。
            </DialogDescription>
          </DialogHeader>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无候选站点。</p>
          ) : (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {candidates.map((candidate) => {
                const key = candidate.candidateId || candidate.url || `${candidate.domain}-${candidate.createdAt}`
                const isLoading = importingId === (candidate.candidateId || candidate.url)
                return (
                  <Card key={key}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {candidate.title || candidate.domain || candidate.url}
                            </span>
                            {candidate.domain && (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {candidate.domain}
                              </Badge>
                            )}
                          </div>
                          {candidate.url && (
                            <p className="text-xs text-muted-foreground break-all">{candidate.url}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleImport(candidate)}
                          disabled={isLoading || !candidate.url}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              导入中...
                            </>
                          ) : (
                            <>
                              <Sparkles className="mr-2 h-4 w-4" />
                              预填配置
                            </>
                          )}
                        </Button>
                      </div>
                      {candidate.snippet && (
                        <p className="text-sm text-muted-foreground">{candidate.snippet}</p>
                      )}
                      {candidate.createdAt && (
                        <p className="text-xs text-muted-foreground">
                          发现时间：{new Date(candidate.createdAt).toLocaleString("zh-CN")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function normalizeCandidates(input?: DiscoveredCandidate[] | null): DiscoveredCandidate[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const result: DiscoveredCandidate[] = []
  for (const item of input) {
    if (!item || typeof item !== "object") continue
    const key = item.candidateId || item.url || item.domain || Math.random().toString(36)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return timeB - timeA
  })
}

