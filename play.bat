@echo off
rem Starts the little local server and opens the game in your browser. Close this window to stop.
start "" http://localhost:8765/
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
