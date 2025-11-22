interface NewsMatchData {
  ranks: number[]
  matchCount: number
  appearances: Array<{
    rank: number
    appearedAt: Date
  }>
}

interface WeightConfig {
  rankWeight: number
  frequencyWeight: number
  hotnessWeight: number
}

export class CalculatorService {
  private config: WeightConfig

  constructor(config?: Partial<WeightConfig>) {
    this.config = {
      rankWeight: config?.rankWeight ?? 0.6,
      frequencyWeight: config?.frequencyWeight ?? 0.3,
      hotnessWeight: config?.hotnessWeight ?? 0.1,
    }
  }

  /**
   * 计算新闻权重
   */
  calculateWeight(
    data: NewsMatchData,
    rankThreshold: number = 5
  ): number {
    const rankScore = this.calculateRankScore(data.ranks, rankThreshold)
    const frequencyScore = this.calculateFrequencyScore(data.matchCount)
    const hotnessScore = this.calculateHotnessScore(
      data.appearances,
      data.matchCount,
      rankThreshold
    )

    const totalWeight =
      rankScore * this.config.rankWeight +
      frequencyScore * this.config.frequencyWeight +
      hotnessScore * this.config.hotnessWeight

    return Math.round(totalWeight * 100) / 100 // 保留两位小数
  }

  /**
   * 计算排名权重分数
   * rank_score = Σ(11 - min(rank, 10)) / 出现次数
   */
  private calculateRankScore(
    ranks: number[],
    rankThreshold: number
  ): number {
    if (ranks.length === 0) return 0

    const sum = ranks.reduce((acc, rank) => {
      return acc + (11 - Math.min(rank, 10))
    }, 0)

    return sum / ranks.length
  }

  /**
   * 计算频次权重分数
   * frequency_score = min(出现次数, 10) × 10
   */
  private calculateFrequencyScore(matchCount: number): number {
    return Math.min(matchCount, 10) * 10
  }

  /**
   * 计算热度权重分数
   * hotness_score = (高排名次数 / 总出现次数) × 100
   */
  private calculateHotnessScore(
    appearances: Array<{ rank: number }>,
    totalCount: number,
    rankThreshold: number
  ): number {
    if (totalCount === 0) return 0

    const highRankCount = appearances.filter(
      a => a.rank <= rankThreshold
    ).length

    return (highRankCount / totalCount) * 100
  }
}

