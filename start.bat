@echo off
chcp 65001 >nul
echo ============================================
echo    NewsFocus 项目启动脚本
echo ============================================
echo.

:: 检查 Node.js 是否安装
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 18+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/5] 检查 Node.js 版本...
node --version
echo.

:: 检查依赖是否安装
if not exist "node_modules" (
    echo [2/5] 检测到依赖未安装，正在安装...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
    echo [完成] 依赖安装成功
) else (
    echo [2/5] 依赖已安装
)
echo.

:: 检查环境变量文件（如果存在则完全跳过创建步骤）
if exist ".env.local" goto :skip_env_creation
if exist .env.local goto :skip_env_creation

:: 如果文件不存在，才创建
echo [3/5] 警告: 未找到 .env.local 文件
echo.
echo 请选择数据库配置方式:
echo   1. 使用本地 PostgreSQL 11 (开发环境)
echo   2. 使用 Neon PostgreSQL (生产环境)
echo.
set /p choice="请输入选项 (1 或 2): "

if "%choice%"=="1" (
    echo.
    echo 正在创建 .env.local 文件（开发环境）...
    echo # 开发环境配置 > .env.local
    echo DATABASE_URL="postgresql://postgres:password@localhost:5432/newsfocus_dev?schema=public" >> .env.local
    echo NODE_ENV="development" >> .env.local
    echo NEXT_PUBLIC_APP_URL="http://localhost:3000" >> .env.local
    echo CRON_SECRET="dev-secret-key-change-in-production" >> .env.local
    echo [完成] 已创建 .env.local 文件
    echo.
    echo ⚠️  请编辑 .env.local 文件，填入正确的数据库连接信息！
    echo.
    pause
    goto :skip_env_creation
)

if "%choice%"=="2" (
    echo.
    echo 正在创建 .env.local 文件（Neon 生产环境）...
    echo # Neon 生产环境配置 > .env.local
    echo DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-polished-firefly-ah588976-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" >> .env.local
    echo DATABASE_URL_UNPOOLED="postgresql://neondb_owner:YOUR_PASSWORD@ep-polished-firefly-ah588976.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" >> .env.local
    echo NODE_ENV="production" >> .env.local
    echo NEXT_PUBLIC_APP_URL="http://localhost:3000" >> .env.local
    echo CRON_SECRET="dev-secret-key-change-in-production" >> .env.local
    echo [完成] 已创建 .env.local 文件
    echo.
    echo ⚠️  请编辑 .env.local 文件，填入正确的 Neon 数据库连接信息！
    echo.
    pause
    goto :skip_env_creation
)

echo [错误] 无效的选项
pause
exit /b 1

:skip_env_creation
:: 如果文件存在，显示提示信息
if exist ".env.local" (
    echo [3/5] 环境变量文件已存在，使用现有配置
    echo       不会修改您的 .env.local 文件
    echo.
) else if exist .env.local (
    echo [3/5] 环境变量文件已存在，使用现有配置
    echo       不会修改您的 .env.local 文件
    echo.
)

:: 生成 Prisma 客户端
echo [4/5] 生成 Prisma 客户端...
call npm run db:generate
if %errorlevel% neq 0 (
    echo [警告] Prisma 客户端生成失败，但继续启动...
) else (
    echo [完成] Prisma 客户端生成成功
)
echo.

:: 检查数据库连接（可选）
echo [5/5] 检查数据库连接...
echo 提示: 如果数据库未初始化，请先运行以下命令:
echo   - 使用 SQL 脚本: psql %%DATABASE_URL%% -f sql/init-dev.sql
echo   - 或使用 Prisma: npm run db:migrate ^&^& npm run db:seed
echo.

:: 启动开发服务器
echo ============================================
echo    正在启动开发服务器...
echo ============================================
echo.
echo 访问地址: http://localhost:3000
echo 按 Ctrl+C 停止服务器
echo.

call npm run dev

pause
