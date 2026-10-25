@echo off
rem Registers a Windows task that fetches news every day at 7:00 AM and again at 7:00 PM.
schtasks /Create /F /SC DAILY /ST 07:00 /TN "UPSC Current Affairs Morning" /TR "\"%~dp0update.bat\" quiet"
schtasks /Create /F /SC DAILY /ST 19:00 /TN "UPSC Current Affairs Evening" /TR "\"%~dp0update.bat\" quiet"
echo.
echo Done. News will now update automatically every day at 7 AM and 7 PM.
echo To remove: schtasks /Delete /TN "UPSC Current Affairs Morning" /F  (and the same for Evening)
pause
