# Etapa 1: Build da SPA Angular
FROM node:22-alpine AS builder
WORKDIR /app

# Copia manifestos e instala dependências
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copia o código e compila o Angular
COPY . .
RUN npm run build:front

# Etapa 2: Servidor Nginx de Produção
FROM nginx:alpine

# Copia a configuração personalizada do Nginx (SPA + proxy reverso /api/)
COPY apps/contabilidade-front/nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos compilados estáticos do Angular
COPY --from=builder /app/dist/apps/contabilidade-front/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]