import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 公开路由（无需登录）- 只有登录和注册页
const publicRoutes = [
  '/login', 
  '/register',
]

// 静态资源路径（无需登录）
const staticPaths = [
  '/_next',
  '/favicon.ico',
  '/api/auth/login',
  '/api/auth/register',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 检查是否是静态资源路径
  const isStaticPath = staticPaths.some(path => 
    pathname.startsWith(path)
  )
  if (isStaticPath) {
    return NextResponse.next()
  }

  // 检查是否是公开路由
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )

  // 如果是公开路由，直接放行
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // 检查 session cookie
  const sessionToken = request.cookies.get('newsfocus_session')

  // 如果未登录，重定向到登录页
  if (!sessionToken) {
    // API 路由返回 JSON 错误
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '需要登录' } },
        { status: 401 }
      )
    }
    
    // 页面路由重定向到登录页
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 已登录用户，允许访问所有页面
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

