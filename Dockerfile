FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:22-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json .
EXPOSE 3000
ENV NODE_ENV=production
USER node
CMD ["node", "src/app.js"]
