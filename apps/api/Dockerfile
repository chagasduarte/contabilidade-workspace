# Etapa 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Copia manifestos de dependência
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copia código-fonte e compila a API via Nx
COPY . .
RUN npx nx build api --configuration=production

# Etapa 2: Runner de Produção
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copia os node_modules resolvidos no builder para evitar falta de pacotes (como cors)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copia o build gerado em apps/api/dist e os fontes necessários
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/src ./apps/api/src

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]