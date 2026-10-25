@echo off
cd /d "%~dp0"
echo Fetching today's UPSC current affairs...
node fetch-news.js
if "%1"=="" (
  start "" "%~dp0index.html"
  pause
)
