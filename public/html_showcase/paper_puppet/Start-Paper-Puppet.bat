@echo off
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node server.mjs
  goto done
)
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server.py
  goto done
)
where python >nul 2>nul
if %errorlevel%==0 (
  python server.py
  goto done
)
echo This local package needs Node.js or Python 3 to serve its media files.
echo Install either one, then run this launcher again, or open your hosted copy.
:done
pause
