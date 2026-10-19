import { Request, Response } from 'express';
import { DashboardBusiness } from './dashboard.business';

export const DashboardController = {
  async getResumo(req: Request, res: Response): Promise<void> {
    try {
      const { mes, ano } = req.query as { mes?: string; ano?: string };
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ error: 'Usuário não autenticado' });
        return;
      }

      const mesNum = mes ? parseInt(mes, 10) : new Date().getMonth() + 1;
      const anoNum = ano ? parseInt(ano, 10) : new Date().getFullYear();

      const dados = await DashboardBusiness.calcularResumoFinanceiro(mesNum, anoNum, userid);
      res.json(dados);
    } catch (err: unknown) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao obter dados do dashboard' });
    }
  },

  async getDespesasUnificadas(req: Request, res: Response): Promise<void> {
    try {
      const { mes, ano } = req.query as { mes?: string; ano?: string };
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ error: 'Usuário não autenticado' });
        return;
      }

      const mesNum = mes ? parseInt(mes, 10) : new Date().getMonth() + 1;
      const anoNum = ano ? parseInt(ano, 10) : new Date().getFullYear();

      const despesas = await DashboardBusiness.listarDespesasUnificadas(mesNum, anoNum, userid);
      res.json(despesas);
    } catch (err: unknown) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao listar despesas do dashboard' });
    }
  },

  async getTransacoesFiltradas(req: Request, res: Response): Promise<void> {
    try {
      const { tipo, status, mes, ano } = req.query as {
        tipo?: string;
        status?: string;
        mes?: string;
        ano?: string;
      };
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ error: 'Usuário não autenticado' });
        return;
      }

      if (mes || ano) {
        const mesNum = mes ? parseInt(mes, 10) : new Date().getMonth() + 1;
        const anoNum = ano ? parseInt(ano, 10) : new Date().getFullYear();
        const despesas = await DashboardBusiness.listarDespesasUnificadas(mesNum, anoNum, userid);
        res.json(despesas);
        return;
      }

      const transacoes = await DashboardBusiness.filtrarTransacoes(tipo, status, userid);
      res.json(transacoes);
    } catch (err: unknown) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao filtrar transações' });
    }
  },

  async buscaProjecao(req: Request, res: Response): Promise<void> {
    try {
      const { ano } = req.query as { ano?: string };
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ error: 'Usuário não autenticado' });
        return;
      }

      const anoValido = ano || String(new Date().getFullYear());
      const projecao = await DashboardBusiness.buscaProjecao(anoValido, userid);
      res.json(projecao);
    } catch (err: unknown) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao buscar projecao' });
    }
  },

  async buscaAgrupamentoCategoria(req: Request, res: Response): Promise<void> {
    try {
      const { ano } = req.query as { ano?: string };
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ error: 'Usuário não autenticado' });
        return;
      }

      const anoValido = ano || String(new Date().getFullYear());
      const agrupamento = await DashboardBusiness.getAgrupamentoCategorias(anoValido, userid);
      res.json(agrupamento);
    } catch (err: unknown) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao buscar agrupamento de categorias' });
    }
  },
};
