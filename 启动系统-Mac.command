#!/bin/bash
cd "$(dirname "$0")" || exit 1

echo "========================================"
echo "  创量投放 · 百度信息流批量投放系统"
echo "========================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js"
  echo "请先安装 Node.js LTS 版本：https://nodejs.org/zh-cn"
  echo "安装完成后重新双击本文件。"
  read -r -p "按回车键退出..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "[1/3] 首次运行，正在安装依赖，请保持联网..."
  npm install --registry=https://registry.npmmirror.com || {
    echo "[错误] 依赖安装失败，请检查网络后重试。"
    read -r -p "按回车键退出..."
    exit 1
  }
else
  echo "[1/3] 依赖已就绪"
fi

if [ ! -d ".next" ]; then
  echo "[2/3] 正在构建本地系统，首次大约 1-2 分钟..."
  npm run build || {
    echo "[错误] 构建失败，请把本窗口截图反馈。"
    read -r -p "按回车键退出..."
    exit 1
  }
else
  echo "[2/3] 构建产物已就绪"
fi

echo "[3/3] 正在启动，浏览器会自动打开 http://localhost:3000"
echo "使用期间请勿关闭本窗口；关闭窗口即停止系统。"
echo ""

( sleep 3; open "http://localhost:3000" >/dev/null 2>&1 ) &
npm start

echo ""
echo "系统已停止。"
read -r -p "按回车键退出..."
