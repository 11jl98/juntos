# Verificação da entrega

## Executado

- **58 testes automatizados**: centavos, rateio por pessoa, débitos distribuídos entre contas principais, snapshot de saldo sem dupla contagem, simulação de aluguel, oportunidades em gastos discricionários, assinaturas mensais em cartão e encerramento futuro, limite de um espaço, isolamento RLS, convites, parcelas, fechamento em fevereiro, competência/caixa, aportes, percentuais, recorrências, meses não visitados, estornos, crédito transportado entre faturas e acertos entre pessoas.
- Histórico de saídas por conta: data efetiva de pagamento, corte do saldo inicial, rateio em centavos, registros antigos, fatura parcial sem duplicar compras, aportes realizados e transferências de saída.
- Regressão de interface: valores por pessoa em despesas compartilhadas e individuais, filtro mensal, estado vazio e remoção da atividade da tela sem apagar a auditoria.
- Verificação em navegador no modo demonstração (2026-11-13): desktop de 1440 px e celular de 390 px, capturas de tela do histórico e da divisão, abertura e fechamento por teclado, troca de mês e ausência de rolagem horizontal nas telas alteradas.
- Regressão de formulário: editar uma despesa conserva o percentual personalizado.
- Controle de revisão: impede salvar formulário aberto antes de outra atualização.
- Teste de PostgreSQL embarcado (PGlite) executando a migração real: RLS, convite vinculado ao e-mail, uso único, dois membros, escrita restrita ao serviço, CAS e deduplicação de requisições.
- Teste do service worker: nenhuma resposta financeira/API em cache; navegação sem rede usa somente a página pública offline.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado, Next.js 16.4.6.
- Smoke HTTP em servidor de produção: página, manifest, ícones, service worker e offline respondem; APIs rejeitam requisições sem sessão com HTTP 401 e no-store.

## Revisão

A revisão independente identificou casos de calendário e histórico de transferências, corrigidos com testes de regressão. A revisão interna também corrigiu alterações de divisão ao editar, conflitos em formulários abertos, recorrências em meses não visitados, crédito entre faturas e retiradas planejadas duplicadas. Código formatado com Prettier.

## Limites da validação

- Não foram fornecidas contas/credenciais Supabase ou Vercel. Nenhum banco remoto foi criado, nenhuma conta real foi cadastrada, nenhum e-mail real foi enviado e nenhum deploy foi realizado.
- A verificação visual/interativa atual cobre as telas alteradas de contas e lançamentos no modo demonstração. Ainda **não houve homologação completa com sessões reais nem instalação em iOS/Android**; a validação local não substitui esses testes.
- PGlite simula o contexto Auth do Supabase; confirmar SMTP, URLs de redirect e duas sessões reais após configurar o projeto.

## Homologação antes dos dados reais

1. Executar a migração em um projeto Supabase de teste; preencher `.env.local`.
2. Criar dois usuários, confirmar ambos os e-mails, criar espaço e aceitar convite.
3. Em duas sessões, lançar uma renda, um aluguel dividido, uma compra parcelada e um aporte. Confirmar sincronização dos valores.
4. Abrir a mesma despesa nas duas sessões: salvar na primeira e verificar o aviso de conflito na segunda.
5. Conferir fatura parcial, estorno e transporte de crédito; validar valores contra os extratos reais antes de migrar o controle.
6. Verificar importação CSV e sua reversão, navegação por teclado e apresentação em celular.
7. Publicar em HTTPS, instalar PWA e testar a página offline.

## Decisão de persistência

Os dados financeiros ficam em um agregado JSONB tipado e versionado por casal, com atualização atômica, em vez de uma tabela por entidade financeira. Membros, convites e auditoria permanecem relacionais. O trade-off é menor facilidade para consultas SQL analíticas e regravação do agregado por operação; a implementação é voltada a este espaço de dois usuários.
