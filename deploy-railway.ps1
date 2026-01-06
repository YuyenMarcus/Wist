# Railway Deployment Script for Windows PowerShell
# Run this script to deploy scraper service to Railway

Write-Host "🚀 Deploying Scraper Service to Railway" -ForegroundColor Cyan
Write-Host ""

# Check if Railway CLI is installed
try {
    $railwayVersion = railway --version 2>&1
    Write-Host "✅ Railway CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Railway CLI not found. Installing..." -ForegroundColor Red
    npm install -g @railway/cli
}

Write-Host ""
Write-Host "Step 1: Login to Railway (will open browser)" -ForegroundColor Yellow
Write-Host "Press Enter to continue..."
Read-Host

railway login

Write-Host ""
Write-Host "Step 2: Initialize Railway project" -ForegroundColor Yellow
Write-Host "When prompted, choose 'Create new project' and name it 'wist-scraper'"
Write-Host "Press Enter to continue..."
Read-Host

railway init

Write-Host ""
Write-Host "Step 3: Deploying to Railway..." -ForegroundColor Yellow
railway up

Write-Host ""
Write-Host "Step 4: Getting Railway URL..." -ForegroundColor Yellow
$railwayUrl = railway domain
Write-Host ""
Write-Host "✅ Railway URL: $railwayUrl" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: Copy this URL and add it to your .env.local file:" -ForegroundColor Yellow
Write-Host "   SCRAPER_SERVICE_URL=$railwayUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Step 5: Testing deployment..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
$healthCheck = Invoke-WebRequest -Uri "$railwayUrl/health" -UseBasicParsing
Write-Host "Health check response: $($healthCheck.Content)" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green

