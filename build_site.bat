@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py build.py
) else (
  python build.py
)
if %errorlevel% neq 0 (
  echo.
  echo Не удалось запустить Python.
  pause
  exit /b 1
)
start "" "public\index.html"
