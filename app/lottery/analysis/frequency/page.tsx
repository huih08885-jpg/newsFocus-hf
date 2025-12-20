"use client"

import { FrequencyAnalysis } from "@/components/lottery/analysis/frequency-analysis"

export default function FrequencyAnalysisPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">频率分析</h1>
          <p className="text-muted-foreground">
            统计每个号码在历史数据中的出现频率，识别热号、冷号、温号
          </p>
        </div>
        <FrequencyAnalysis />
      </div>
    </div>
  )
}
