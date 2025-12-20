"use client"

import { MLPredict } from "@/components/lottery/predict/ml-predict"

export default function MLPredictPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <MLPredict />
      </div>
    </div>
  )
}

