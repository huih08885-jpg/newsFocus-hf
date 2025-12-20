import { z } from 'zod'

/**
 * API 输入验证工具
 */

// 日期范围验证
export const dateRangeSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
})

// 关键词组验证
export const keywordGroupSchema = z.object({
  name: z.string().optional().nullable(),
  words: z.array(z.string().min(1)).min(1, '至少需要一个普通词'),
  requiredWords: z.array(z.string()).default([]),
  excludedWords: z.array(z.string()).default([]),
  priority: z.number().int().default(0),
  enabled: z.boolean().default(true),
})

// 通知配置验证
export const notificationConfigSchema = z.object({
  enabled: z.boolean().optional(),
  push_window_enabled: z.boolean().optional(),
  push_window_start: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  push_window_end: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  once_per_day: z.boolean().optional(),
  feishu_webhook_url: z.string().url().optional().or(z.literal('')),
  dingtalk_webhook_url: z.string().url().optional().or(z.literal('')),
  wework_webhook_url: z.string().url().optional().or(z.literal('')),
  telegram_bot_token: z.string().optional().or(z.literal('')),
  telegram_chat_id: z.string().optional().or(z.literal('')),
  email_from: z.string().email().optional().or(z.literal('')),
  email_password: z.string().optional().or(z.literal('')),
  email_to: z.string().optional().or(z.literal('')),
  email_smtp_server: z.string().optional().or(z.literal('')),
  email_smtp_port: z.string().regex(/^\d+$/).optional().or(z.literal('')),
  ntfy_server_url: z.string().url().optional().or(z.literal('')),
  ntfy_topic: z.string().optional().or(z.literal('')),
  ntfy_token: z.string().optional().or(z.literal('')),
})

// 爬取请求验证
export const crawlRequestSchema = z.object({
  platforms: z.array(z.string()).optional(),
  force: z.boolean().optional(),
})

// 通知请求验证
export const notifyRequestSchema = z.object({
  reportType: z.enum(['daily', 'current', 'incremental', 'test']),
  reportDate: z.string().datetime(),
  channels: z.array(z.string()).optional(),
})

/**
 * 验证函数包装器
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      }
    }
    return { success: false, error: '验证失败' }
  }
}

