"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Settings,
  Shield,
  Sparkles,
  ChevronDown,
  ChevronRight,
  List,
  BarChart3,
  Clock,
  PieChart,
  Brain,
  TrendingUp,
  Search,
  History,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  title: string
  href?: string
  icon: any
  requireAuth: boolean
  children?: NavItem[]
}

const navItems: NavItem[] = [
  // ========== 已隐藏的爬虫管理模块 ==========
  // {
  //   title: "爬虫管理",
  //   href: "/",
  //   icon: LayoutDashboard,
  //   requireAuth: true,
  // },
  // {
  //   title: "默认爬虫",
  //   href: "/platforms",
  //   icon: Grid3x3,
  //   requireAuth: false,
  // },
  // {
  //   title: "搜索爬虫",
  //   icon: Search,
  //   requireAuth: true,
  //   children: [
  //     {
  //       title: "发现站点",
  //       href: "/discover",
  //       icon: Search,
  //       requireAuth: true,
  //     },
  //     {
  //       title: "站点爬虫",
  //       href: "/sites",
  //       icon: Globe,
  //       requireAuth: true,
  //     },
  //   ],
  // },
  // {
  //   title: "关键词爬虫",
  //   icon: FileText,
  //   requireAuth: true,
  //   children: [
  //     {
  //       title: "关键词配置",
  //       href: "/settings/keywords",
  //       icon: Settings,
  //       requireAuth: true,
  //     },
  //     {
  //       title: "关键词爬虫新闻",
  //       href: "/news",
  //       icon: Newspaper,
  //       requireAuth: true,
  //     },
  //   ],
  // },
  // {
  //   title: "AI 智能分析",
  //   href: "/analysis",
  //   icon: Sparkles,
  //   requireAuth: true,
  // },
  // {
  //   title: "AI 搜索",
  //   href: "/ai-search",
  //   icon: Search,
  //   requireAuth: true,
  // },
  // ========== 已隐藏的需求雷达模块 ==========
  // {
  //   title: "需求雷达",
  //   href: "/demand-radar",
  //   icon: Shield,
  //   requireAuth: true,
  // },
  {
    title: "开奖结果",
    href: "/lottery",
    icon: List,
    requireAuth: false,
  },
  {
    title: "预测历史",
    href: "/lottery/predictions",
    icon: History,
    requireAuth: false,
  },
  {
    title: "预测",
    icon: Sparkles,
    requireAuth: false,
    children: [
      {
        title: "综合预测",
        href: "/lottery/predict",
        icon: Sparkles,
        requireAuth: false,
      },
      {
        title: "统计分析预测",
        href: "/lottery/predict/statistical",
        icon: BarChart3,
        requireAuth: false,
      },
      {
        title: "AI分析预测",
        href: "/lottery/predict/ai",
        icon: Brain,
        requireAuth: false,
      },
      {
        title: "机器学习预测",
        href: "/lottery/predict/ml",
        icon: TrendingUp,
        requireAuth: false,
      },
    ],
  },
  {
    title: "辅助分析",
    icon: BarChart3,
    requireAuth: false,
    children: [
      {
        title: "频率分析",
        href: "/lottery/analysis/frequency",
        icon: BarChart3,
        requireAuth: false,
      },
      {
        title: "遗漏分析",
        href: "/lottery/analysis/omission",
        icon: Clock,
        requireAuth: false,
      },
      {
        title: "分布分析",
        href: "/lottery/analysis/distribution",
        icon: PieChart,
        requireAuth: false,
      },
      {
        title: "模式识别",
        href: "/lottery/analysis/pattern",
        icon: Search,
        requireAuth: false,
      },
    ],
  },
  // ========== 已隐藏的设置模块 ==========
  // {
  //   title: "设置",
  //   href: "/settings",
  //   icon: Settings,
  //   requireAuth: true,
  // },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    checkAuth()
  }, [pathname]) // 当路径变化时重新检查认证状态

  useEffect(() => {
    // 自动展开包含当前路径的分组
    const activeGroup = navItems.find(item => {
      if (item.children) {
        return item.children.some(child => {
          if (child.href === "/") return pathname === "/"
          // 精确匹配：只有当路径完全匹配时才激活
          // 这样可以避免父路径在访问子路径时被误激活
          return child.href && pathname === child.href
        })
      }
      return false
    })
    if (activeGroup) {
      setExpandedGroups(prev => new Set(prev).add(activeGroup.title))
    }
  }, [pathname])

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include", // 确保发送Cookie
      })
      const data = await res.json()
      setIsAuthenticated(data.success)
    } catch (error) {
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  // 检查子菜单是否包含当前路径
  const isGroupActive = (item: NavItem): boolean => {
    if (item.children) {
      return item.children.some(child => {
        if (child.href === "/") return pathname === "/"
        // 精确匹配：只有当路径完全匹配时才激活
        // 这样可以避免父路径在访问子路径时被误激活
        return child.href && pathname === child.href
      })
    }
    return false
  }

  // 过滤导航项：未登录时只显示公开项
  const visibleNavItems = navItems.filter(item => {
    if (item.children) {
      // 如果有子菜单，检查子菜单中是否有公开项
      return item.children.some(child => !child.requireAuth || isAuthenticated)
    }
    return !item.requireAuth || isAuthenticated
  })

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(title)) {
        next.delete(title)
      } else {
        next.add(title)
      }
      return next
    })
  }

  // 如果是登录/注册页面，不显示侧边栏
  if (pathname === "/login" || pathname === "/register") {
    return null
  }

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-16 bottom-0 w-64 border-r bg-background overflow-y-auto">
      <nav className="flex-1 space-y-1 p-4">
        {visibleNavItems.length > 0 ? (
          visibleNavItems.map((item) => {
            const Icon = item.icon
            if (!Icon) {
              console.warn(`Missing icon for nav item: ${item.title}`)
              return null
            }
            
            const hasChildren = item.children && item.children.length > 0
            const isExpanded = expandedGroups.has(item.title)
            const isGroupActiveState = hasChildren ? isGroupActive(item) : false
            // 精确匹配：只有当路径完全匹配时才激活，避免子路径误激活父菜单项
            const isActive = !hasChildren && pathname === item.href

            // 过滤子菜单项
            const visibleChildren = hasChildren 
              ? item.children!.filter(child => !child.requireAuth || isAuthenticated)
              : []

            return (
              <div key={item.title}>
                {hasChildren ? (
                  <>
                    <button
                      onClick={() => toggleGroup(item.title)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isGroupActiveState
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="flex-1 text-left">{item.title}</span>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {isExpanded && visibleChildren.length > 0 && (
                      <div className="ml-4 mt-1 space-y-1 border-l-2 border-border pl-2">
                        {visibleChildren.map((child) => {
                          const ChildIcon = child.icon
                          if (!ChildIcon) {
                            console.warn(`Missing icon for child nav item: ${child.title}`)
                            return null
                          }
                          
                          // 精确匹配：只有当路径完全匹配时才激活
                          // 这样可以避免父路径（如 /lottery/predict）在访问子路径（如 /lottery/predict/statistical）时被误激活
                          const isChildActive = pathname === child.href
                          
                          return (
                            <Link
                              key={child.href || child.title}
                              href={child.href || "#"}
                              className={cn(
                                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors",
                                isChildActive
                                  ? "bg-primary/20 text-primary font-medium"
                                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                              )}
                            >
                              <ChildIcon className="h-4 w-4" />
                              {child.title}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href || "#"}
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
                )}
              </div>
            )
          })
        ) : (
          <div className="text-sm text-muted-foreground p-4 text-center">
            暂无可用菜单项
          </div>
        )}
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
      <div className="mt-auto p-4 border-t">
        <Link
          href="/privacy"
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          )}
        >
          <Shield className="h-4 w-4" />
          <span>隐私政策</span>
        </Link>
      </div>
    </aside>
  )
}
