@echo off
echo ====================================
echo   啟動本地HTTP服務器
echo ====================================
echo.
echo 正在啟動服務器...
echo 服務器地址: http://localhost:8000
echo.
echo 按 Ctrl+C 停止服務器
echo ====================================
echo.

python -m http.server 8000

pause
