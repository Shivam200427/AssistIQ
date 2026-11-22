@echo off
title AssistIQ Launcher
color 0B

echo ========================================================
echo             ASSISTIQ - STREET AI LAUNCHER
echo ========================================================
echo.
echo [1/2] Starting Flask Backend on http://127.0.0.1:5000 ...
start "AssistIQ Backend" cmd /k "cd /d %~dp0python-app && color 0B && python app.py"

echo [2/2] Starting Next.js Frontend on http://localhost:3000 ...
start "AssistIQ Frontend" cmd /k "cd /d %~dp0my-app && color 0B && npm run dev"

echo.
echo ========================================================
echo AssistIQ services are launching in separate windows!
echo Frontend: http://localhost:3000/home
echo Backend:  http://127.0.0.1:5000/health
echo ========================================================
echo.
pause
