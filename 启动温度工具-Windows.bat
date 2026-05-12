@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "SCRIPT=%PROJECT_DIR%tools\serve-web.ps1"

if not exist "%SCRIPT%" (
  echo Missing script: %SCRIPT%
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -ProjectDir "%PROJECT_DIR%"

