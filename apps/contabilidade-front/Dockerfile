# Etapa 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npx nx build contabilidade-front --configuration=production

# Etapa 2: Servir via Nginx
FROM nginx:alpine
COPY apps/contabilidade-front/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/apps/contabilidade-front/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]