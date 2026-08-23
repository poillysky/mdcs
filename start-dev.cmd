@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [mdcs] 国内源安装依赖...
call npm install
if errorlevel 1 exit /b 1
call npm run install:all
if errorlevel 1 exit /b 1
echo [mdcs] 启动后端 :9210 + 前端 :3050 ...
call npm run dev:all
