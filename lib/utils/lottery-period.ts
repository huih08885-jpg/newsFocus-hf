import { prisma } from '@/lib/db/prisma'

/**
 * 计算下一期期号
 * 双色球期号格式：YYYYNNN（年份+3位期号）
 * 例如：2025145 表示2025年第145期
 */
export async function calculateNextPeriod(): Promise<string> {
  // 获取最新一期开奖结果
  const latestResult = await prisma.lotteryResult.findFirst({
    orderBy: { date: 'desc' },
    select: { period: true, date: true }
  })

  if (!latestResult) {
    // 如果没有历史数据，返回当前年份的第一期
    const currentYear = new Date().getFullYear()
    return `${currentYear}001`
  }

  // 解析期号：YYYYNNN
  const periodStr = latestResult.period
  const year = parseInt(periodStr.substring(0, 4))
  const periodNum = parseInt(periodStr.substring(4))
  const currentYear = new Date().getFullYear()

  // 如果最新一期是去年的，返回今年第一期
  if (year < currentYear) {
    return `${currentYear}001`
  }

  // 计算下一期
  const nextPeriodNum = periodNum + 1
  const nextPeriod = `${year}${nextPeriodNum.toString().padStart(3, '0')}`

  return nextPeriod
}

/**
 * 计算中奖情况
 * 双色球中奖规则：
 * - 一等奖：6个红球+1个蓝球
 * - 二等奖：6个红球
 * - 三等奖：5个红球+1个蓝球
 * - 四等奖：5个红球 或 4个红球+1个蓝球
 * - 五等奖：4个红球 或 3个红球+1个蓝球
 * - 六等奖：1个蓝球 或 2个红球+1个蓝球 或 1个红球+1个蓝球 或 0个红球+1个蓝球
 */
export function calculatePrizeLevel(
  predictedRedBalls: string[],
  predictedBlueBall: string,
  actualRedBalls: string[],
  actualBlueBall: string
): {
  redMatches: string[]
  blueMatch: boolean
  redCount: number
  blueCount: number
  prizeLevel: string
  prizeName: string
} {
  // 计算红球匹配
  const redMatches = predictedRedBalls.filter(ball => 
    actualRedBalls.includes(ball)
  )
  const redCount: number = redMatches.length

  // 计算蓝球匹配
  const blueMatch = predictedBlueBall === actualBlueBall
  const blueCount: number = blueMatch ? 1 : 0

  // 判断中奖等级
  let prizeLevel = '0'
  let prizeName = '未中奖'

  if (redCount === 6 && blueCount === 1) {
    prizeLevel = '1'
    prizeName = '一等奖'
  } else if (redCount === 6 && blueCount === 0) {
    prizeLevel = '2'
    prizeName = '二等奖'
  } else if (redCount === 5 && blueCount === 1) {
    prizeLevel = '3'
    prizeName = '三等奖'
  } else if ((redCount === 5 && blueCount === 0) || (redCount === 4 && blueCount === 1)) {
    prizeLevel = '4'
    prizeName = '四等奖'
  } else if ((redCount === 4 && blueCount === 0) || (redCount === 3 && blueCount === 1)) {
    prizeLevel = '5'
    prizeName = '五等奖'
  } else if (blueCount === 1) {
    // 六等奖：蓝球匹配即可（红球匹配0-2个）
    prizeLevel = '6'
    prizeName = '六等奖'
  }

  return {
    redMatches,
    blueMatch,
    redCount,
    blueCount,
    prizeLevel,
    prizeName
  }
}

