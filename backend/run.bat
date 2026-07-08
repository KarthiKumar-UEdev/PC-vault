@echo off
title PC Vault API
cd /d "%~dp0"

:: Kill any leftover process on port 8000
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000 "') do (
    taskkill /f /pid %%p >nul 2>&1
)

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo npm install failed
        pause
        exit /b 1
    )
)

echo.
echo   ___   ___     __      __      __   __   /|
echo  / _ \ / _ \    \ \    / /     \ \ / /  / /
echo | (_) | (_) |____\ \  / /_____  \ V /  / / 
echo  \__, |\__, |_____|\ \/ /______|  \_/  /_/  
echo    /_/   /_/          \/                     
echo.
echo   PC Vault API — http://localhost:8000
echo.

node server.js

echo.
echo Server exited with code %errorlevel%
pause
