@echo off
rem PresBuilder editor: opens http://localhost:5180
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is required: https://nodejs.org & pause & exit /b 1)
if not exist node_modules call npm install
call npm run dev
pause
