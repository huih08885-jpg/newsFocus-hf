/**
 * 统一错误响应格式
 */

export interface ApiError {
  code: string
  message: string
  details?: any
}

export class ApiErrorResponse extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiErrorResponse'
  }

  toJSON(): { success: false; error: ApiError } {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    }
  }
}

// 常用错误
export const Errors = {
  UNAUTHORIZED: new ApiErrorResponse('UNAUTHORIZED', '需要登录', 401),
  FORBIDDEN: new ApiErrorResponse('FORBIDDEN', '权限不足', 403),
  NOT_FOUND: new ApiErrorResponse('NOT_FOUND', '资源不存在', 404),
  VALIDATION_ERROR: new ApiErrorResponse('VALIDATION_ERROR', '参数验证失败', 400),
  SERVER_ERROR: new ApiErrorResponse('SERVER_ERROR', '服务器错误', 500),
  DATABASE_ERROR: new ApiErrorResponse('DATABASE_ERROR', '数据库操作失败', 500),
  CRAWL_ERROR: new ApiErrorResponse('CRAWL_ERROR', '爬取失败', 500),
  MATCH_ERROR: new ApiErrorResponse('MATCH_ERROR', '关键词匹配失败', 500),
  NOTIFY_ERROR: new ApiErrorResponse('NOTIFY_ERROR', '通知发送失败', 500),
}

/**
 * 错误处理中间件
 */
export function handleApiError(error: unknown): {
  success: false
  error: ApiError
  statusCode: number
} {
  if (error instanceof ApiErrorResponse) {
    return {
      ...error.toJSON(),
      statusCode: error.statusCode,
    }
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error.message,
      },
      statusCode: 500,
    }
  }

  return {
    success: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message: '未知错误',
    },
    statusCode: 500,
  }
}

