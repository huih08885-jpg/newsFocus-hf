import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { logger } from '@/lib/utils/logger'
import { handleError } from '@/lib/utils/error-handler'
import * as XLSX from 'xlsx'

/**
 * 导入历史开奖结果
 * POST /api/lottery/import
 * 
 * 业务逻辑：从上传的Excel文件导入历史开奖结果
 * 技术实现：使用xlsx库解析Excel文件，支持xls和xlsx格式
 * 
 * Excel格式：
 * - period: 期号
 * - date: 日期
 * - red_balls: 红球数组，格式为 {01, 02, 03, 17, 25, 31}
 * - blue_ball: 蓝球
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: '请选择要上传的文件' },
        { status: 400 }
      )
    }

    // 检查文件类型
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
      return NextResponse.json(
        { success: false, error: '只支持 .xls 和 .xlsx 格式的文件' },
        { status: 400 }
      )
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // 解析Excel文件
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    
    // 获取第一个工作表
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    
    // 转换为JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
    
    if (data.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Excel文件至少需要包含表头和数据行' },
        { status: 400 }
      )
    }

    // 获取表头
    const headers = data[0].map((h: any) => String(h).toLowerCase().trim())
    
    // 查找列索引
    const periodIndex = headers.findIndex(h => h === 'period' || h === '期号')
    const dateIndex = headers.findIndex(h => h === 'date' || h === '日期')
    const redBallsIndex = headers.findIndex(h => h === 'red_balls' || h === 'redballs' || h === '红球')
    const blueBallIndex = headers.findIndex(h => h === 'blue_ball' || h === 'blueball' || h === '蓝球')

    if (periodIndex === -1 || dateIndex === -1 || redBallsIndex === -1 || blueBallIndex === -1) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Excel文件必须包含以下列：period（期号）、date（日期）、red_balls（红球）、blue_ball（蓝球）' 
        },
        { status: 400 }
      )
    }

    // 解析数据行
    const results: Array<{
      period: string
      date: Date
      redBalls: string[]
      blueBall: string
    }> = []

    let savedCount = 0
    let existingCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      
      if (!row || row.length === 0) continue

      try {
        // 获取期号
        const period = String(row[periodIndex] || '').trim()
        if (!period) {
          errorCount++
          errors.push(`第 ${i + 1} 行：期号为空`)
          continue
        }

        // 获取日期
        let date: Date
        const dateValue = row[dateIndex]
        if (dateValue instanceof Date) {
          date = dateValue
        } else if (typeof dateValue === 'string') {
          // 处理日期字符串，支持多种格式
          const dateStr = dateValue.trim()
          // 尝试解析日期，支持 "2017-2-16 0:00" 格式
          const dateMatch = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
          if (dateMatch) {
            const [, year, month, day] = dateMatch
            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
          } else {
            date = new Date(dateStr)
          }
        } else if (typeof dateValue === 'number') {
          // Excel日期序列号（从1900-01-01开始的天数）
          // Excel认为1900是闰年，所以需要从1899-12-30开始计算
          const excelEpoch = new Date(1899, 11, 30) // 1899-12-30
          date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000)
        } else {
          errorCount++
          errors.push(`第 ${i + 1} 行：日期格式错误`)
          continue
        }

        if (isNaN(date.getTime())) {
          errorCount++
          errors.push(`第 ${i + 1} 行：日期无效`)
          continue
        }

        // 获取红球
        let redBalls: string[] = []
        const redBallsValue = row[redBallsIndex]
        
        if (typeof redBallsValue === 'string') {
          // 处理 {01, 02, 03, 17, 25, 31} 格式
          const redBallsStr = redBallsValue.trim()
          if (redBallsStr.startsWith('{') && redBallsStr.endsWith('}')) {
            // 移除大括号并分割
            const numbers = redBallsStr.slice(1, -1).split(',').map(n => n.trim())
            redBalls = numbers.filter(n => n).map(n => {
              // 移除前导零，但保留两位数格式
              const num = parseInt(n)
              return num.toString().padStart(2, '0')
            })
          } else {
            // 尝试按逗号分割
            redBalls = redBallsValue.split(',').map(n => {
              const num = parseInt(n.trim())
              return num.toString().padStart(2, '0')
            }).filter(n => !isNaN(parseInt(n)))
          }
        } else if (Array.isArray(redBallsValue)) {
          redBalls = redBallsValue.map(n => {
            const num = parseInt(String(n))
            return num.toString().padStart(2, '0')
          }).filter(n => !isNaN(parseInt(n)))
        } else {
          // 尝试从多个列读取红球（C-H列）
          redBalls = []
          for (let j = 2; j < 8; j++) {
            if (row[j] !== undefined && row[j] !== null && row[j] !== '') {
              const num = parseInt(String(row[j]))
              if (!isNaN(num) && num >= 1 && num <= 33) {
                redBalls.push(num.toString().padStart(2, '0'))
              }
            }
          }
        }

        if (redBalls.length !== 6) {
          errorCount++
          errors.push(`第 ${i + 1} 行：红球数量不正确（应为6个，实际${redBalls.length}个）`)
          continue
        }

        // 获取蓝球
        let blueBall = String(row[blueBallIndex] || '').trim()
        if (!blueBall) {
          // 尝试从I列读取
          if (row[8] !== undefined && row[8] !== null && row[8] !== '') {
            blueBall = String(row[8]).trim()
          }
        }
        
        const blueBallNum = parseInt(blueBall)
        if (isNaN(blueBallNum) || blueBallNum < 1 || blueBallNum > 16) {
          errorCount++
          errors.push(`第 ${i + 1} 行：蓝球无效`)
          continue
        }
        blueBall = blueBallNum.toString().padStart(2, '0')

        // 检查是否已存在
        const existing = await prisma.lotteryResult.findUnique({
          where: { period }
        })

        if (existing) {
          existingCount++
          continue
        }

        // 保存到数据库
        await prisma.lotteryResult.create({
          data: {
            period,
            date,
            redBalls,
            blueBall
          }
        })

        savedCount++

      } catch (error) {
        errorCount++
        const errorObj = error instanceof Error ? error : new Error(String(error))
        const errorMsg = errorObj.message || '未知错误'
        errors.push(`第 ${i + 1} 行：${errorMsg}`)
        logger.error(`导入第 ${i + 1} 行数据失败`, errorObj, 'ImportLottery', {
          row: i + 1,
          data: row
        })
      }
    }

    logger.info('导入历史开奖结果完成', 'ImportLottery', {
      total: data.length - 1,
      saved: savedCount,
      existing: existingCount,
      errors: errorCount
    })

    return NextResponse.json({
      success: true,
      data: {
        total: data.length - 1,
        saved: savedCount,
        existing: existingCount,
        errors: errorCount,
        errorMessages: errors.slice(0, 10) // 只返回前10个错误
      }
    })

  } catch (error) {
    return handleError(error, 'ImportLottery', '导入历史开奖结果失败')
  }
}

