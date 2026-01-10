@echo off
chcp 65001 >nul
echo ==================================================
echo          停止 ERP System Pro 所有服务
echo ==================================================

echo.
echo [1/2] 正在查找并停止后端服务 (端口 8000)...
set backend_found=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 "') do (
    if "%%a" neq "0" (
        echo 发现后端进程 PID: %%a
        taskkill /F /PID %%a >nul 2>&1
        set backend_found=1
    )
)
if %backend_found% equ 0 echo 未发现运行在 8000 端口的服务。

echo.
echo [2/2] 正在查找并停止前端服务 (端口 5173)...
set frontend_found=0
for /f "tokens=5" %%b in ('netstat -ano ^| findstr ":5173 "') do (
    if "%%b" neq "0" (
        echo 发现前端进程 PID: %%b
        taskkill /F /PID %%b >nul 2>&1
        set frontend_found=1
    )
)
if %frontend_found% equ 0 echo 未发现运行在 5173 端口的服务。

echo.
echo [INFO] 所有相关服务已停止。
timeout /t 3 >nul
exit
