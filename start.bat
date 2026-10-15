@echo off
rem School Manager — double-click to start on Windows.
rem Requires Node.js 22 LTS or newer: https://nodejs.org
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download the LTS version from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing... this takes a minute the first time.
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :error
)

if not exist client\dist\index.html (
  echo Building the interface...
  call npm run build
  if errorlevel 1 goto :error
)

echo.
echo School Manager will open at http://localhost:4000  (press Ctrl+C to stop)
start "" http://localhost:4000
call npm start
goto :eof

:error
echo Something went wrong. Scroll up to read the error message.
pause
exit /b 1
