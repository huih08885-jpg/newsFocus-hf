"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Save, Send } from "lucide-react"

export default function NotificationsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    enableNotification: true,
    pushWindowEnabled: false,
    pushWindowStart: "20:00",
    pushWindowEnd: "22:00",
    oncePerDay: true,
    feishuWebhookUrl: "",
    dingtalkWebhookUrl: "",
    weworkWebhookUrl: "",
    telegramBotToken: "",
    telegramChatId: "",
    emailFrom: "",
    emailPassword: "",
    emailTo: "",
    emailSmtpServer: "",
    emailSmtpPort: "",
    ntfyServerUrl: "https://ntfy.sh",
    ntfyTopic: "",
    ntfyToken: "",
  })

  useEffect(() => {
    // 从API加载配置
    const loadConfig = async () => {
      try {
        const res = await fetch("/api/config")
        const data = await res.json()
        
        if (data.success && data.data) {
          const configs = data.data
          setFormData({
            enableNotification: configs['notification.enabled'] ?? true,
            pushWindowEnabled: configs['notification.push_window_enabled'] ?? false,
            pushWindowStart: configs['notification.push_window_start'] || "20:00",
            pushWindowEnd: configs['notification.push_window_end'] || "22:00",
            oncePerDay: configs['notification.once_per_day'] ?? true,
            feishuWebhookUrl: configs['notification.feishu_webhook_url'] || "",
            dingtalkWebhookUrl: configs['notification.dingtalk_webhook_url'] || "",
            weworkWebhookUrl: configs['notification.wework_webhook_url'] || "",
            telegramBotToken: configs['notification.telegram_bot_token'] || "",
            telegramChatId: configs['notification.telegram_chat_id'] || "",
            emailFrom: configs['notification.email_from'] || "",
            emailPassword: configs['notification.email_password'] || "",
            emailTo: configs['notification.email_to'] || "",
            emailSmtpServer: configs['notification.email_smtp_server'] || "",
            emailSmtpPort: configs['notification.email_smtp_port'] || "",
            ntfyServerUrl: configs['notification.ntfy_server_url'] || "https://ntfy.sh",
            ntfyTopic: configs['notification.ntfy_topic'] || "",
            ntfyToken: configs['notification.ntfy_token'] || "",
          })
        }
      } catch (error) {
        console.error("加载配置失败:", error)
      }
    }
    
    loadConfig()
  }, [])

  const handleSave = async () => {
    setLoading(true)
    try {
      const configs = {
        'notification.enabled': formData.enableNotification,
        'notification.push_window_enabled': formData.pushWindowEnabled,
        'notification.push_window_start': formData.pushWindowStart,
        'notification.push_window_end': formData.pushWindowEnd,
        'notification.once_per_day': formData.oncePerDay,
        'notification.feishu_webhook_url': formData.feishuWebhookUrl,
        'notification.dingtalk_webhook_url': formData.dingtalkWebhookUrl,
        'notification.wework_webhook_url': formData.weworkWebhookUrl,
        'notification.telegram_bot_token': formData.telegramBotToken,
        'notification.telegram_chat_id': formData.telegramChatId,
        'notification.email_from': formData.emailFrom,
        'notification.email_password': formData.emailPassword,
        'notification.email_to': formData.emailTo,
        'notification.email_smtp_server': formData.emailSmtpServer,
        'notification.email_smtp_port': formData.emailSmtpPort,
        'notification.ntfy_server_url': formData.ntfyServerUrl,
        'notification.ntfy_topic': formData.ntfyTopic,
        'notification.ntfy_token': formData.ntfyToken,
      }

      const res = await fetch("/api/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(configs),
      })

      const data = await res.json()

      if (data.success) {
        toast({
          title: "成功",
          description: "通知配置已保存",
          variant: "success",
        })
      } else {
        throw new Error(data.error?.message || "保存失败")
      }
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "保存配置失败",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async (channel: string) => {
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportType: "test",
          reportDate: new Date().toISOString(),
          channels: [channel],
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast({
          title: "成功",
          description: `${channel} 测试消息已发送`,
          variant: "success",
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
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">通知配置</h1>
          <p className="text-muted-foreground mt-1">
            配置各渠道推送设置
          </p>
        </div>
        <Button onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? "保存中..." : "保存所有配置"}
        </Button>
      </div>

      {/* 全局设置 */}
      <Card>
        <CardHeader>
          <CardTitle>全局设置</CardTitle>
          <CardDescription>通知推送的全局配置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>启用通知推送</Label>
              <p className="text-sm text-muted-foreground">
                开启后系统将根据配置发送通知
              </p>
            </div>
            <Switch
              checked={formData.enableNotification}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, enableNotification: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>启用推送时间窗口</Label>
              <p className="text-sm text-muted-foreground">
                限制推送时间范围
              </p>
            </div>
            <Switch
              checked={formData.pushWindowEnabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, pushWindowEnabled: checked })
              }
            />
          </div>

          {formData.pushWindowEnabled && (
            <div className="grid grid-cols-2 gap-4 pl-6">
              <div className="space-y-2">
                <Label>开始时间</Label>
                <Input
                  type="time"
                  value={formData.pushWindowStart}
                  onChange={(e) =>
                    setFormData({ ...formData, pushWindowStart: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>结束时间</Label>
                <Input
                  type="time"
                  value={formData.pushWindowEnd}
                  onChange={(e) =>
                    setFormData({ ...formData, pushWindowEnd: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>每天仅推送一次</Label>
              <p className="text-sm text-muted-foreground">
                开启后每天每个渠道只推送一次
              </p>
            </div>
            <Switch
              checked={formData.oncePerDay}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, oncePerDay: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 飞书配置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>飞书</CardTitle>
              <CardDescription>配置飞书Webhook推送</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTest("feishu")}
            >
              <Send className="h-4 w-4 mr-2" />
              测试
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              type="url"
              placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
              value={formData.feishuWebhookUrl}
              onChange={(e) =>
                setFormData({ ...formData, feishuWebhookUrl: e.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 钉钉配置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>钉钉</CardTitle>
              <CardDescription>配置钉钉Webhook推送</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTest("dingtalk")}
            >
              <Send className="h-4 w-4 mr-2" />
              测试
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              type="url"
              placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
              value={formData.dingtalkWebhookUrl}
              onChange={(e) =>
                setFormData({ ...formData, dingtalkWebhookUrl: e.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 企业微信配置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>企业微信</CardTitle>
              <CardDescription>配置企业微信Webhook推送</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTest("wework")}
            >
              <Send className="h-4 w-4 mr-2" />
              测试
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              type="url"
              placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
              value={formData.weworkWebhookUrl}
              onChange={(e) =>
                setFormData({ ...formData, weworkWebhookUrl: e.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Telegram配置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Telegram</CardTitle>
              <CardDescription>配置Telegram Bot推送</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTest("telegram")}
            >
              <Send className="h-4 w-4 mr-2" />
              测试
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Bot Token</Label>
            <Input
              type="text"
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              value={formData.telegramBotToken}
              onChange={(e) =>
                setFormData({ ...formData, telegramBotToken: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Chat ID</Label>
            <Input
              type="text"
              placeholder="123456789"
              value={formData.telegramChatId}
              onChange={(e) =>
                setFormData({ ...formData, telegramChatId: e.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 邮件配置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>邮件</CardTitle>
              <CardDescription>配置SMTP邮件推送</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTest("email")}
            >
              <Send className="h-4 w-4 mr-2" />
              测试
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>发件人邮箱</Label>
              <Input
                type="email"
                placeholder="sender@example.com"
                value={formData.emailFrom}
                onChange={(e) =>
                  setFormData({ ...formData, emailFrom: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>密码/授权码</Label>
              <Input
                type="password"
                placeholder="邮箱密码或授权码"
                value={formData.emailPassword}
                onChange={(e) =>
                  setFormData({ ...formData, emailPassword: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>收件人邮箱（多个用逗号分隔）</Label>
            <Input
              type="text"
              placeholder="recipient1@example.com, recipient2@example.com"
              value={formData.emailTo}
              onChange={(e) =>
                setFormData({ ...formData, emailTo: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SMTP服务器</Label>
              <Input
                type="text"
                placeholder="smtp.example.com"
                value={formData.emailSmtpServer}
                onChange={(e) =>
                  setFormData({ ...formData, emailSmtpServer: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>SMTP端口</Label>
              <Input
                type="number"
                placeholder="587"
                value={formData.emailSmtpPort}
                onChange={(e) =>
                  setFormData({ ...formData, emailSmtpPort: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ntfy配置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>ntfy</CardTitle>
              <CardDescription>配置ntfy推送</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTest("ntfy")}
            >
              <Send className="h-4 w-4 mr-2" />
              测试
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>服务器URL</Label>
            <Input
              type="url"
              placeholder="https://ntfy.sh"
              value={formData.ntfyServerUrl}
              onChange={(e) =>
                setFormData({ ...formData, ntfyServerUrl: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Topic</Label>
            <Input
              type="text"
              placeholder="your-topic"
              value={formData.ntfyTopic}
              onChange={(e) =>
                setFormData({ ...formData, ntfyTopic: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Token（可选）</Label>
            <Input
              type="password"
              placeholder="可选的身份验证Token"
              value={formData.ntfyToken}
              onChange={(e) =>
                setFormData({ ...formData, ntfyToken: e.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

