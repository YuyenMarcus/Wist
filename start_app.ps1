# PowerShell startup script for Wist Scraper System
# Double-click this file or run: powershell -ExecutionPolicy Bypass -File start_app.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Wist Scraper System..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# 1. Start Flask Backend
Write-Host "[1/2] Starting Flask Backend (port 5000)..." -ForegroundColor Yellow
$flaskPath = Join-Path $scriptDir "scraper-service"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$flaskPath'; python app.py" -WindowStyle Normal

# 2. Wait for backend to initialize
Write-Host "[2/2] Waiting for backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 3. Start Next.js Frontend
Write-Host "[3/3] Starting Next.js Frontend (port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptDir'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "System is running!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to close this window..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

