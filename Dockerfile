FROM node:19-alpine3.16

WORKDIR /app

COPY package*.json .

RUN npm i --omit=dev

COPY . .

EXPOSE 8080

CMD npm start