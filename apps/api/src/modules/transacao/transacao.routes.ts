import { Router } from 'express';
import { TransacaoController } from './transacao.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/parceladas', TransacaoController.listaDespesasParceladas);
router.post('/parceladas', TransacaoController.criarParcelada);
router.get('/extrato', TransacaoController.extrato);
router.post('/save', TransacaoController.saveNewUser);
router.get('/agrupadaPorTipos', TransacaoController.agrupamentoTipo);
router.get('/entradas', TransacaoController.listarEntradas);
router.get('/topago/:id', TransacaoController.receber);
router.get('/despesa', TransacaoController.listaDespesa);
router.get('/linhatemporal', TransacaoController.linhaTemporal);
router.get('/pordia', TransacaoController.buscaPorDia);

router.get('/', TransacaoController.listar);
router.post('/', TransacaoController.criar);
router.get('/:id', TransacaoController.buscar);
router.put('/:id', TransacaoController.atualizar);
router.delete('/:id', TransacaoController.excluir);

export default router;

