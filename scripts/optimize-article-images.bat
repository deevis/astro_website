@echo off
echo Optimizing article images...
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if ImageMagick is installed
where magick >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: ImageMagick is not installed or not in PATH
    echo Please install ImageMagick from https://imagemagick.org/script/download.php
    echo.
    echo For Windows, you can:
    echo 1. Download from https://imagemagick.org/script/download.php#windows
    echo 2. Install and make sure to check "Add to PATH" during installation
    echo 3. Or install via chocolatey: choco install imagemagick
    pause
    exit /b 1
)

REM Change to the project directory
cd /d "%~dp0.."

REM Run the image optimization script
node scripts/optimize-article-images.js

echo.
echo Article image optimization complete!
pause 