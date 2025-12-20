/**
 * 生成分析建议的工具函数
 * 业务逻辑：基于分析结果生成可读的建议文本，帮助用户理解分析结果并做出决策
 * 技术实现：分析各项指标，生成结构化的建议文本
 */

import { ComprehensiveAnalysis } from '@/lib/services/lottery-analysis'

/**
 * 生成统计分析建议
 */
export function generateStatisticalRecommendations(analysis: ComprehensiveAnalysis): string {
  const recommendations: string[] = []

  // 频率分析建议
  if (analysis.frequency.hotNumbers.length > 0) {
    recommendations.push(
      `📊 频率分析：热号（${analysis.frequency.hotNumbers.slice(0, 5).join('、')}等）出现频率较高，建议适当关注。`
    )
  }
  if (analysis.frequency.coldNumbers.length > 0) {
    recommendations.push(
      `❄️ 冷号（${analysis.frequency.coldNumbers.slice(0, 5).join('、')}等）长期未出现，可能迎来反弹机会。`
    )
  }

  // 遗漏分析建议
  if (analysis.omission.highOmission.length > 0) {
    recommendations.push(
      `⏰ 遗漏分析：高遗漏号码（${analysis.omission.highOmission.slice(0, 5).join('、')}等）值得关注，历史数据显示高遗漏号码有回归趋势。`
    )
  }

  // 分布分析建议
  const zoneDist = analysis.distribution.zoneDistribution
  const maxZone = Math.max(zoneDist.zone1, zoneDist.zone2, zoneDist.zone3)
  if (maxZone === zoneDist.zone1) {
    recommendations.push(`📍 分布分析：一区（01-11）号码出现频率较高，建议适当配置。`)
  } else if (maxZone === zoneDist.zone2) {
    recommendations.push(`📍 分布分析：二区（12-22）号码出现频率较高，建议适当配置。`)
  } else {
    recommendations.push(`📍 分布分析：三区（23-33）号码出现频率较高，建议适当配置。`)
  }

  const oddEven = analysis.distribution.oddEvenRatio
  if (oddEven.odd > 0.6) {
    recommendations.push(`🔢 奇偶分析：奇数号码占比较高，建议保持奇数优势。`)
  } else if (oddEven.even > 0.6) {
    recommendations.push(`🔢 奇偶分析：偶数号码占比较高，建议保持偶数优势。`)
  } else {
    recommendations.push(`🔢 奇偶分析：奇偶比例相对均衡，建议保持3:3或4:2的比例。`)
  }

  const sizeRatio = analysis.distribution.sizeRatio
  if (sizeRatio.small > 0.6) {
    recommendations.push(`📏 大小分析：小号（01-16）出现频率较高，建议适当配置。`)
  } else if (sizeRatio.large > 0.6) {
    recommendations.push(`📏 大小分析：大号（17-33）出现频率较高，建议适当配置。`)
  }

  // 和值建议
  const sumRange = analysis.distribution.sumRange
  recommendations.push(
    `🎯 和值分析：历史平均和值约${sumRange.average.toFixed(0)}，建议选择和值在${Math.max(60, sumRange.min - 20)}-${Math.min(180, sumRange.max + 20)}范围内的号码组合。`
  )

  // 模式分析建议
  if (analysis.patterns.consecutiveNumbers.frequency > 0.3) {
    recommendations.push(`🔗 连号分析：连号出现频率较高，建议考虑包含连号的组合。`)
  }

  return recommendations.join('\n\n')
}

/**
 * 生成机器学习分析建议
 */
export function generateMLRecommendations(
  analysis: ComprehensiveAnalysis,
  featureImportance: Record<string, number>
): string {
  const recommendations: string[] = []

  // 特征重要性分析
  const sortedFeatures = Object.entries(featureImportance)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)

  recommendations.push(
    `🎯 特征重要性：${sortedFeatures.map(([key, value]) => `${key}(${(value * 100).toFixed(1)}%)`).join('、')}是最重要的预测特征。`
  )

  // 基于特征权重的建议
  if (featureImportance.frequency > 0.3) {
    recommendations.push(
      `📊 频率特征权重较高，建议重点关注热号和温号，这些号码出现概率相对较大。`
    )
  }

  if (featureImportance.omission > 0.25) {
    recommendations.push(
      `⏰ 遗漏特征权重较高，建议适当关注高遗漏号码，它们可能迎来回归。`
    )
  }

  if (featureImportance.hot > 0.2) {
    recommendations.push(
      `🔥 热号特征权重较高，建议在组合中配置2-3个热号，提高中奖概率。`
    )
  }

  if (featureImportance.highOmission > 0.15) {
    recommendations.push(
      `💎 高遗漏特征权重较高，建议配置1-2个高遗漏号码，追求高回报。`
    )
  }

  // 综合建议
  recommendations.push(
    `💡 综合建议：建议采用平衡策略，结合热号、温号和高遗漏号码，形成合理的号码组合。`
  )

  return recommendations.join('\n\n')
}

