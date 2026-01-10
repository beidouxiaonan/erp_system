@echo off
chcp 65001 >nul 2>&1  # 解决中文乱码
setlocal enabledelayedexpansion

REM 配置项（根据你的项目修改）
set "PROJECT_DIR=d:\gitworkspace\erp-system-pro\figmaui"
set "LOG_FILE=%PROJECT_DIR%\vite-dev.log"  # 日志文件路径
set "VBS_TEMP=%temp%\vite_dev_bg.vbs"     # 临时VBS文件（用于隐藏窗口）

REM 1. 检查项目目录是否存在
if not exist "%PROJECT_DIR%" (
    echo [ERROR] 项目目录不存在：%PROJECT_DIR%
    pause
    exit /b 1
)

REM 2. 生成隐藏窗口的VBS脚本（核心：后台运行无窗口）
echo Set WshShell = CreateObject("WScript.Shell") > "%VBS_TEMP%"
echo WshShell.Run "cmd /c cd /d ""%PROJECT_DIR%"" && npm run dev > ""%LOG_FILE%"" 2>&1", 0, False >> "%VBS_TEMP%"


REM 3. 启动后台服务
echo [INFO] 正在后台启动 Vite 开发服务器...
echo [INFO] 日志文件：%LOG_FILE%
cscript //nologo "%VBS_TEMP%"  # 执行VBS脚本（无窗口）

REM 4. 清理临时文件 + 退出
del /f /q "%VBS_TEMP%" >nul 2>&1
timeout /t 2 >nul
echo [INFO] 前端服务已在后台启动，可关闭当前窗口
exit /b 0