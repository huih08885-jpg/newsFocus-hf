import { redirect } from 'next/navigation'

/**
 * 默认页面 - 重定向到开奖结果页面
 * 业务逻辑：用户访问根路径时，自动跳转到福利彩票开奖结果页面
 * 技术实现：使用 Next.js 的 redirect 函数进行服务端重定向
 */
export default function HomePage() {
  redirect('/lottery')
}
