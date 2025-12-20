/**
 * 从Excel文件导入福利彩票历史数据到数据库
 * 文件: ssq_asc1.xls
 * 页签: data
 * 格式:
 *   A列: 期号
 *   B列: 开奖日期
 *   C-H列: 红球（6个）
 *   I列: 蓝球
 */

import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db/prisma'
import { logger } from '@/lib/utils/logger'
import path from 'path'
import fs from 'fs'

interface ExcelRow {
  period: string // A列：期号
  date: string // B列：开奖日期
  redBall1: string // C列：红球1
  redBall2: string // D列：红球2
  redBall3: string // E列：红球3
  redBall4: string // F列：红球4
  redBall5: string // G列：红球5
  redBall6: string // H列：红球6
  blueBall: string // I列：蓝球
}

async function importFromExcel() {
  try {
    const filePath = path.join(process.cwd(), 'ssq_asc1.xls')
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      logger.error(`文件不存在: ${filePath}`, new Error('文件不存在'), 'ImportExcel')
      process.exit(1)
    }

    logger.info(`开始读取Excel文件: ${filePath}`, 'ImportExcel', { filePath })

    // 读取Excel文件
    const workbook = XLSX.readFile(filePath, { type: 'binary' })
    
    // 获取所有工作表名称
    const sheetNames = workbook.SheetNames
    logger.info(`Excel文件包含的工作表: ${sheetNames.join(', ')}`, 'ImportExcel', {
      sheetNames,
      sheetCount: sheetNames.length
    })

    // 查找data页签
    const dataSheetName = sheetNames.find(name => 
      name.toLowerCase() === 'data' || 
      name.toLowerCase().includes('data') ||
      name.toLowerCase() === '数据'
    ) || sheetNames[0] // 如果找不到，使用第一个工作表

    logger.info(`使用工作表: ${dataSheetName}`, 'ImportExcel', {
      dataSheetName,
      allSheets: sheetNames
    })

    // 读取data页签
    const worksheet = workbook.Sheets[dataSheetName]
    
    // 转换为JSON格式
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // 使用数组格式，第一行是数据
      defval: '', // 空单元格的默认值
      raw: false, // 不保留原始值，转换为字符串
    })

    logger.info(`读取到 ${jsonData.length} 行数据`, 'ImportExcel', {
      totalRows: jsonData.length,
      firstFewRows: jsonData.slice(0, 5)
    })

    // 解析数据
    const lotteryResults: Array<{
      period: string
      date: Date
      redBalls: string[]
      blueBall: string
    }> = []

    let skippedCount = 0
    let processedCount = 0

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i] as any[]
      
      // 跳过空行
      if (!row || row.length === 0 || !row[0]) {
        continue
      }

      processedCount++

      try {
        // A列：期号
        const period = String(row[0] || '').trim()
        
        // B列：开奖日期
        const dateStr = String(row[1] || '').trim()
        
        // C-H列：红球（6个）
        const redBalls = [
          String(row[2] || '').trim(), // C列
          String(row[3] || '').trim(), // D列
          String(row[4] || '').trim(), // E列
          String(row[5] || '').trim(), // F列
          String(row[6] || '').trim(), // G列
          String(row[7] || '').trim(), // H列
        ].filter(ball => ball !== '')

        // I列：蓝球
        const blueBall = String(row[8] || '').trim()

        // 验证数据
        if (!period || !dateStr || redBalls.length !== 6 || !blueBall) {
          logger.warn(`第 ${i + 1} 行数据不完整，跳过`, 'ImportExcel', {
            row: i + 1,
            period,
            dateStr,
            redBallsCount: redBalls.length,
            blueBall,
            rowData: row
          })
          skippedCount++
          continue
        }

        // 验证期号格式（应该是7位数字）
        if (!/^\d{7}$/.test(period)) {
          logger.warn(`第 ${i + 1} 行期号格式无效: ${period}`, 'ImportExcel', {
            row: i + 1,
            period
          })
          skippedCount++
          continue
        }

        // 解析日期
        let date: Date
        try {
          // Excel日期可能是数字（从1900-01-01开始的天数）或字符串
          if (typeof row[1] === 'number') {
            // Excel日期序列号（从1899-12-30开始，因为Excel认为1900是闰年）
            const excelEpoch = new Date(1899, 11, 30) // 1899-12-30
            const days = Math.floor(row[1])
            const milliseconds = (row[1] - days) * 24 * 60 * 60 * 1000
            date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000 + milliseconds)
          } else {
            // 字符串日期，尝试解析
            // 先尝试直接解析
            date = new Date(dateStr)
            
            if (isNaN(date.getTime())) {
              // 尝试匹配各种日期格式
              // 格式1: YYYY-MM-DD
              let dateMatch = dateStr.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/)
              if (dateMatch) {
                date = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]))
              } else {
                // 格式2: YYYYMMDD
                dateMatch = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/)
                if (dateMatch) {
                  date = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]))
                } else {
                  // 格式3: YYYY年MM月DD日
                  dateMatch = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
                  if (dateMatch) {
                    date = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]))
                  } else {
                    throw new Error('无法解析日期格式')
                  }
                }
              }
            }
          }
          
          if (isNaN(date.getTime())) {
            throw new Error('日期无效')
          }
        } catch (e) {
          logger.warn(`第 ${i + 1} 行日期解析失败: ${dateStr}`, 'ImportExcel', {
            row: i + 1,
            dateStr,
            originalValue: row[1],
            valueType: typeof row[1],
            error: e instanceof Error ? e.message : String(e)
          })
          skippedCount++
          continue
        }

        // 格式化红球和蓝球（确保是两位数）
        const formattedRedBalls = redBalls.map(ball => {
          const num = parseInt(ball)
          if (isNaN(num)) {
            throw new Error(`红球格式无效: ${ball}`)
          }
          return num.toString().padStart(2, '0')
        })

        const blueBallNum = parseInt(blueBall)
        if (isNaN(blueBallNum)) {
          throw new Error(`蓝球格式无效: ${blueBall}`)
        }
        const formattedBlueBall = blueBallNum.toString().padStart(2, '0')

        lotteryResults.push({
          period,
          date,
          redBalls: formattedRedBalls,
          blueBall: formattedBlueBall
        })

        // 每处理100条记录输出一次进度
        if (lotteryResults.length % 100 === 0) {
          logger.info(`已解析 ${lotteryResults.length} 条有效数据`, 'ImportExcel', {
            processed: lotteryResults.length,
            skipped: skippedCount,
            total: processedCount
          })
        }

      } catch (error) {
        logger.error(`解析第 ${i + 1} 行数据时出错`, 
          error instanceof Error ? error : new Error(String(error)), 
          'ImportExcel', 
          {
            row: i + 1,
            rowData: row
          }
        )
        skippedCount++
      }
    }

    logger.info(`数据解析完成`, 'ImportExcel', {
      totalRows: jsonData.length,
      validData: lotteryResults.length,
      skipped: skippedCount,
      processed: processedCount
    })

    if (lotteryResults.length === 0) {
      logger.error('未解析到任何有效数据', new Error('数据解析失败'), 'ImportExcel')
      process.exit(1)
    }

    // 保存到数据库
    logger.info(`开始保存 ${lotteryResults.length} 条数据到数据库`, 'ImportExcel', {
      total: lotteryResults.length
    })

    let savedCount = 0
    let existingCount = 0
    const errors: Array<{ period: string; error: string }> = []

    // 批量保存，每批100条
    const batchSize = 100
    for (let i = 0; i < lotteryResults.length; i += batchSize) {
      const batch = lotteryResults.slice(i, i + batchSize)
      
      logger.info(`处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(lotteryResults.length / batchSize)}`, 'ImportExcel', {
        batchIndex: Math.floor(i / batchSize) + 1,
        batchSize: batch.length,
        totalBatches: Math.ceil(lotteryResults.length / batchSize)
      })

      for (const result of batch) {
        try {
          // 检查是否已存在
          const existing = await prisma.lotteryResult.findUnique({
            where: { period: result.period }
          })

          if (existing) {
            existingCount++
            logger.debug(`期号 ${result.period} 已存在，跳过`, 'ImportExcel', {
              period: result.period
            })
            continue
          }

          // 创建新记录
          await prisma.lotteryResult.create({
            data: {
              period: result.period,
              date: result.date,
              redBalls: result.redBalls,
              blueBall: result.blueBall,
            }
          })

          savedCount++

          // 每保存50条记录输出一次进度
          if (savedCount % 50 === 0) {
            logger.info(`已保存 ${savedCount} 条数据 (已存在: ${existingCount}, 跳过: ${skippedCount})`, 'ImportExcel', {
              saved: savedCount,
              existing: existingCount,
              skipped: skippedCount,
              total: lotteryResults.length
            })
          }

        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error))
          logger.error(`保存期号 ${result.period} 失败`, errorObj, 'ImportExcel', {
            period: result.period,
            error: errorObj.message
          })
          errors.push({
            period: result.period,
            error: errorObj.message
          })
        }
      }
    }

    // 验证数据库中的实际记录数
    const actualCount = await prisma.lotteryResult.count()
    
    logger.info(`导入完成`, 'ImportExcel', {
      totalRows: jsonData.length,
      validData: lotteryResults.length,
      saved: savedCount,
      existing: existingCount,
      skipped: skippedCount,
      errors: errors.length,
      actualCount,
      expectedCount: savedCount + existingCount
    })

    if (errors.length > 0) {
      logger.warn(`有 ${errors.length} 条数据保存失败`, 'ImportExcel', {
        errors: errors.slice(0, 10) // 只显示前10个错误
      })
    }

    console.log('\n✅ 导入完成！')
    console.log(`📊 统计信息:`)
    console.log(`   - 总行数: ${jsonData.length}`)
    console.log(`   - 有效数据: ${lotteryResults.length}`)
    console.log(`   - 新保存: ${savedCount}`)
    console.log(`   - 已存在: ${existingCount}`)
    console.log(`   - 跳过: ${skippedCount}`)
    console.log(`   - 错误: ${errors.length}`)
    console.log(`   - 数据库实际记录数: ${actualCount}`)

  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    logger.error('导入Excel文件失败', errorObj, 'ImportExcel', {
      error: errorObj.message,
      stack: errorObj.stack
    })
    console.error('❌ 导入失败:', errorObj.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行导入
importFromExcel()
  .then(() => {
    console.log('✅ 脚本执行完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error)
    process.exit(1)
  })

