# Etapa 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npx nx build api --configuration=production

# Etapa 2: Runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /app/dist/apps/api ./dist/apps/api
COPY --from=builder /app/apps/api/src ./apps/api/src

EXPOSE 3000

CMD ["node", "dist/apps/api/main.js"]