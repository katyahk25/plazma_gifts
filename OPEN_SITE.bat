@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 build.py
) else (
  python build.py
)

if errorlevel 1 (
  echo.
  echo Не удалось собрать сайт. Проверь, что Python установлен и доступен в PATH.
  pause
  exit /b 1
)

start "" "%~dp0public\index.html"
endlocal
