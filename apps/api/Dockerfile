# ==============================================================================
# Multi-stage Dockerfile para apps/api (Node.js / Express / TypeScript)
# ==============================================================================

# ------------------------------------------------------------------------------
# Estágio 1: Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências necessárias para compilação nativa se houver
RUN apk add --no-cache python3 make g++

# Copia manifestos de dependências para aproveitar cache de camadas
COPY package*.json ./

# Instala todas as dependências do monorepo
RUN npm ci

# Copia o código fonte do workspace
COPY . .

# Compila a API em modo produção (gera bundle e package.json em apps/api/dist)
RUN npx nx build api --configuration=production

# ------------------------------------------------------------------------------
# Estágio 2: Runner de Produção
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Adiciona utilitários para healthcheck
RUN apk add --no-cache curl

# Copia os artefatos compilados do estágio de build
COPY --from=builder /app/apps/api/dist ./

# Instala exclusivamente dependências de produção geradas pelo esbuild
RUN npm install --omit=dev --no-audit --no-fund

# Cria o diretório persistente para uploads de comprovantes e avatares
RUN mkdir -p /app/public/uploads

# Porta exposta da API
EXPOSE 3000

# Healthcheck do container
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Inicialização da aplicação
CMD ["node", "main.js"]
