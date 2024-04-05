FROM node:21.7.1-alpine3.18

WORKDIR /app

COPY package*.json .

RUN npm i --omit=dev

COPY . .

EXPOSE 8080

CMD npm start