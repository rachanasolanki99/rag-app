# ---- Build stage: compile TypeScript -> dist ----
FROM node:20-slim AS build
WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# ---- Runtime stage: production deps only ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# The same image runs any of the three services; docker-compose sets the command.
CMD ["node", "dist/ingestion/server.js"]
