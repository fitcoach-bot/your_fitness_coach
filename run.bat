@echo off
color 0A
echo ====================================================
echo    FitCoach AI - WhatsApp Bot Startup Script
echo ====================================================

echo.
echo [1/3] Cleaning up old processes...
taskkill /IM node.exe /F >nul 2>&1
taskkill /IM chrome.exe /FI "WINDOWTITLE eq " /F >nul 2>&1

echo [2/3] Checking internet connection...
ping google.com -n 1 -w 3000 >nul 2>&1
if errorlevel 1 (
    echo [!] WARNING: No internet detected! Please connect to Wi-Fi.
    echo Press any key to start the bot anyway or close this window...
    pause >nul
) else (
    echo [+] Internet connected properly!
)

echo.
echo [3/3] Starting the Bot Service...
echo Please wait...
echo.

cd /d "%~dp0"
node index.js

pause
