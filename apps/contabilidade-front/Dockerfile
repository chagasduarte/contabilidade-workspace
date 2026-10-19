# ==============================================================================
# Multi-stage Dockerfile para apps/contabilidade-front (Angular / Ionic SPA)
# ==============================================================================

# ------------------------------------------------------------------------------
# Estágio 1: Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Instala ferramentas necessárias para dependências nativas se houver
RUN apk add --no-cache python3 make g++

# Copia manifestos de dependências para aproveitar cache de camadas
COPY package*.json ./

# Instala todas as dependências do monorepo
RUN npm ci

# Copia o código fonte do workspace
COPY . .

# Compila o frontend Angular em modo produção
# O output é gerado em dist/apps/contabilidade-front/browser
RUN npx nx build contabilidade-front --configuration=production

# ------------------------------------------------------------------------------
# Estágio 2: Nginx Web Server
# ------------------------------------------------------------------------------
FROM nginx:alpine AS runner

# Remove arquivos estáticos padrão do Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copia os artefatos compilados do Angular para o diretório raiz do Nginx
COPY --from=builder /app/dist/apps/contabilidade-front/browser /usr/share/nginx/html

# Copia a configuração customizada do Nginx com suporte a SPA e Proxy reverso
COPY apps/contabilidade-front/nginx.conf /etc/nginx/conf.d/default.conf

# Porta HTTP
EXPOSE 80

# Healthcheck do container
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

# Inicializa o Nginx em primeiro plano
CMD ["nginx", "-g", "daemon off;"]

