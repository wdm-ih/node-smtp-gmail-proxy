@echo off
cd /d %~dp0
node build\smtp-proxy.js
echo.
echo Press any key to close...
pause >nul
