import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "NewsFocus - 新闻热点聚合系统",
  description: "多平台新闻热点监控、筛选、分析和推送系统",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <div className="flex min-h-screen flex-col">
          <Header />
          <div className="flex flex-1 pt-16">
            <Sidebar />
            <main className="flex-1 bg-background md:ml-64 overflow-auto">
              {children}
            </main>
          </div>
        </div>
        <Toaster />
      </body>
    </html>
  )
}

