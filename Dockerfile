FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev
FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY server ./server
COPY scripts/seed-demo.mjs ./scripts/seed-demo.mjs
COPY scripts/seed-showcase.mjs ./scripts/seed-showcase.mjs
USER node
EXPOSE 3001
CMD ["node", "server/index.js"]
