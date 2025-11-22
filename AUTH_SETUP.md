# 用户认证系统设置指南

## 📋 已完成的功能

### 1. 数据库模型
- ✅ User 表：存储用户信息
- ✅ Session 表：存储会话信息

### 2. 认证 API
- ✅ `POST /api/auth/login` - 登录
- ✅ `POST /api/auth/register` - 注册
- ✅ `POST /api/auth/logout` - 登出
- ✅ `GET /api/auth/me` - 获取当前用户

### 3. 页面
- ✅ `/login` - 登录页面
- ✅ `/register` - 注册页面
- ✅ `/platforms` - 公开的多平台热点页面（无需登录）

### 4. 路由保护
- ✅ Middleware 保护受保护的路由
- ✅ 未登录用户自动重定向到登录页
- ✅ 公开路由无需登录即可访问

### 5. UI 更新
- ✅ Header 显示登录状态和用户信息
- ✅ Sidebar 根据登录状态显示不同菜单
- ✅ 登录/登出功能

## 🚀 使用步骤

### 第一步：更新数据库

运行数据库迁移：

```bash
# 生成 Prisma Client
pnpm db:generate

# 推送数据库变更
pnpm db:push

# 或使用迁移
pnpm db:migrate
```

### 第二步：安装依赖

```bash
pnpm install
```

### 第三步：创建第一个用户

可以通过注册页面创建，或使用 Prisma Studio：

```bash
pnpm db:studio
```

### 第四步：测试

1. **访问公开页面**：
   - 访问 `/platforms` - 应该可以正常查看多平台热点
   - 访问 `/login` - 应该可以正常访问登录页

2. **测试登录**：
   - 访问 `/` - 应该重定向到登录页
   - 登录后应该可以访问所有页面

3. **测试权限**：
   - 未登录时，访问 `/news`、`/analytics` 等应该重定向到登录页
   - 登录后应该可以正常访问

## 🔒 权限说明

### 公开路由（无需登录）
- `/platforms` - 多平台热点
- `/login` - 登录页
- `/register` - 注册页

### 受保护路由（需要登录）
- `/` - 仪表板
- `/news` - 新闻列表
- `/analytics` - 数据分析
- `/history` - 历史查询
- `/settings` - 设置

### API 路由保护
- 大部分 API 需要登录
- `/api/news/platforms/public` - 公开 API（无需登录）

## 📝 功能说明

### 未登录用户
- ✅ 可以查看多平台热点（`/platforms`）
- ✅ 可以注册和登录
- ❌ 无法访问其他页面
- ❌ 无法执行爬取操作
- ❌ 无法查看详细分析

### 已登录用户
- ✅ 可以访问所有页面
- ✅ 可以执行所有操作
- ✅ 可以配置关键词
- ✅ 可以查看数据分析
- ✅ 可以执行爬取任务

## 🔧 配置说明

### Session 配置
- Session 有效期：7天
- Cookie 名称：`newsfocus_session`
- Cookie 设置：HttpOnly, Secure (生产环境), SameSite: Lax

### 密码加密
- 使用 bcryptjs
- 加密轮数：10

## 🐛 常见问题

### Q: 登录后仍然重定向到登录页？
**A**: 检查：
1. Cookie 是否正确设置
2. Middleware 是否正确配置
3. Session 是否在数据库中创建

### Q: 注册失败？
**A**: 检查：
1. 数据库连接是否正常
2. User 表是否创建
3. 邮箱是否已存在

### Q: API 返回 401？
**A**: 检查：
1. 是否已登录
2. Session 是否过期
3. Cookie 是否正确发送

## 📚 相关文件

- `prisma/schema.prisma` - 数据库模型
- `lib/auth.ts` - 认证工具函数
- `middleware.ts` - 路由保护中间件
- `app/api/auth/*` - 认证 API
- `app/login/page.tsx` - 登录页面
- `app/register/page.tsx` - 注册页面
- `components/layout/header.tsx` - Header 组件
- `components/layout/sidebar.tsx` - Sidebar 组件

