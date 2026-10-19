// swagger.setup.ts
// Configuração do Swagger UI e endpoints de documentação OpenAPI

import { Express, Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './swagger.config';

export function setupSwagger(app: Express): void {
  // 1. Redirecionamento com trailing slash para garantir carregamento correto dos assets do Swagger UI
  app.get('/docs', (req: Request, res: Response, next: NextFunction) => {
    if (!req.originalUrl.endsWith('/')) {
      const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      return res.redirect(301, `/docs/${query}`);
    }
    next();
  });

  app.get('/api/docs', (req: Request, res: Response, next: NextFunction) => {
    if (!req.originalUrl.endsWith('/')) {
      const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      return res.redirect(301, `/api/docs/${query}`);
    }
    next();
  });

  // 2. Endpoint para exportação da especificação OpenAPI em formato JSON bruto
  app.get(['/docs/json', '/api/docs/json', '/api-docs.json'], (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerDocument);
  });

  // 3. Opções visuais e de comportamento do Swagger UI
  const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
    customSiteTitle: 'Contabilidade API - Swagger Docs',
    customCss: `
      .swagger-ui .topbar {
        background-color: #0f172a;
        padding: 10px 0;
      }
      .swagger-ui .topbar .topbar-wrapper a span {
        color: #f8fafc;
        font-weight: 700;
        font-size: 1.1rem;
      }
      .swagger-ui .info {
        margin: 25px 0;
      }
      .swagger-ui .info .title {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #0f172a;
        font-weight: 800;
      }
      .swagger-ui .opblock.opblock-post {
        border-color: #10b981;
        background: rgba(16, 185, 129, 0.05);
      }
      .swagger-ui .opblock.opblock-get {
        border-color: #3b82f6;
        background: rgba(59, 130, 246, 0.05);
      }
      .swagger-ui .opblock.opblock-put {
        border-color: #f59e0b;
        background: rgba(245, 158, 11, 0.05);
      }
      .swagger-ui .opblock.opblock-delete {
        border-color: #ef4444;
        background: rgba(239, 68, 68, 0.05);
      }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      docExpansion: 'none',
      defaultModelsExpandDepth: 2,
      tryItOutEnabled: true,
    },
  };

  // 4. Montagem do Swagger UI tanto em /docs quanto em /api/docs
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerUiOptions));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerUiOptions));

  console.log('[ Swagger ] Documentação ativa em /docs e /api/docs');
}
