"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { Bell, User, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { SearchBox } from "@/components/search/search-box"

interface User {
  id: string
  email: string
  name: string | null
  role: string
}

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUser()
  }, [pathname]) // 当路径变化时重新加载用户信息

  const loadUser = async () => {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include", // 确保发送Cookie
      })
      const data = await res.json()
      if (data.success) {
        setUser(data.data.user)
      }
    } catch (error) {
      console.error("Error loading user:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include", // 确保发送Cookie
      })
      const data = await res.json()

      if (data.success) {
        toast({
          title: "已退出登录",
          variant: "success",
        })
        setUser(null)
        router.push("/platforms")
        router.refresh()
      }
    } catch (error) {
      toast({
        title: "退出失败",
        description: "请重试",
        variant: "destructive",
      })
    }
  }

  const isPublicRoute = pathname === "/platforms" || pathname === "/login" || pathname === "/register"

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href={user ? "/" : "/platforms"} className="flex items-center gap-2">
            <span className="text-xl font-bold">NewsFocus</span>
          </Link>
          {/* 已隐藏的导航链接 */}
          {/* {user && (
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className="text-sm font-medium hover:text-primary">
                仪表板
              </Link>
              <Link href="/news" className="text-sm font-medium hover:text-primary">
                新闻列表
              </Link>
              <Link href="/analytics" className="text-sm font-medium hover:text-primary">
                数据分析
              </Link>
            </nav>
          )} */}
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <>
              <div className="hidden md:flex items-center gap-2">
                <SearchBox
                  className="w-[300px]"
                  placeholder="搜索新闻..."
                  showSuggestions={true}
                />
              </div>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  3
                </Badge>
              </Button>
            </>
          )}
          {loading ? (
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.name || "用户"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  登录
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">
                  注册
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
