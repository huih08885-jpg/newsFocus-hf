@echo off
chcp 65001 >nul
REM Database First Workflow Helper Script (Windows)
REM Purpose: Pull database structure and update Prisma schema

echo.
echo [Database First] Syncing database structure to Prisma Schema...
echo.

REM Check if in project root
if not exist "prisma\schema.prisma" (
    echo [ERROR] Please run this script from project root directory
    exit /b 1
)

REM Check if .env.local or .env exists
if not exist ".env.local" if not exist ".env" (
    echo [WARNING] No .env.local or .env file found
    echo.
    echo Please create a .env.local file with:
    echo   DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
    echo.
    echo Or set DATABASE_URL in your system environment variables.
    echo.
)

REM Check DATABASE_URL
if "%DATABASE_URL%"=="" (
    echo [ERROR] DATABASE_URL environment variable is not set
    echo.
    echo Please do one of the following:
    echo   1. Create .env.local file in project root with:
    echo      DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"
    echo.
    echo   2. Set DATABASE_URL in system environment variables
    echo.
    echo   3. Or use PowerShell script: scripts\sync-db-schema.ps1
    echo.
    echo See docs\setup-env-file.md for more details.
    exit /b 1
)

echo [Step 1] Pulling database structure...
call npx prisma db pull
if errorlevel 1 (
    echo [ERROR] Failed to pull database structure.
    echo         Please check DATABASE_URL is set correctly.
    exit /b 1
)

echo.
echo [Step 2] Generating Prisma client...
call npx prisma generate
if errorlevel 1 (
    echo [ERROR] Failed to generate Prisma client. Please check schema file.
    exit /b 1
)

echo.
echo [SUCCESS] Done!
echo.
echo Next steps:
echo    1. Check changes in prisma\schema.prisma
echo    2. Restart dev server if needed
echo    3. Run 'npm run dev' to start server
echo.

