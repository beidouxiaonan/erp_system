@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ==================================================
echo       ERP System Pro - 局域网共享模式 (修复版)
echo ==================================================

:: --- 1. 自动获取本机 IPv4 地址 (使用通用分割法) ---
set "IP_ADDR="

:: 方法：先找包含 192.168 的行，然后提取冒号后面的内容
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "192.168"') do (
    set "IP_ADDR=%%a"
)

:: 如果没找到 192.168 (比如用的是 10.x.x.x 网络)，则找第一个 IPv4
if not defined IP_ADDR (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
        set "IP_ADDR=%%a"
    )
)

:: 核心修复：去掉 IP 前后可能存在的空格
if defined IP_ADDR (
    set "IP_ADDR=!IP_ADDR: =!"
)

:: 如果还是空的（极少见），强制设为 localhost 以防报错
if not defined IP_ADDR set IP_ADDR=localhost

:: --- 2. 启动后端 ---
echo "[1/3] 正在启动后端 (开放局域网访问)..."
:: start /B 后台运行
start /B "" uvicorn api:app --host 0.0.0.0 --port 8000 > backend.log 2>&1

:: --- 3. 启动前端 ---
echo "[2/3] 正在启动前端 (开放局域网访问)..."
cd figmaui
:: start /B 后台运行
start /B "" cmd /c "npm run dev -- --host 0.0.0.0"
cd ..

:: --- 4. 生成访问信息文件 ---
echo. > server_info.txt
echo ================================================== >> server_info.txt
echo ERP 系统已启动 (局域网模式) >> server_info.txt
echo 启动时间: %date% %time% >> server_info.txt
echo. >> server_info.txt
echo [本机访问地址]: http://localhost:5173 >> server_info.txt
echo [同事访问地址]: http://!IP_ADDR!:5173 >> server_info.txt
echo. >> server_info.txt
echo [状态检查]: >> server_info.txt
echo   - 你的 IP 是: !IP_ADDR! >> server_info.txt
echo   - 如果同事无法访问，请检查 Windows 防火墙是否放行了 Python 和 Node.js。 >> server_info.txt
echo ================================================== >> server_info.txt

echo "[3/3] 启动完成！"
echo --------------------------------------------------
echo [SUCCESS] IP 获取成功: !IP_ADDR!
echo [INFO] 访问链接已生成: server_info.txt
echo [INFO] 窗口将在 5 秒后关闭...
echo --------------------------------------------------

timeout /t 5 >nul
exit