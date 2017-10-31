FROM node:latest
RUN apt-get update
RUN apt-get install -y libxcomposite1 libx11-xcb1 libxcursor1 libxdamage1 libxi6 libxtst6 libnss3 libcups2 libxss1 libxrandr2 libgconf-2-4 libasound2 libatk1.0-0 libgtk-3-common
VOLUME /app
WORKDIR /app
