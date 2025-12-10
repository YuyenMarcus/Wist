# PowerShell script to start the scraper service
# Set UTF-8 encoding for Windows console
$env:PYTHONUTF8 = "1"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Starting Wist Scraper Service..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to script directory
Set-Location $PSScriptRoot

# Run the service
python app.py

# Keep window open
Write-Host ""
Write-Host "Service stopped. Press any key to close..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

