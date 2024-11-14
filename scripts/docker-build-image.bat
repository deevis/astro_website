@echo off
docker build -t astro-website .
docker save -o astro-website.tar astro-website 