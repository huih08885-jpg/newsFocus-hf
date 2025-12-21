"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

export function DisabledModule({ moduleName = "新闻聚焦" }: { moduleName?: string }) {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            功能已禁用
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {moduleName}模块已禁用，系统仅保留福利彩票功能。
          </p>
          <Link href="/lottery">
            <Button>前往福利彩票页面</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

