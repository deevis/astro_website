@echo off
echo Generating video thumbnails...
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if FFmpeg is installed
where ffmpeg >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: FFmpeg is not installed or not in PATH
    echo Please install FFmpeg from https://ffmpeg.org/download.html
    echo.
    echo For Windows, you can:
    echo 1. Download from https://www.gyan.dev/ffmpeg/builds/
    echo 2. Extract and add to your PATH
    echo 3. Or install via chocolatey: choco install ffmpeg
    pause
    exit /b 1
)

REM Change to the project directory
cd /d "%~dp0.."

REM Run the thumbnail generation script
node scripts/generate-thumbnails.js

echo.
echo Thumbnail generation complete!
pause 