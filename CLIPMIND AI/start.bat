@echo off
title ClipMind AI — Platform Launcher
color 0B

echo ==============================================================================
echo                      CLIPMIND AI - PLATFORM LAUNCHER                         
echo ==============================================================================
echo.

cd /d "%~dp0"

echo [*] Checking Environment and Ports...
:: Cleanly free port 8000 & 5173 if already occupied to prevent WinError 10048
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
echo.

:: Start FastAPI Backend Server
echo [1/3] Starting Backend API Server (Port 8000)...
start "ClipMind AI - Backend API" cmd /k "cd /d "%~dp0BACKEND" && venv\Scripts\python.exe run.py"

:: Give the backend a brief moment to initialize
ping 127.0.0.1 -n 3 >nul

:: Start React / Vite Frontend Server
echo [2/3] Starting Frontend Dev Server (Port 5173)...
start "ClipMind AI - Frontend UI" cmd /k "cd /d "%~dp0FRONTEND" && npm run dev"

:: Wait for frontend Vite dev server
ping 127.0.0.1 -n 3 >nul

:: Open Application in Browser
echo [3/3] Opening ClipMind AI in your web browser...
start http://localhost:5173

echo.
echo ==============================================================================
echo               ClipMind AI is now running successfully!                       
echo ==============================================================================
echo   - Web Application:  http://localhost:5173
echo   - Backend API Docs: http://localhost:8000/docs
echo   - Health Status:    http://localhost:8000/health
echo.
echo   Press any key to close this launcher window (services keep running).
echo ==============================================================================
pause >nul
exit /b 0
