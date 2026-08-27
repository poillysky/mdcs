@echo off
setlocal
cd /d "%~dp0"

echo [mdcs] Checking ports 3050 and 9210...

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3050" ^| findstr "LISTENING"') do (
  echo [mdcs] Kill PID %%p on port 3050
  taskkill /F /PID %%p >nul 2>&1
)

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":9210" ^| findstr "LISTENING"') do (
  echo [mdcs] Kill PID %%p on port 9210
  taskkill /F /PID %%p >nul 2>&1
)

timeout /t 1 /nobreak >nul

echo [mdcs] Starting dev server (Web 3050 / API 9210)
call npm run dev

endlocal
