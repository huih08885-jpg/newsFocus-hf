"use client"

import { DistributionAnalysis } from "@/components/lottery/analysis/distribution-analysis"

export default function DistributionAnalysisPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">分布分析</h1>
          <p className="text-muted-foreground">
            分析号码的分布特征（区间、奇偶、大小、和值、跨度），识别分布规律
          </p>
        </div>
        <DistributionAnalysis />
      </div>
    </div>
  )
}

