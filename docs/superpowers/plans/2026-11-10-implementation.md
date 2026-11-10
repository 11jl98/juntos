# Juntos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Entregar PWA financeiro compartilhado do casal, pronto para configurar Supabase e publicar na Vercel.
**Architecture:** Next.js App Router com API autenticada, domínio TypeScript puro e PostgreSQL. A API valida comandos e persiste mudanças atômicas com controle de revisão. Modo demonstração usa o mesmo domínio sem dados reais.
**Tech Stack:** Next.js, React, TypeScript, Supabase, Zod, Node test runner, CSS responsivo.
**Spec:** ../specs/2026-11-10-financas-casal-design.md (aprovado na conversa).

## Global Constraints
- BRL em centavos inteiros; datas America/Sao_Paulo; dois membros por espaço; tudo compartilhado.
- Perfis 50/30/10/10 editáveis, total 100; não contar fatura/aportes como consumo.
- Sem gravação offline, sem integração bancária; nenhuma chave secreta no cliente.
- Fonte Next.js real; publicação Vercel depende de credenciais não fornecidas.

## Review Focus
- Saldo de abertura não deve entrar como renda; testes de projeção.
- Um usuário autenticado de outro espaço não pode ler/escrever registros; teste SQL de RLS.
- Pagamentos de fatura parciais, estornos e acertos não podem criar dinheiro; testes de domínio.
- Meses futuros devem incluir recorrências e parcelas sem duplicar; teste de geração idempotente.
- Importação repetida e edição concorrente não podem sobrescrever dados silenciosamente; testes de comando e CAS SQL.

## Task 1: Domínio financeiro e configuração
Files: package.json, tsconfig.json, src/domain/{types,money,finance,commands,csv}.ts, tests/domain.test.ts.
Interfaces: State, Command, applyCommand(state, command, actor, date): State; summarize(state, month): Summary; planGoals(state, month): GoalPlan[].
- [x] Testes RED para dinheiro, parcelas, competência/caixa, metas, reembolsos, estornos, recorrência e CSV.
- [x] Implementar modelos validados, cálculos puros e comandos com IDs idempotentes e invariantes de referência.
- [x] `npm test` deve passar; commit feat: financial domain.

## Task 2: Persistência e autenticação
Files: supabase/migrations/001_initial.sql, supabase/tests/security.sql, src/lib/{supabase,server}.ts, src/app/api/{finance,household}/route.ts.
Interfaces: GET finance retorna {state,revision,members,household}; POST finance recebe {command,revision,requestId}; household recebe create/invite/join.
- [x] Testar ausência de sessão e validação de payload; preparar teste transacional SQL com três usuários e convites repetidos.
- [x] Implementar RLS, convite expira em 7 dias e único, limite dois, CAS com auditoria e deduplicação.
- [x] APIs validam Auth getUser e escopo antes de acesso privilegiado; limites de corpo e sem cache.
- [x] Executar testes, checagem de tipos e, se disponível, PostgreSQL local; commit feat: secure persistence.

## Task 3: Interface completa
Files: src/components/{app-shell,auth,overview,entries,cards,planning,reports,settings,ui}.tsx, src/app/{layout,page,globals.css}, src/domain/demo.ts.
Interfaces: componentes recebem State, month e dispatch(Command); store controla carregamento, erros, revisão e sessão.
- [x] Preparar casos de aceitação: nova conta, lançamento, divisão, parcela, aporte e importação; validar domínio antes da UI.
- [x] Construir layout vibrante com navegação, filtros, formulários acessíveis, estados vazios e demonstração isolada.
- [x] CRUD de contas/categorias/cartões/metas, pagamentos, orçamento mensal, moradia, relatórios, CSV e convite.
- [x] `npm run typecheck` e `npm test`; verificar fluxos no navegador quando disponível; commit feat: shared finance UI.

## Task 4: PWA e entrega
Files: src/app/manifest.ts, public/{sw.js,offline.html,icon-192.png,icon-512.png}, README.md, .env.example.
- [x] Service worker nunca armazena dados autenticados; somente página offline e ícones.
- [x] Documentar instalação, confirmação e recuperação de conta, SQL, variáveis, Vercel, limites de hospedagem e backup.
- [x] `npm run build`, `npm test`, `npm run typecheck`; smoke HTTP e navegador.
- [x] Commit feat: installable PWA and deployment guide.

## Task 5: Revisão e empacotamento
- [x] Revisão independente do código, corrigir defeitos relevantes com regressões.
- [x] Registrar verificações e limites reais; empacotar código sem segredos/dependências; salvar ZIP final.

## Execution notes
Usuário autorizou iniciar implementação; execução direta nesta sessão, sem novo bloqueio de aprovação do plano.

Validação de navegador não disponível: documentada em docs/VERIFICACAO.md. Fluxos reais de Auth/Supabase dependem das credenciais do usuário.
