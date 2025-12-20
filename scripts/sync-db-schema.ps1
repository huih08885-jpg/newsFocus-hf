# Database First Workflow Helper Script (PowerShell)
# Purpose: Pull database structure and update Prisma schema

Write-Host ""
Write-Host "[Database First] Syncing database structure to Prisma Schema..." -ForegroundColor Cyan
Write-Host ""

# Check if in project root
if (-not (Test-Path "prisma\schema.prisma")) {
    Write-Host "[ERROR] Please run this script from project root directory" -ForegroundColor Red
    exit 1
}

# Load .env.local or .env file
$envFile = $null
if (Test-Path ".env.local") {
    $envFile = ".env.local"
    Write-Host "[INFO] Loading environment variables from .env.local..." -ForegroundColor Green
} elseif (Test-Path ".env") {
    $envFile = ".env"
    Write-Host "[INFO] Loading environment variables from .env..." -ForegroundColor Green
}

if ($envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($key, $value, 'Process')
        }
    }
}

# Check DATABASE_URL
if (-not $env:DATABASE_URL) {
    Write-Host "[ERROR] DATABASE_URL environment variable is not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please create a .env.local file with:" -ForegroundColor Yellow
    Write-Host '  DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"' -ForegroundColor Yellow
    Write-Host ""
    Write-Host "See docs\setup-env-file.md for more details." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "[INFO] DATABASE_URL is configured" -ForegroundColor Green
}

Write-Host ""
Write-Host "[Step 1] Pulling database structure..." -ForegroundColor Cyan
npx prisma db pull
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to pull database structure. Please check database connection." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[Step 2] Generating Prisma client..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to generate Prisma client. Please check schema file." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[SUCCESS] Done!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Check changes in prisma\schema.prisma"
Write-Host "  2. Restart dev server if needed"
Write-Host "  3. Run 'npm run dev' to start server"
Write-Host ""

