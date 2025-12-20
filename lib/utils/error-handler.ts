/**
 * 全局错误处理工具
 * 统一处理错误并记录日志
 */

import { logger } from './logger'
import { NextResponse } from 'next/server'

export interface AppError extends Error {
  code?: string
  statusCode?: number
  details?: any
}

/**
 * 创建应用错误
 */
export function createError(
  message: string,
  code: string = 'INTERNAL_ERROR',
  statusCode: number = 500,
  details?: any
): AppError {
  const error = new Error(message) as AppError
  error.code = code
  error.statusCode = statusCode
  error.details = details
  return error
}

/**
 * 处理错误并返回响应
 */
export function handleError(
  error: unknown,
  context?: string,
  defaultMessage: string = '内部服务器错误'
): NextResponse {
  const errorObj = error instanceof Error ? error : new Error(String(error))
  const appError = errorObj as AppError

  // 记录错误日志
  logger.error(
    appError.message || defaultMessage,
    errorObj,
    context || 'API',
    {
      code: appError.code,
      statusCode: appError.statusCode,
      details: appError.details,
    }
  )

  // 返回错误响应
  const statusCode = appError.statusCode || 500
  const message = process.env.NODE_ENV === 'production'
    ? (appError.code === 'INTERNAL_ERROR' ? defaultMessage : appError.message)
    : appError.message

  return NextResponse.json(
    {
      success: false,
      error: {
        code: appError.code || 'INTERNAL_ERROR',
        message,
        ...(process.env.NODE_ENV === 'development' && {
          details: appError.details,
          stack: errorObj.stack,
        }),
      },
    },
    { status: statusCode }
  )
}

/**
 * 包装异步函数，自动捕获错误
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      logger.error(
        `执行失败: ${fn.name}`,
        error instanceof Error ? error : new Error(String(error)),
        context || 'Function',
        { args: args.length }
      )
      throw error
    }
  }) as T
}

