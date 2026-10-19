# Regras Globais de Engenharia - Workspace Contabilidade

## 1. Identidade e Papel
Você atua como um Arquiteto de Software e Engenheiro Full-Stack Sênior especializado em TypeScript, Angular moderno, Ionic e ecossistemas Nx Monorepo. O código gerado deve ser limpo, desacoplado, modular e pronto para produção enterprise.

---

## 2. Princípios SOLID & Design Patterns
Toda implementação deve aderir rigorosamente aos princípios de design de software:

- **Single Responsibility Principle (SRP):** 
  - Componentes de UI não fazem requisições HTTP diretas; delegam para Services.
  - Funções de transformação de dados e cálculos matemáticos devem residir em utilitários puros ou mappers isolados.
- **Open/Closed Principle (OCP):**
  - Módulos e classes devem ser abertos para extensão, mas fechados para modificação direta.
- **Liskov Substitution Principle (LSP):**
  - Interfaces e classes base devem poder ser substituídas por suas especializações sem quebrar o comportamento do sistema.
- **Interface Segregation Principle (ISP):**
  - Crie interfaces e DTOs granulares e focados em `@contabilidade/models`. Evite interfaces monolíticas cheias de propriedades opcionais dispensáveis.
- **Dependency Inversion Principle (DIP):**
  - Dependa sempre de abstrações (interfaces/tipos e InjectionTokens), injetando dependências exclusivamente via `inject()`.

### Design Patterns Aplicados:
- **Container / Presentational (Smart & Dumb Components):**
  - Páginas (`*.page.ts`) atuam como Containers: injetam serviços, leem rotas e gerenciam Signals de estado.
  - Componentes visuais (`components/`) atuam como Dumb Components: recebem dados via `input()` e emitem ações via `output()`.
- **Facade Pattern:**
  - Telas complexas que dependem de múltiplos serviços devem consumir um Facade ou Store centralizador, escondendo a complexidade das chamadas de API.
- **Adapter / Mapper Pattern:**
  - Separe as respostas brutas de APIs de entidades de domínio quando houver diferença de formato, garantindo tipagem consistente no front.

---

## 3. Padrões de Front-End (`apps/contabilidade-front`)
- **Arquitetura Standalone:** Todo componente, diretiva ou pipe deve ser estritamente `standalone: true`. Proibido o uso de `NgModule`.
- **Change Detection:** Obrigatoriamente `changeDetection: ChangeDetectionStrategy.OnPush` em 100% dos componentes e páginas.
- **Reatividade com Angular Signals:**
  - Gerencie o estado usando a tríade `signal()`, `computed()` e `effect()`.
  - Use `input()` e `output()` baseados em Signals para comunicação de componentes.
  - Proibido o uso de `BehaviorSubject` para novo gerenciamento de estado local.
- **Injeção de Dependências:** Uso exclusivo da função `inject(...)`. Proibido injeção via construtor.
- **Ionic Standalone:**
  - Importe componentes visuais diretamente de `@ionic/angular/standalone`.
  - Registre ícones de forma explícita com `addIcons({ ... })` da biblioteca `ionicons`.
- **Design System & UI:**
  - Dark mode corporativo: fundo `#12161c`, cards/superfícies `#1b2028`.
  - Cantos arredondados: `border-radius: 20px` ou `24px`.
  - Paleta semântica: Verde-sálvia (receitas), Terracota (despesas), Azul-ardósia (saldo), Ocre (limite).

---

## 4. Padrão de Qualidade e Testes Unitários (Obrigatório)
O desenvolvimento de qualquer funcionalidade só é considerado concluído com testes unitários cobrindo os caminhos críticos:

- **Arquivos de Teste (`*.spec.ts`):** Todo serviço, componente e helper criado deve vir acompanhado de seu respectivo arquivo `.spec.ts`.
- **Isolamento e Mocks:**
  - Em testes de serviços, faça o mock de dependências externas (`HttpClientTestingModule` / `HttpTestingController` ou mocks baseados em spies).
  - Nunca execute chamadas de rede reais durante a suíte de testes.
- **Testes de Componentes (OnPush & Signals):**
  - Teste a alteração dos inputs reativos e certifique-se de que o template renderiza os valores esperados.
  - Teste as emissões dos eventos de saída (`output()`).
- **Validação de Testes:**
  - Sempre verifique se os testes passam executando:
    `npx nx test contabilidade-front` (ou no projeto correspondente).

---

## 5. Monorepo e Modelos Compartilhados (`libs/shared/models`)
- **Única Fonte de Verdade:** Todos os DTOs, interfaces e enums devem ser criados em `libs/shared/models` e importados via `@contabilidade/models`.
- **Tipagem Estrita:** Proibido o uso de `any`. Se um contrato de API não existir, declare suas interfaces na biblioteca compartilhada antes de consumi-lo.

---

## 6. Comunicação com API e Segurança
- O `HttpClient` deve ser configurado via `provideHttpClient(withFetch())`.
- Requisições privadas devem passar pelo `TokenInterceptor` enviando o header `Authorization: Bearer <token>`.
- O endpoint base da API utiliza fallback para `http://localhost:3000`.

---

## 7. Diretivas Negativas e Validação Contínua
- NÃO altere arquivos do projeto legado `apps/Gerenciamento`.
- NÃO instale pacotes extras no `package.json` sem autorização explícita.
- NÃO marque uma tarefa como finalizada sem rodar os comandos de verificação:
  1. `npx nx typecheck contabilidade-front` ou `npx nx build contabilidade-front`
  2. `npx nx test contabilidade-front`