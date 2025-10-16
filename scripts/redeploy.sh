#!/bin/bash

# this script should live out on your prod container after you scp the tar file to it

docker stop astro-website
docker rm astro-website
docker load -i ~/astro-website.tar
docker run -d --name astro-website --network my_shared_network -p 4321:4321 astro-website:latest
docker image prune -f
