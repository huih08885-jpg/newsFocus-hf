import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 公开路由（无需登录）
const publicRoutes = [
  '/login', 
  '/register', 
  '/lottery',  // 福利彩票相关路由全部公开
  '/privacy',  // 隐私政策页面
]

// 需要登录的路由（新闻聚焦相关功能已禁用，保留用于兼容）
const protectedRoutes = [
  // '/',  // 已重定向到 /lottery
  // '/news',  // 新闻聚焦功能已禁用
  // '/analytics',  // 新闻聚焦功能已禁用
  // '/settings',  // 新闻聚焦功能已禁用
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 检查是否是公开路由
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )

  // 检查是否是受保护的路由
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )

  // 如果是公开路由，直接放行
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // 如果是受保护的路由，检查 session cookie
  if (isProtectedRoute) {
    const sessionToken = request.cookies.get('newsfocus_session')

    if (!sessionToken) {
      // 未登录，重定向到登录页
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // API 路由保护（除了公开的 API）
  if (pathname.startsWith('/api/')) {
    // 公开的 API 路由（无需登录）
    const publicApiRoutes = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/lottery',  // 福利彩票相关API全部公开
      '/api/news/platforms',
      '/api/news/platforms/public',
    ]
    const isPublicApi = publicApiRoutes.some(route => pathname.startsWith(route))
    
    // 如果不是公开 API，需要登录（但新闻聚焦功能已禁用，大部分API会返回503）
    if (!isPublicApi) {
      const sessionToken = request.cookies.get('newsfocus_session')
      if (!sessionToken) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: '需要登录' } },
          { status: 401 }
        )
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (favicon文件)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

