"use client"

import { OmissionAnalysis } from "@/components/lottery/analysis/omission-analysis"

export default function OmissionAnalysisPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">遗漏值分析</h1>
          <p className="text-muted-foreground">
            计算每个号码距离上次出现的期数，识别长期未出现的号码（可能回补）
          </p>
        </div>
        <OmissionAnalysis />
      </div>
    </div>
  )
}
