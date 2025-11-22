"use client"

import { useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Application error:", error)
  }, [error])

  return (
    <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>出现错误</CardTitle>
          </div>
          <CardDescription>
            应用程序遇到了一个错误
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-md">
            <p className="text-sm font-mono text-destructive">
              {error.message}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={reset}>重试</Button>
            <Button variant="outline" onClick={() => window.location.href = "/"}>
              返回首页
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

