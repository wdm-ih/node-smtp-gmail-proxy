@echo off
cd /d %~dp0
node dist\smtp-proxy.js
echo.
echo Press any key to close...
pause >nul
