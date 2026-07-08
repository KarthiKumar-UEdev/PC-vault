@echo off
title PC Vault

:: Kill old backend process first
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000 "') do (
    taskkill /f /pid %%p >nul 2>&1
)

echo.
echo  [PC Vault] Starting API server...
echo.

start "PC Vault API" cmd /c "cd /d "%~dp0backend" && node server.js"

echo  [PC Vault] Starting frontend dev server...
echo.

start "PC Vault Frontend" cmd /c "cd /d "%~dp0frontend" && npm run dev"

echo.
echo  Both servers starting (allow a few seconds):
echo    API:      http://localhost:8000
echo    Frontend: http://localhost:3000
echo.
echo  Close the windows to stop.
echo.
pause
