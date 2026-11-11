@echo off
chcp 65001 >nul
title 创量投放 - 本地系统
cd /d "%~dp0"

echo ========================================
echo   创量投放 · 百度信息流批量投放系统
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js
  echo 请先安装 Node.js LTS 版本：https://nodejs.org/zh-cn
  echo 安装完成后重新双击本文件。
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/3] 首次运行，正在安装依赖，请保持联网，大约 1-3 分钟...
  call npm install --registry=https://registry.npmmirror.com
  if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
) else (
  echo [1/3] 依赖已就绪
)

if not exist ".next" (
  echo [2/3] 正在构建本地系统，首次大约 1-2 分钟...
  call npm run build
  if errorlevel 1 (
    echo [错误] 构建失败，请把本窗口截图反馈。
    pause
    exit /b 1
  )
) else (
  echo [2/3] 构建产物已就绪
)

echo [3/3] 正在启动，浏览器会自动打开 http://localhost:3000
echo 使用期间请勿关闭本窗口；关闭窗口即停止系统。
echo.
start "" http://localhost:3000
call npm start

echo.
echo 系统已停止。
pause
