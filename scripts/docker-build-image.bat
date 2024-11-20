@echo off
docker build -t astro-website .
docker save -o astro-website.tar astro-website 
echo "scp astro-website.tar user@domain:astro-website.tar"