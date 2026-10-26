// Bateria E2E da API contra um ambiente LOCAL (API rodando + Postgres local).
// Uso: npx nx run api:e2e-local   (veja apps/api/e2e/README.md)
//
// Segurança (o script recusa rodar antes de criar qualquer dado):
//   - banco e API precisam estar em host local (localhost/127.0.0.1/::1);
//   - a porta do banco não pode ser 5432 (nesta máquina, 5432 é um túnel para um Postgres REAL);
//   - a API precisa estar usando o MESMO banco informado (verificado com um usuário-sonda).
// Usa só usuários próprios (prefixo be_e2e_) e remove apenas o que criou.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pg = require('pg');
const dotenv = require('dotenv');

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: path.join(RAIZ, '.env') });

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const PREFIXO = 'be_e2e_';

function abortar(msg) {
  console.error(`\n[e2e] RECUSADO: ${msg}\n`);
  process.exit(2);
}

/** URL do banco: E2E_DATABASE_URL ou montada a partir de DB_* do .env da raiz. */
function urlDoBanco() {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const { DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME } = process.env;
  if (!DB_HOST || !DB_PORT || !DB_USER || !DB_NAME) {
    abortar('defina E2E_DATABASE_URL (postgres://usuario:senha@localhost:5433/contabilidade) ou DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME no .env da raiz.');
  }
  const cred = `${encodeURIComponent(DB_USER)}${DB_PASS ? `:${encodeURIComponent(DB_PASS)}` : ''}`;
  return `postgres://${cred}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
}

const API = (process.env.E2E_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const DB_URL = urlDoBanco();

// Travas de ambiente: nada é criado antes delas.
{
  let db;
  let api;
  try {
    db = new URL(DB_URL);
    api = new URL(API);
  } catch {
    abortar('E2E_DATABASE_URL ou E2E_API_URL inválida.');
  }
  const dbHost = db.hostname.toLowerCase();
  const dbPort = Number(db.port || 5432);
  if (!HOSTS_LOCAIS.has(dbHost)) abortar(`host do banco '${dbHost}' não é local. O E2E só roda contra banco local.`);
  if (dbPort === 5432) {
    abortar('porta do banco 5432. Nesta máquina a 5432 é um túnel para um Postgres REAL; use o container local (ex.: 5433).');
  }
  if (!HOSTS_LOCAIS.has(api.hostname.toLowerCase())) abortar(`API '${api.hostname}' não é local.`);
  console.log(`[e2e] API ${API} | banco ${dbHost}:${dbPort}${db.pathname}`);
}

const pool = new pg.Pool({ connectionString: DB_URL, max: 2, ssl: false });
const SFX = Date.now().toString(36);
let falhas = 0;
let total = 0;
const ok = (cond, msg, extra) => {
  total++;
  console.log(cond ? '  ✓' : '  ✗', msg, cond || extra === undefined ? '' : JSON.stringify(extra));
  if (!cond) falhas++;
};
const secao = (t) => console.log(`\n${t}`);

/** SQL direto no banco local (conferências e limpeza). Linhas como arrays de valores. */
async function sql(q, params = []) {
  const r = await pool.query({ text: q, values: params, rowMode: 'array' });
  return r.rows;
}

async function req(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json, headers: res.headers };
}

const criados = { usuarios: [], categoriaGlobal: null };

async function registrar(nome) {
  const r = await req('POST', '/auth/register', null, { nome, email: `${nome}@teste.local`, senha: 'senha1234' });
  if (r.status !== 201) throw new Error(`registro ${nome}: ${r.status} ${JSON.stringify(r.body)}`);
  criados.usuarios.push(r.body.usuario.id);
  return { id: r.body.usuario.id, token: r.body.token, nome };
}

const hoje = new Date();
const mesAtual = hoje.getMonth() + 1;
const anoAtual = hoje.getFullYear();
const iso = (d) => d.toISOString().slice(0, 10);
const diaDoMes = (dia) => `${anoAtual}-${String(mesAtual).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

async function main() {
  const A = await registrar(`${PREFIXO}ana_${SFX}`);
  // A API precisa estar usando o mesmo banco: senão a limpeza não alcançaria o que foi criado
  const sonda = await sql('SELECT nome FROM usuarios WHERE id = $1', [A.id]).catch(() => []);
  if (!sonda.length || sonda[0][0] !== A.nome) {
    criados.usuarios = [];
    abortar(`a API ${API} NÃO usa o banco informado (usuário ${A.nome}, id ${A.id}, não existe nele). Remova-o pelo banco da API.`);
  }
  const B = await registrar(`${PREFIXO}bia_${SFX}`);
  console.log(`usuários: A=${A.id} B=${B.id} (sufixo ${SFX})`);

  // ---------------------------------------------------------------- auth
  secao('Auth');
  ok((await req('GET', '/transacoes/extrato', 'token-invalido')).status === 401, 'token inválido -> 401 (não 403)');
  ok((await req('GET', '/categorias', null)).status === 401, '/categorias sem token -> 401');
  const lg = await req('POST', '/auth/login', null, { nome: A.nome, senha: 'errada' });
  ok(lg.status === 401 && lg.body.erro === 'Usuário ou senha inválidos', 'login: mensagem genérica', lg.body);

  // ---------------------------------------------------------------- categorias
  secao('Categorias por usuário');
  const catA = (await req('POST', '/categorias', A.token, { nome: 'Casa BE', tipo: 'despesa' })).body;
  ok(catA.userid === A.id, 'categoria criada com userid do dono', catA);
  const subA = (await req('POST', '/subcategorias', A.token, { idcategoria: catA.id, nome: 'Luz BE' })).body;
  ok(subA.userid === A.id, 'subcategoria do dono', subA);
  ok((await req('GET', `/categorias/${catA.id}`, B.token)).status === 404, 'B não vê categoria de A (404)');
  ok((await req('PUT', `/categorias/${catA.id}`, B.token, { nome: 'x' })).status === 404, 'B não edita categoria de A (404)');
  ok((await req('DELETE', `/categorias/${catA.id}`, B.token)).status === 404, 'B não exclui categoria de A (404)');
  ok(!(await req('GET', '/categorias', B.token)).body.some((c) => c.id === catA.id), 'listagem de B não traz a de A');
  const dup = await req('POST', '/categorias', A.token, { nome: ' casa be ', tipo: 'despesa' });
  ok(dup.status === 409, 'nome duplicado (case/trim) -> 409', dup);
  const gid = Number((await sql(`INSERT INTO categoria (nome, tipo) VALUES ('BE-Global-${SFX}', 'despesa') RETURNING id`))[0][0]);
  criados.categoriaGlobal = gid;
  ok((await req('PUT', `/categorias/${gid}`, A.token, { nome: 'hack' })).status === 403, 'PUT em categoria global -> 403');
  ok((await req('DELETE', `/categorias/${gid}`, A.token)).status === 403, 'DELETE em categoria global -> 403');
  ok((await req('GET', '/categorias', B.token)).body.some((c) => c.id === gid), 'global visível a todos');

  // ---------------------------------------------------------------- transações
  secao('Transações: IDOR, posse de categoria, subcategoria, nomes');
  const t1 = await req('POST', '/transacoes', A.token, {
    tipo: 'saida', descricao: 'Conta de luz', valor: 120.5, data: diaDoMes(5), idcategoria: catA.id, idsubcategoria: subA.id,
  });
  ok(t1.status === 201 && t1.body.subcategoria_nome === 'Luz BE' && t1.body.categoria_nome === 'Casa BE', 'POST com idsubcategoria + nomes', t1.body);
  ok((await req('PUT', `/transacoes/${t1.body.id}`, B.token, { descricao: 'hack' })).status === 404, 'B não atualiza transação de A');
  ok((await req('DELETE', `/transacoes/${t1.body.id}`, B.token)).status === 404, 'B não exclui transação de A');
  ok((await req('GET', `/transacoes/topago/${t1.body.id}`, B.token)).status === 404, 'B não marca transação de A como paga');
  ok((await sql(`SELECT status FROM transacoes WHERE id = ${t1.body.id}`))[0][0] === 'pendente', 'transação de A intacta no banco');
  const tB = await req('POST', '/transacoes', B.token, { tipo: 'saida', descricao: 'x', valor: 1, data: diaDoMes(5), idcategoria: catA.id });
  ok(tB.status === 400 && /Categoria não encontrada/.test(tB.body.erro), 'B não usa categoria de A (400)', tB.body);
  const tSub = await req('POST', '/transacoes', A.token, { tipo: 'saida', descricao: 'x', valor: 1, data: diaDoMes(5), idcategoria: gid, idsubcategoria: subA.id });
  ok(tSub.status === 400, 'idsubcategoria de outra categoria -> 400', tSub.body);
  const tLeg = await req('POST', '/transacoes', A.token, { tipo: 'saida', descricao: 'Legado', valor: 2, data: diaDoMes(6), idcategoria: catA.id, categoria: 999999 });
  ok(tLeg.status === 201 && tLeg.body.idsubcategoria === null, 'categoria legado inválido é ignorado (sem erro)', tLeg.body);

  // ---------------------------------------------------------------- extrato
  secao('Extrato: paginação keyset + totais');
  for (let i = 0; i < 5; i++) {
    await req('POST', '/transacoes', A.token, { tipo: i % 2 ? 'entrada' : 'saida', descricao: `Ext ${i}`, valor: 10 + i, data: diaDoMes(10 + i), idcategoria: catA.id });
  }
  const completo = (await req('GET', `/transacoes/extrato?mes=${mesAtual}&ano=${anoAtual}`, A.token)).body;
  ok(Array.isArray(completo) && completo.length >= 7, `sem paginação continua array (${completo.length})`);
  const p1 = await req('GET', `/transacoes/extrato?mes=${mesAtual}&ano=${anoAtual}&paginado=true&limit=3`, A.token);
  const esperado = {
    entradas: completo.filter((i) => i.tipo === 'entrada').reduce((a, i) => a + Number(i.valor), 0),
    saidas: completo.filter((i) => i.tipo !== 'entrada').reduce((a, i) => a + Number(i.valor), 0),
    pendentes: completo.filter((i) => i.status === 'pendente').length,
  };
  ok(p1.body.items.length === 3 && p1.body.next_cursor && p1.headers.get('x-next-cursor') === p1.body.next_cursor, 'página 1 + header X-Next-Cursor');
  ok(Math.abs(p1.body.totais.entradas - esperado.entradas) < 0.001 && Math.abs(p1.body.totais.saidas - esperado.saidas) < 0.001 && p1.body.totais.pendentes === esperado.pendentes,
    'totais = mês inteiro', { recebido: p1.body.totais, esperado });
  const vistos = [...p1.body.items];
  let cur = p1.body.next_cursor;
  while (cur) {
    const p = await req('GET', `/transacoes/extrato?mes=${mesAtual}&ano=${anoAtual}&cursor=${encodeURIComponent(cur)}&limit=3`, A.token);
    ok(!('totais' in p.body), 'páginas seguintes sem totais');
    vistos.push(...p.body.items);
    cur = p.body.next_cursor;
  }
  ok(JSON.stringify(vistos.map((i) => i.id)) === JSON.stringify(completo.map((i) => i.id)), 'percorrer páginas = extrato completo (sem repetir/pular)');
  ok((await req('GET', '/transacoes/extrato?cursor=lixo', A.token)).status === 400, 'cursor inválido -> 400');

  // ---------------------------------------------------------------- parceladas
  secao('Parceladas: sem vazamento entre usuários');
  const parc = await req('POST', '/transacoes/parceladas', A.token, { descricao: 'Sofa BE', valor: 300, data: diaDoMes(3), parcelado: true, idcategoria: catA.id, parcelas: { QtdParcelas: 3, Valor: 100 } });
  ok(parc.status === 201 && parc.body.length === 3 && new Set(parc.body.map((p) => p.parcela_grupo_id)).size === 1, 'lote atômico com grupo', parc.body?.length);
  await req('POST', '/transacoes/parceladas', B.token, { descricao: 'Sofa BE', valor: 999, data: diaDoMes(3), parcelado: true, parcelas: { QtdParcelas: 1, Valor: 999 } });
  const lp = (await req('GET', `/transacoes/parceladas?mes=${mesAtual}&ano=${anoAtual}`, A.token)).body;
  const sofa = lp.parcelas.find((p) => p.descricao === 'Sofa BE - Parcela');
  ok(sofa && Number(sofa.total_parcelado) === 300 && Number(sofa.qtd_parcelas) === 3, 'A não vê as 999 de B', sofa);
  ok((await req('POST', '/transacoes/parceladas', A.token, { descricao: 'x', valor: 100, data: diaDoMes(3), parcelado: true, parcelas: { QtdParcelas: 1000, Valor: 0.1 } })).status === 400, 'QtdParcelas absurdo -> 400');

  // ---------------------------------------------------------------- planned + settle
  secao('Planned transactions + settle + paginação');
  const pt = (await req('POST', '/planned-transactions', A.token, { descricao: 'Freela BE', tipo: 'RECEITA', valor: 900, data_prevista: diaDoMes(20), idcategoria: catA.id })).body;
  ok(pt.categoria_nome === 'Casa BE', 'planned com categoria_nome', pt);
  ok((await req('POST', `/planned-transactions/${pt.id}/settle`, B.token, {})).status === 404, 'B não efetiva planned de A');
  const st = await req('POST', `/planned-transactions/${pt.id}/settle`, A.token, {});
  ok(st.status === 200 && st.body.transacao.tipo === 'entrada' && st.body.transacao.categoria === null, 'settle: tipo entrada, categoria legado null', st.body);
  ok((await req('POST', `/planned-transactions/${pt.id}/settle`, A.token, {})).status === 409, 'segundo settle -> 409');
  for (let i = 0; i < 3; i++) await req('POST', '/planned-transactions', A.token, { descricao: `PT ${i}`, tipo: 'DESPESA', valor: 10, data_prevista: diaDoMes(21) });
  const ptAll = (await req('GET', '/planned-transactions', A.token)).body;
  let ptCur = null; const ptPag = [];
  do {
    const r = await req('GET', `/planned-transactions?paginado=true&limit=2${ptCur ? `&cursor=${encodeURIComponent(ptCur)}` : ''}`, A.token);
    ptPag.push(...r.body.items); ptCur = r.body.next_cursor;
  } while (ptCur);
  ok(JSON.stringify(ptPag.map((i) => i.id)) === JSON.stringify(ptAll.map((i) => i.id)), `planned paginado = completo (${ptAll.length})`);

  // ---------------------------------------------------------------- loans + forecast
  secao('Loans: IDOR + settle + forecast');
  const venc = new Date(Date.UTC(anoAtual, mesAtual, 10)); // próximo mês, dia 10
  const loan = await req('POST', '/loans', A.token, { institution_name: 'Banco BE', principal_amount: 1000, monthly_interest_rate: 0.02, total_installments: 3, installment_amount: 346.75, first_due_date: iso(venc), user_id: 'forjado-999' });
  ok(loan.status === 201, 'loan criado (user_id do body ignorado)', loan.body);
  const loanId = loan.body.emprestimo.id;
  ok((await req('GET', `/loans/${loanId}`, B.token)).status === 404, 'B não vê loan de A');
  const parcela1 = loan.body.parcelas[0];
  const pagB = await req('POST', '/loans/pagamentos', B.token, { loan_id: loanId, installment_id: parcela1.id, amount_paid: Number(parcela1.original_amount), payment_method: 'PIX' });
  ok(pagB.status === 404, 'B não paga loan de A', pagB.body);
  ok((await req('POST', `/loans/installments/${parcela1.id}/settle`, B.token, {})).status === 404, 'B não liquida parcela de A');
  const fc = (await req('GET', '/forecast?months=3', A.token)).body;
  ok(fc.events.some((e) => e.origin === 'LOAN'), 'forecast enxerga o empréstimo', fc.events?.map((e) => e.origin));
  ok(fc.events.every((e) => 'categoria_nome' in e), 'forecast: eventos com categoria_nome');
  const stl = await req('POST', `/loans/installments/${parcela1.id}/settle`, A.token, {});
  ok(stl.status === 200 && stl.body.transacao.tipo === 'saida', 'dono liquida parcela: tipo saida', stl.body);
  const loansPag = await req('GET', '/loans?paginado=true&limit=1', A.token);
  ok(Array.isArray(loansPag.body.items) && loansPag.body.items.length === 1, 'loans paginado');

  // ---------------------------------------------------------------- cartão: concorrência real
  secao('Cartão: FOR UPDATE com requisições paralelas (concorrência real)');
  const card = (await req('POST', '/cards', A.token, { nome: `Cartao BE ${SFX}`, limite_total: 1000, dia_fechamento: 25, dia_vencimento: 5 })).body;
  const N = 12; // 12 compras de 200 num limite de 1000: só 5 podem passar
  const compras = await Promise.all(
    Array.from({ length: N }, (_, i) =>
      req('POST', '/cards/transacoes', A.token, { cartao_id: card.id, descricao: `Compra paralela ${i}`, valor_total: 200, quantidade_parcelas: 1, data_compra: diaDoMes(2), categoria_id: catA.id })
    )
  );
  const aprovadas = compras.filter((r) => r.status === 201).length;
  const recusadas = compras.filter((r) => r.status === 400 && /Limite disponível insuficiente/.test(r.body.erro)).length;
  ok(aprovadas === 5 && recusadas === N - 5, `paralelo: ${aprovadas} aprovadas / ${recusadas} recusadas (esperado 5/${N - 5})`, compras.map((r) => r.status));
  const comprometido = Number((await sql(`SELECT COALESCE(SUM(ii.valor_parcela),0) FROM invoice_items ii JOIN card_invoices ci ON ci.id = ii.fatura_id WHERE ci.cartao_id = '${card.id}' AND ci.status <> 'PAID'`))[0][0]);
  ok(comprometido === 1000, `banco: comprometido = ${comprometido} (nunca acima do limite)`);
  const det = (await req('GET', `/cards/${card.id}`, A.token)).body;
  ok(Number(det.limite_disponivel) === 0, 'GET /cards/:id: disponível 0', det.limite_disponivel);
  ok((await req('POST', '/cards/transacoes', B.token, { cartao_id: card.id, descricao: 'x', valor_total: 1, quantidade_parcelas: 1 })).status === 404, 'B não compra no cartão de A');
  const cartB = await req('POST', '/cards/transacoes', A.token, { cartao_id: card.id, descricao: 'x', valor_total: 1, quantidade_parcelas: 1, categoria_id: 999999 });
  ok(cartB.status === 400 && /Categoria/.test(cartB.body.erro), 'categoria_id inexistente/alheia -> 400');

  // ---------------------------------------------------------------- objetivos: concorrência real
  secao('Objetivos: aportes simultâneos (concorrência real)');
  const obj = (await req('POST', '/objetivos', A.token, { nome: 'Viagem BE', tipo: 'viagem', valor_objetivo: 10000, data_final: `${anoAtual + 1}-12-31` })).body;
  const M = 25;
  const aps = await Promise.all(Array.from({ length: M }, () => req('POST', `/objetivos/${obj.id}/aportes`, A.token, { valor: 10.1 })));
  ok(aps.every((r) => r.status === 200), `${M} aportes paralelos: todos 200`, aps.map((r) => r.status));
  const acumulado = Number((await sql(`SELECT valor_acumulado FROM objetivos WHERE id = ${obj.id}`))[0][0]);
  ok(Math.abs(acumulado - M * 10.1) < 0.001, `banco: acumulado = ${acumulado} (esperado ${(M * 10.1).toFixed(2)}, nenhum aporte perdido)`);
  // Demonstração do problema do fluxo antigo (ler + PUT), no mesmo cenário
  const obj2 = (await req('POST', '/objetivos', A.token, { nome: 'Antigo BE', tipo: 'teste', valor_objetivo: 10000, data_final: `${anoAtual + 1}-12-31` })).body;
  await Promise.all(Array.from({ length: M }, async () => {
    const atual = (await req('GET', `/objetivos/${obj2.id}`, A.token)).body.valor_acumulado;
    await req('PUT', `/objetivos/${obj2.id}`, A.token, { valor_acumulado: Number((atual + 10.1).toFixed(2)) });
  }));
  const acumulado2 = Number((await sql(`SELECT valor_acumulado FROM objetivos WHERE id = ${obj2.id}`))[0][0]);
  console.log(`    (referência) fluxo antigo ler+PUT com ${M} paralelos: ${acumulado2} de ${(M * 10.1).toFixed(2)} → ${acumulado2 < M * 10.1 - 0.001 ? 'PERDEU aportes' : 'não perdeu desta vez'}`);
  ok((await req('POST', `/objetivos/${obj.id}/aportes`, B.token, { valor: 1 })).status === 404, 'B não aporta no objetivo de A');
  ok((await req('GET', `/objetivos/${obj.id}`, B.token)).status === 404, 'B não vê objetivo de A');

  // ---------------------------------------------------------------- planejamento
  secao('Planejamento + resumo');
  const pl = await req('POST', '/planejamento', A.token, { categoriaid: catA.id, valor: 2000, data: diaDoMes(1), categoria: 'forjado' });
  ok(pl.status === 201 && pl.body.categoria === 'Casa BE' && pl.body.valor === 2000, 'nome vem do banco, valor number', pl.body);
  ok((await req('POST', '/planejamento', B.token, { categoriaid: catA.id, valor: 1, data: diaDoMes(1) })).status === 400, 'B não planeja na categoria de A');
  ok((await req('GET', `/planejamento/${pl.body.id}`, B.token)).status === 404, 'B não vê planejamento de A (404)');
  const rs = (await req('GET', `/planejamento/resumo?mes=${mesAtual}&ano=${anoAtual}`, A.token)).body;
  const linha = rs.categorias.find((c) => c.idcategoria === catA.id);
  // realizado esperado direto do banco (conta por competência + cartão das faturas do mês)
  const contaPago = Number((await sql(`SELECT COALESCE(SUM(valor),0) FROM transacoes WHERE userid=${A.id} AND idcategoria=${catA.id} AND tipo IN ('saida','cartao') AND status='pago' AND (CASE WHEN cartaoid IS NOT NULL THEN pagamento ELSE data END) >= make_date(${anoAtual},${mesAtual},1) AND (CASE WHEN cartaoid IS NOT NULL THEN pagamento ELSE data END) < (make_date(${anoAtual},${mesAtual},1) + interval '1 month')::date`))[0][0]);
  const contaPend = Number((await sql(`SELECT COALESCE(SUM(valor),0) FROM transacoes WHERE userid=${A.id} AND idcategoria=${catA.id} AND tipo IN ('saida','cartao') AND status<>'pago' AND (CASE WHEN cartaoid IS NOT NULL THEN pagamento ELSE data END) >= make_date(${anoAtual},${mesAtual},1) AND (CASE WHEN cartaoid IS NOT NULL THEN pagamento ELSE data END) < (make_date(${anoAtual},${mesAtual},1) + interval '1 month')::date`))[0][0]);
  const cartaoPend = Number((await sql(`SELECT COALESCE(SUM(ii.valor_parcela),0) FROM invoice_items ii JOIN card_invoices ci ON ci.id=ii.fatura_id JOIN card_transactions ct ON ct.id=ii.transacao_id JOIN credit_cards cc ON cc.id=ci.cartao_id WHERE cc.usuario_id=${A.id} AND ct.categoria_id=${catA.id} AND ci.ano_referencia=${anoAtual} AND ci.mes_referencia=${mesAtual} AND ci.status<>'PAID'`))[0][0]);
  ok(linha && linha.planejado === 2000 && Math.abs(linha.realizado_pago - contaPago) < 0.001 && Math.abs(linha.realizado_pendente - (contaPend + cartaoPend)) < 0.001,
    'resumo bate com o banco (pago / pendente conta + cartão)', { linha, contaPago, contaPend, cartaoPend });

  // ---------------------------------------------------------------- perfil
  secao('Perfil /user/me');
  const me = (await req('GET', '/user/me', A.token)).body;
  ok(me.id === A.id && !('senha_hash' in me) && me.avatarUrl, 'GET /user/me sem senha_hash', me);
  ok((await req('PUT', '/user/me', A.token, { nome: B.nome.toUpperCase() })).status === 409, 'nome de B (outra caixa) -> 409');
  ok((await req('PUT', '/user/me', A.token, { email: `${B.nome}@TESTE.local` })).status === 409, 'email de B -> 409');
  const up = await req('PUT', '/user/me', A.token, { email: `novo_${A.nome}@teste.local` });
  ok(up.status === 200 && up.body.email === `novo_${A.nome}@teste.local`, 'PUT /user/me atualiza');

  // ---------------------------------------------------------------- IA (sem chamar o provedor)
  secao('/ai/chat: validações antes do provedor');
  ok((await req('POST', '/ai/chat', A.token, {})).status === 400, 'sem mensagem e sem foto -> 400');
  const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(32)]).toString('base64');
  const r415 = await req('POST', '/ai/chat', A.token, { base64Image: gif });
  ok(r415.status === 415 && r415.body.codigo === 'IMAGEM_FORMATO', 'GIF -> 415', r415.body);
}

/** Remove só o que este run criou: filhos antes de usuarios (FKs NO ACTION), numa transação. */
async function limpar() {
  const ids = criados.usuarios;
  if (!ids.length) return;
  const uuids = ids.map((id) => `00000000-0000-0000-0000-${String(id).padStart(12, '0')}`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const loans = `SELECT id FROM loans WHERE usuario_id = ANY($1::int[]) OR user_id = ANY($2::varchar[])`;
    await client.query(`DELETE FROM loan_payments WHERE loan_id IN (${loans})`, [ids, uuids]);
    await client.query('DELETE FROM loans WHERE usuario_id = ANY($1::int[]) OR user_id = ANY($2::varchar[])', [ids, uuids]);
    for (const [tabela, coluna] of [
      ['transacoes', 'userid'],
      ['planned_transactions', 'userid'],
      ['planejamento', 'userid'],
      ['objetivos', 'usuario_id'],
      ['credit_cards', 'usuario_id'], // card_invoices / card_transactions / invoice_items em cascata
      ['cartoes', 'userid'],
      ['subcategoria', 'userid'],
      ['categoria', 'userid'],
    ]) {
      await client.query(`DELETE FROM ${tabela} WHERE ${coluna} = ANY($1::int[])`, [ids]);
    }
    if (criados.categoriaGlobal) {
      await client.query(
        "DELETE FROM categoria WHERE id = $1 AND userid IS NULL AND nome LIKE 'BE-Global-%'",
        [criados.categoriaGlobal]
      );
    }
    await client.query(`DELETE FROM usuarios WHERE id = ANY($1::int[]) AND nome LIKE '${PREFIXO.replace(/_/g, '\\_')}%'`, [ids]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  const sobra = (await sql('SELECT count(*) FROM usuarios WHERE id = ANY($1::int[])', [ids]))[0][0];
  console.log(`\nlimpeza: usuários ${ids.join(',')} removidos (restantes: ${sobra})`);
}

try {
  await main();
} catch (e) {
  falhas++;
  console.error('ERRO', e);
} finally {
  try {
    await limpar();
  } catch (e) {
    console.error('ERRO na limpeza', e.message);
  }
  await pool.end().catch(() => undefined);
  console.log(falhas ? `\n${falhas} FALHA(S) de ${total}` : `\nTUDO OK (${total} checagens)`);
  process.exit(falhas ? 1 : 0);
}
