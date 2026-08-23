@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo [scrap] 安装依赖…
call npm run install:all
if errorlevel 1 exit /b 1
echo [scrap] 启动开发服务（Web 3050 / API 9210）
call npm run dev
