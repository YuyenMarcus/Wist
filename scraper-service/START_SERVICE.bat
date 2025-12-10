@echo off
REM Set UTF-8 encoding for Windows console
chcp 65001 >nul 2>&1
set PYTHONUTF8=1

echo ============================================================
echo Starting Wist Scraper Service...
echo ============================================================
echo.
cd /d "%~dp0"
python app.py
pause

