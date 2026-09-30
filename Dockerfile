FROM node:26-alpine

WORKDIR /app

COPY package* .

RUN npm install

COPY . .