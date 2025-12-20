"use client"

import { ComparisonView } from "@/components/lottery/comparison-view"

export default function ComparisonPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">预测对比</h1>
          <p className="text-muted-foreground">
            对比预测结果与实际开奖结果，分析预测准确度和中奖情况
          </p>
        </div>
        <ComparisonView />
      </div>
    </div>
  )
}

