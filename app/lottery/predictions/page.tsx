"use client"

import { PredictionHistory } from "@/components/lottery/prediction-history"

export default function PredictionsHistoryPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">预测历史</h1>
          <p className="text-muted-foreground">
            查看所有保存的预测记录，支持按方法、期号、日期等条件筛选
          </p>
        </div>
        <PredictionHistory />
      </div>
    </div>
  )
}

