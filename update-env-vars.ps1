# Update Environment Variables Script
# This script helps you add the required environment variables

$CRON_SECRET = "52610854dc77aba497e58581e99edde8f5a42d051bee0ce31eea976c73b472f3"

Write-Host "🔧 Environment Variables Setup" -ForegroundColor Cyan
Write-Host ""

# Get Railway URL
Write-Host "Enter your Railway scraper URL (e.g., https://wist-scraper.railway.app):" -ForegroundColor Yellow
$SCRAPER_URL = Read-Host

if (-not $SCRAPER_URL) {
    Write-Host "❌ Railway URL is required!" -ForegroundColor Red
    exit 1
}

# Ensure URL starts with https://
if (-not $SCRAPER_URL.StartsWith("http")) {
    $SCRAPER_URL = "https://$SCRAPER_URL"
}

Write-Host ""
Write-Host "Updating .env.local file..." -ForegroundColor Yellow

# Read existing .env.local or create new
$envFile = ".env.local"
$envContent = @()

if (Test-Path $envFile) {
    $envContent = Get-Content $envFile
    $envContent = $envContent | Where-Object { 
        -not $_.StartsWith("SCRAPER_SERVICE_URL=") -and 
        -not $_.StartsWith("CRON_SECRET=") 
    }
}

# Add new variables
$envContent += "SCRAPER_SERVICE_URL=$SCRAPER_URL"
$envContent += "CRON_SECRET=$CRON_SECRET"

# Write to file
$envContent | Set-Content $envFile

Write-Host "✅ .env.local updated!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Add these to Vercel Dashboard:" -ForegroundColor Yellow
Write-Host "   1. Go to: https://vercel.com/dashboard" -ForegroundColor Cyan
Write-Host "   2. Select your project" -ForegroundColor Cyan
Write-Host "   3. Settings → Environment Variables" -ForegroundColor Cyan
Write-Host "   4. Add these variables:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   SCRAPER_SERVICE_URL = $SCRAPER_URL" -ForegroundColor Green
Write-Host "   CRON_SECRET = $CRON_SECRET" -ForegroundColor Green
Write-Host ""
Write-Host "   Make sure to check: Production, Preview, Development" -ForegroundColor Yellow
Write-Host ""

