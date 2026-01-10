@echo off
chcp 65001 >nul
echo ==================================================
echo          ERP System Pro 服务状态检查
echo ==================================================

echo.
echo [检查后端] 端口 8000:
netstat -ano | findstr ":8000 " >nul
if %errorlevel% equ 0 (
    echo [√] 正常 - API 服务正在运行
) else (
    echo [X] 异常 - 未检测到 API 服务
)

echo.
echo [检查前端] 端口 5173:
netstat -ano | findstr ":5173 " >nul
if %errorlevel% equ 0 (
    echo [√] 正常 - 页面服务正在运行
) else (
    echo [X] 异常 - 未检测到前端服务
)

echo.
echo ==================================================
pause
