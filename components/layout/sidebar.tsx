"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Newspaper,
  BarChart3,
  History,
  Settings,
  Grid3x3,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  {
    title: "仪表板",
    href: "/",
    icon: LayoutDashboard,
    requireAuth: true,
  },
  {
    title: "多平台热点",
    href: "/platforms",
    icon: Grid3x3,
    requireAuth: false,
  },
  {
    title: "新闻列表",
    href: "/news",
    icon: Newspaper,
    requireAuth: true,
  },
  {
    title: "数据分析",
    href: "/analytics",
    icon: BarChart3,
    requireAuth: true,
  },
  {
    title: "历史查询",
    href: "/history",
    icon: History,
    requireAuth: true,
  },
  {
    title: "设置",
    href: "/settings",
    icon: Settings,
    requireAuth: true,
  },
]

const settingsSubItems = [
  {
    title: "关键词",
    href: "/settings/keywords",
  },
  {
    title: "通知",
    href: "/settings/notifications",
  },
  {
    title: "平台",
    href: "/settings/platforms",
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me")
      const data = await res.json()
      setIsAuthenticated(data.success)
    } catch (error) {
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  // 过滤导航项：未登录时只显示公开项
  const visibleNavItems = navItems.filter(item => 
    !item.requireAuth || isAuthenticated
  )

  // 如果是登录/注册页面，不显示侧边栏
  if (pathname === "/login" || pathname === "/register") {
    return null
  }

  return (
    <aside className="hidden md:flex flex-col w-64 border-r bg-background">
      <nav className="flex-1 space-y-1 p-4">
        {visibleNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname?.startsWith(item.href))
          
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.title}
              </Link>
              {isActive && item.href === "/settings" && isAuthenticated && (
                <div className="ml-8 mt-1 space-y-1">
                  {settingsSubItems.map((subItem) => (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors",
                        pathname === subItem.href
                          ? "bg-primary/20 text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      {subItem.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {!isAuthenticated && !loading && (
          <div className="mt-8 p-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              登录后可访问完整功能
            </p>
            <Link href="/login">
              <button className="w-full text-sm px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                登录
              </button>
            </Link>
          </div>
        )}
      </nav>
    </aside>
  )
}
