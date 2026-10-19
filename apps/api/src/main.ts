import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { ENV } from './core/config/env';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import categoriaRoutes from './modules/categoria/categoria.routes';
import subcategoriaRoutes from './modules/subcategoria/subcategoria.routes';
import cartaoRoutes from './modules/cartao/cartao.routes';
import planejamentoRoutes from './modules/planejamento/planejamento.routes';
import objetivosRoutes from './modules/objetivos/objetivos.routes';
import transacaoRoutes from './modules/transacao/transacao.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import aiRoutes from './modules/ai/ai.routes';
import loanRoutes from './modules/loan/loan.routes';
import cardRoutes from './modules/card/card.routes';
import plannedTransactionRoutes from './modules/planned-transaction/planned-transaction.routes';
import forecastRoutes from './modules/forecast/forecast.routes';
import { setupSwagger } from './core/swagger/swagger.setup';

const app = express();

// Configura documentação interativa Swagger/OpenAPI
setupSwagger(app);

// Garante pasta pública de uploads
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuração CORS
const configuredOrigins = ENV.CORS_ORIGINS
  ? ENV.CORS_ORIGINS.split(',').map((o) => o.trim())
  : [];

const defaultAllowedOrigins = [
  'http://localhost:4200',
  'http://localhost:3000',
  'http://localhost:8100',
  'https://gerenciamento-one.vercel.app',
  'https://novasapi.vercel.app',
  ...configuredOrigins,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (ex: mobile apps nativos, curl, postman, same-origin)
      if (!origin) {
        return callback(null, true);
      }

      // Permite localhost, 127.0.0.1, Capacitor/Ionic nativo e IPs da rede local
      const isLocalOrLan =
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('capacitor://') ||
        origin.startsWith('ionic://') ||
        /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin);

      if (isLocalOrLan || defaultAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, true); // Permite desenvolvimento e integrações flexíveis
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Arquivos estáticos de uploads
app.use('/uploads', express.static(uploadsDir));

// Healthcheck e rota raiz
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Contabilidade API',
    version: '2.0.0',
    status: 'online',
    docs: '/docs',
    swagger: '/docs',
    specJson: '/docs/json',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/docs',
      '/api/docs',
      '/docs/json',
      '/auth',
      '/auth/login',
      '/auth/register',
      '/api/auth/register',
      '/user',
      '/categorias',
      '/subcategorias',
      '/cartao',
      '/planejamento',
      '/objetivos',
      '/transacoes',
      '/dashboard',
      '/ai',
      '/loans',
      '/cards',
      '/planned-transactions',
      '/api/planned-transactions',
      '/forecast',
      '/api/forecast',
    ],
  });
});

// Registra rotas na raiz (compatibilidade legado)
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/categorias', categoriaRoutes);
app.use('/subcategorias', subcategoriaRoutes);
app.use('/cartao', cartaoRoutes);
app.use('/planejamento', planejamentoRoutes);
app.use('/objetivos', objetivosRoutes);
app.use('/transacoes', transacaoRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/ai', aiRoutes);
app.use('/loans', loanRoutes);
app.use('/cards', cardRoutes);
app.use('/planned-transactions', plannedTransactionRoutes);
app.use('/forecast', forecastRoutes);

// Registra rotas também sob prefixo /api (moderno)
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/subcategorias', subcategoriaRoutes);
app.use('/api/cartao', cartaoRoutes);
app.use('/api/planejamento', planejamentoRoutes);
app.use('/api/objetivos', objetivosRoutes);
app.use('/api/transacoes', transacaoRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/planned-transactions', plannedTransactionRoutes);
app.use('/api/forecast', forecastRoutes);

// Middleware de tratamento global de erros
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]:', err);
  const message = err instanceof Error ? err.message : 'Erro interno do servidor';
  res.status(500).json({
    success: false,
    error: message,
    erro: message,
  });
});

const port = ENV.PORT;
const host = ENV.HOST;

app.listen(port, host, () => {
  console.log(`[ Contabilidade API ] Rodando em http://${host}:${port}`);
  console.log(`[ Swagger Docs ] Disponível em http://${host}:${port}/docs`);
});

export default app;
