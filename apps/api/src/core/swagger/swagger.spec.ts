import { describe, it, expect } from 'vitest';
import express from 'express';
import { setupSwagger } from './swagger.setup';
import { swaggerDocument } from './swagger.config';

describe('Swagger / OpenAPI Configuration', () => {
  it('should have valid OpenAPI 3.0 structure', () => {
    expect(swaggerDocument.openapi).toBe('3.0.3');
    expect(swaggerDocument.info.title).toBe('Contabilidade API');
    expect(swaggerDocument.info.version).toBe('2.0.0');
    expect(swaggerDocument.paths).toBeDefined();
    expect(swaggerDocument.components).toBeDefined();
  });

  it('should define JWT bearer authentication in securitySchemes', () => {
    const bearer = swaggerDocument.components.securitySchemes.bearerAuth;
    expect(bearer).toBeDefined();
    expect(bearer.type).toBe('http');
    expect(bearer.scheme).toBe('bearer');
    expect(bearer.bearerFormat).toBe('JWT');
  });

  it('should contain all major application modules in paths', () => {
    const paths = Object.keys(swaggerDocument.paths);

    // Módulos essenciais
    expect(paths).toContain('/auth/login');
    expect(paths).toContain('/user');
    expect(paths).toContain('/cards');
    expect(paths).toContain('/cards/transacoes');
    expect(paths).toContain('/cards/faturas/{faturaId}/pagar');
    expect(paths).toContain('/loans');
    expect(paths).toContain('/loans/pagamentos');
    expect(paths).toContain('/loans/{id}/resumo');
    expect(paths).toContain('/transacoes');
    expect(paths).toContain('/dashboard/resumo');
    expect(paths).toContain('/categorias');
    expect(paths).toContain('/subcategorias');
    expect(paths).toContain('/planejamento');
    expect(paths).toContain('/objetivos');
    expect(paths).toContain('/ai/chat');
    expect(paths).toContain('/cartao');
  });

  it('should define key schemas in components.schemas', () => {
    const schemas = swaggerDocument.components.schemas;

    expect(schemas.User).toBeDefined();
    expect(schemas.CreditCard).toBeDefined();
    expect(schemas.CreateCardDto).toBeDefined();
    expect(schemas.CardInvoice).toBeDefined();
    expect(schemas.CardTransaction).toBeDefined();
    expect(schemas.InvoiceItem).toBeDefined();
    expect(schemas.Loan).toBeDefined();
    expect(schemas.LoanInstallment).toBeDefined();
    expect(schemas.LoanPayment).toBeDefined();
    expect(schemas.Transacao).toBeDefined();
    expect(schemas.DashboardResumo).toBeDefined();
  });

  it('should attach swagger routes to express application without throwing', () => {
    const app = express();
    expect(() => setupSwagger(app)).not.toThrow();
  });
});

