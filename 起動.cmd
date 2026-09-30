@echo off
cd /d "%~dp0"
set "CAMERA_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "CAMERA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
start "" "http://localhost:8787"
"%CAMERA_NODE%" server.cjs
pause
