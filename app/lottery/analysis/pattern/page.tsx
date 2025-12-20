"use client"

import { PatternAnalysis } from "@/components/lottery/analysis/pattern-analysis"

export default function PatternAnalysisPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">模式识别</h1>
          <p className="text-muted-foreground">
            识别历史数据中的连号、周期性、组合等模式，发现号码出现的规律
          </p>
        </div>
        <PatternAnalysis />
      </div>
    </div>
  )
}

