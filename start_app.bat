@echo off
echo ========================================
echo Starting Wist Scraper System...
echo ========================================
echo.

:: Change to project root directory
cd /d "%~dp0"

:: 1. Start Flask Backend in a new window
echo [1/2] Starting Flask Backend (port 5000)...
start "Wist Flask Backend" cmd /k "cd scraper-service && python app.py"

:: 2. Wait 5 seconds for backend to load
echo [2/2] Waiting for backend to initialize...
timeout /t 5 /nobreak >nul

:: 3. Start Next.js Frontend in a new window
echo [3/3] Starting Next.js Frontend (port 3000)...
start "Wist Next.js Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo System is running!
echo ========================================
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:5000
echo.
echo Press any key to close this window...
pause >nul


