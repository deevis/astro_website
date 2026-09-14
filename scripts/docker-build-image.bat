@echo off
setlocal
cd /d "%~dp0.."

if exist ".env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
    if /i "%%A"=="PUBLIC_GA_MEASUREMENT_ID" set "PUBLIC_GA_MEASUREMENT_ID=%%B"
  )
)

if "%PUBLIC_GA_MEASUREMENT_ID%"=="" (
  echo WARNING: PUBLIC_GA_MEASUREMENT_ID is not set. Google Analytics will be omitted from this image.
) else (
  echo Using PUBLIC_GA_MEASUREMENT_ID=%PUBLIC_GA_MEASUREMENT_ID%
)

docker build --build-arg PUBLIC_GA_MEASUREMENT_ID=%PUBLIC_GA_MEASUREMENT_ID% -t astro-website .
docker save -o astro-website.tar astro-website
echo "scp astro-website.tar user@domain:astro-website.tar"
