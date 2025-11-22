import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function NotFound() {
  return (
    <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">404 - 页面未找到</CardTitle>
          <CardDescription>
            抱歉，您访问的页面不存在
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            页面可能已被删除或移动，请检查URL是否正确。
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/">返回首页</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/news">查看新闻</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

