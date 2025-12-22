import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

/**
 * 默认页面 - 根据登录状态重定向
 * 业务逻辑：
 * - 未登录用户：重定向到登录页
 * - 已登录用户：重定向到福利彩票页面
 * 技术实现：检查 session cookie，然后重定向到相应页面
 */
export default async function HomePage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('newsfocus_session')
  
  if (!sessionToken) {
    // 未登录，重定向到登录页
    redirect('/login')
  } else {
    // 已登录，重定向到福利彩票页面
    redirect('/lottery')
  }
}
