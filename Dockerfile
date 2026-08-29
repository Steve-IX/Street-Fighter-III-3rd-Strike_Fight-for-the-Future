# Railway deploys from the repository root; the app itself is in web/.
FROM node:20-alpine

WORKDIR /app

COPY web/package*.json ./
RUN npm ci --omit=dev

COPY web/ ./
COPY ROMS/ ./ROMS/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
