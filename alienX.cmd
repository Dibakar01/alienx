@echo off
rem Double-click this in File Explorer to open alienX. The first time, it sets everything up.
cd /d "%~dp0"
if not exist node_modules goto setup
if not exist .env goto setup
goto open
:setup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1"
if errorlevel 1 (
  echo.
  echo Something is missing ^(see above^).
  pause
  exit /b 1
)
:open
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open.ps1"
if errorlevel 1 pause
