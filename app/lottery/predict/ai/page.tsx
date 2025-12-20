"use client"

import { AIPredict } from "@/components/lottery/predict/ai-predict"

export default function AIPredictPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <AIPredict />
      </div>
    </div>
  )
}

