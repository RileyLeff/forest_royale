FROM node:22-alpine

WORKDIR /app

COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci --omit=dev

COPY server/ ./server/
COPY client/ ./client/

EXPOSE 3000

CMD ["node", "server/server.js"]
