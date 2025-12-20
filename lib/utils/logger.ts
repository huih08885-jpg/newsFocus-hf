/**
 * 统一日志系统
 * 支持控制台输出和文件记录
 */

import fs from 'fs'
import path from 'path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: string
  metadata?: any
  error?: {
    message: string
    stack?: string
  }
}

class Logger {
  private logDir: string
  private logFile: string
  private errorLogFile: string
  private maxFileSize: number = 10 * 1024 * 1024 // 10MB
  private maxFiles: number = 5 // 保留5个历史文件

  constructor() {
    // 日志目录：项目根目录下的 logs 文件夹
    this.logDir = path.join(process.cwd(), 'logs')
    this.logFile = path.join(this.logDir, 'app.log')
    this.errorLogFile = path.join(this.logDir, 'error.log')

    // 确保日志目录存在
    this.ensureLogDir()
  }

  private ensureLogDir(): void {
    // 在 Serverless 环境（如 Vercel）中，可能没有文件系统写入权限
    // 这种情况下只输出到控制台
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true })
      }
    } catch (error) {
      // 文件系统不可用，只使用控制台输出
      console.warn('[Logger] 无法创建日志目录，将只输出到控制台:', error)
    }
  }

  /**
   * 轮转日志文件
   */
  private rotateLogFile(filePath: string): void {
    if (!fs.existsSync(filePath)) return

    const stats = fs.statSync(filePath)
    if (stats.size < this.maxFileSize) return

    // 重命名现有文件
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const oldFile = `${filePath}.${i}`
      const newFile = `${filePath}.${i + 1}`
      if (fs.existsSync(oldFile)) {
        fs.renameSync(oldFile, newFile)
      }
    }

    // 将当前文件重命名为 .1
    fs.renameSync(filePath, `${filePath}.1`)
  }

  /**
   * 写入日志到文件
   */
  private writeToFile(entry: LogEntry, isError: boolean = false): void {
    // 在 Serverless 环境中，可能没有文件系统写入权限
    // 这种情况下只输出到控制台（已在 outputToConsole 中处理）
    if (process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL) {
      return // Vercel 环境只使用控制台输出
    }

    try {
      const filePath = isError ? this.errorLogFile : this.logFile
      
      // 检查文件大小，必要时轮转
      this.rotateLogFile(filePath)

      // 格式化日志条目
      const logLine = this.formatLogEntry(entry)
      
      // 追加到文件
      fs.appendFileSync(filePath, logLine + '\n', 'utf8')
    } catch (error) {
      // 如果文件写入失败，只输出到控制台（已在 outputToConsole 中处理）
      // 不重复输出错误，避免日志循环
    }
  }

  /**
   * 格式化日志条目
   */
  private formatLogEntry(entry: LogEntry): string {
    const parts: string[] = [
      entry.timestamp,
      `[${entry.level.toUpperCase()}]`,
    ]

    if (entry.context) {
      parts.push(`[${entry.context}]`)
    }

    parts.push(entry.message)

    if (entry.metadata) {
      try {
        parts.push(JSON.stringify(entry.metadata))
      } catch {
        parts.push('[无法序列化元数据]')
      }
    }

    if (entry.error) {
      parts.push(`\n错误: ${entry.error.message}`)
      if (entry.error.stack) {
        parts.push(`\n堆栈:\n${entry.error.stack}`)
      }
    }

    return parts.join(' ')
  }

  /**
   * 输出到控制台
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp
    const level = entry.level.toUpperCase().padEnd(5)
    const context = entry.context ? `[${entry.context}]` : ''
    const message = entry.message

    const consoleMessage = `${timestamp} ${level} ${context} ${message}`

    switch (entry.level) {
      case 'error':
        console.error(consoleMessage, entry.metadata || '', entry.error || '')
        break
      case 'warn':
        console.warn(consoleMessage, entry.metadata || '')
        break
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(consoleMessage, entry.metadata || '')
        }
        break
      default:
        console.log(consoleMessage, entry.metadata || '')
    }
  }

  /**
   * 记录日志
   */
  private log(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: any,
    error?: Error
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      metadata,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    }

    // 输出到控制台
    this.outputToConsole(entry)

    // 写入文件
    this.writeToFile(entry, level === 'error')

    // 错误级别也写入错误日志文件
    if (level === 'error') {
      this.writeToFile(entry, true)
    }
  }

  /**
   * Debug 日志
   */
  debug(message: string, context?: string, metadata?: any): void {
    this.log('debug', message, context, metadata)
  }

  /**
   * Info 日志
   */
  info(message: string, context?: string, metadata?: any): void {
    this.log('info', message, context, metadata)
  }

  /**
   * Warning 日志
   */
  warn(message: string, context?: string, metadata?: any): void {
    this.log('warn', message, context, metadata)
  }

  /**
   * Error 日志
   */
  error(message: string, error?: Error, context?: string, metadata?: any): void {
    this.log('error', message, context, metadata, error)
  }

  /**
   * 清理旧日志文件
   */
  cleanup(maxAge: number = 30 * 24 * 60 * 60 * 1000): void {
    // 在 Serverless 环境中，可能没有文件系统访问权限
    if (process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL) {
      return
    }

    try {
      // 默认保留30天的日志
      const cutoffTime = Date.now() - maxAge

      const files = [
        this.logFile,
        this.errorLogFile,
      ]

      // 检查主日志文件及其轮转文件
      for (const filePath of files) {
        for (let i = 1; i <= this.maxFiles; i++) {
          const rotatedFile = i === 1 ? filePath : `${filePath}.${i}`
          if (fs.existsSync(rotatedFile)) {
            const stats = fs.statSync(rotatedFile)
            if (stats.mtime.getTime() < cutoffTime) {
              try {
                fs.unlinkSync(rotatedFile)
                this.info(`已删除旧日志文件: ${rotatedFile}`, 'Logger')
              } catch (error) {
                this.warn(`删除旧日志文件失败: ${rotatedFile}`, 'Logger', { error })
              }
            }
          }
        }
      }
    } catch (error) {
      // 清理失败不影响主流程
      console.warn('[Logger] 清理日志文件失败:', error)
    }
  }
}

// 创建单例实例
export const logger = new Logger()

// 导出便捷方法
export const log = {
  debug: (message: string, context?: string, metadata?: any) => logger.debug(message, context, metadata),
  info: (message: string, context?: string, metadata?: any) => logger.info(message, context, metadata),
  warn: (message: string, context?: string, metadata?: any) => logger.warn(message, context, metadata),
  error: (message: string, error?: Error, context?: string, metadata?: any) => logger.error(message, error, context, metadata),
}

