FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY server.js ./

RUN mkdir -p /secrets

EXPOSE 3000

CMD ["node", "server.js"]
