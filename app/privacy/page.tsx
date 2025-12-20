"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function PrivacyPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回首页
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">隐私政策</CardTitle>
          <CardDescription>
            最后更新日期：2024-12-05
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 prose prose-sm max-w-none">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. 信息收集</h2>
            <p className="text-muted-foreground mb-2">
              我们收集以下类型的个人信息：
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li><strong>账户信息</strong>：邮箱地址、用户名、加密后的密码</li>
              <li><strong>使用数据</strong>：您浏览的新闻、收藏的内容、搜索记录</li>
              <li><strong>行为数据</strong>：点击、查看、分享等操作记录</li>
              <li><strong>技术信息</strong>：IP地址、浏览器类型、设备信息</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. 信息使用</h2>
            <p className="text-muted-foreground mb-2">
              我们使用收集的信息用于以下目的：
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>提供和改善我们的服务</li>
              <li>个性化推荐内容</li>
              <li>分析用户行为以优化用户体验</li>
              <li>发送重要通知和更新</li>
              <li>保护系统安全和防止欺诈</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. 信息共享</h2>
            <p className="text-muted-foreground">
              我们不会向第三方出售、交易或转让您的个人信息，除非：
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground mt-2">
              <li>获得您的明确同意</li>
              <li>法律法规要求</li>
              <li>保护我们的权利和财产</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. 数据安全</h2>
            <p className="text-muted-foreground">
              我们采用行业标准的安全措施来保护您的个人信息，包括：
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground mt-2">
              <li>密码加密存储（bcrypt）</li>
              <li>HTTPS 加密传输</li>
              <li>数据库访问控制</li>
              <li>定期安全审计</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. 您的权利</h2>
            <p className="text-muted-foreground mb-2">
              根据相关法律法规，您享有以下权利：
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li><strong>访问权</strong>：查看我们持有的您的个人信息</li>
              <li><strong>更正权</strong>：更正不准确的个人信息</li>
              <li><strong>删除权</strong>：要求删除您的个人信息</li>
              <li><strong>撤回同意</strong>：随时撤回您对数据处理的同意</li>
              <li><strong>数据可携权</strong>：以结构化格式导出您的数据</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              如需行使上述权利，请通过以下方式联系我们：
            </p>
            <p className="text-muted-foreground">
              邮箱：contact@example.com
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Cookie 使用</h2>
            <p className="text-muted-foreground">
              我们使用 Cookie 和类似技术来：
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground mt-2">
              <li>保持您的登录状态</li>
              <li>记住您的偏好设置</li>
              <li>分析网站使用情况</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              您可以通过浏览器设置管理 Cookie，但这可能影响某些功能的正常使用。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. 第三方服务</h2>
            <p className="text-muted-foreground">
              我们的服务可能包含第三方链接和服务。我们不对这些第三方的隐私做法负责。
              我们使用的第三方服务包括：
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground mt-2">
              <li>数据库服务提供商</li>
              <li>AI 服务提供商（用于内容分析）</li>
              <li>云服务提供商</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. 数据保留</h2>
            <p className="text-muted-foreground">
              我们仅在实现本政策所述目的所需的期间内保留您的个人信息。
              当您删除账户时，我们将删除或匿名化您的个人信息，除非法律法规要求我们保留。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. 儿童隐私</h2>
            <p className="text-muted-foreground">
              我们的服务不面向 18 岁以下的儿童。我们不会故意收集儿童的个人信息。
              如果您发现我们收集了儿童信息，请立即联系我们。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. 政策更新</h2>
            <p className="text-muted-foreground">
              我们可能会不时更新本隐私政策。重大变更时，我们会在网站上发布通知。
              继续使用我们的服务即表示您接受更新后的政策。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. 联系我们</h2>
            <p className="text-muted-foreground">
              如果您对本隐私政策有任何疑问或意见，请通过以下方式联系我们：
            </p>
            <ul className="list-none space-y-1 text-muted-foreground mt-2">
              <li>邮箱：contact@example.com</li>
              <li>地址：[您的地址]</li>
            </ul>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}

