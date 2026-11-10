# Juntos · Finanças a dois

PWA em **Next.js + TypeScript**, preparado para **Vercel + Supabase**. Dois logins, um espaço compartilhado. Interface em português, responsiva, com cores para receitas, gastos, reserva e investimentos.

## Executar no computador

Requer Node.js 22 ou superior e npm.

```bash
npm ci
npm run dev
```

Abra http://localhost:3000. Sem variáveis de ambiente, o botão **Explorar demonstração** permite usar dados fictícios. Também pode abrir http://localhost:3000/?demo=1. As alterações da demonstração ficam somente na memória da aba e são descartadas ao recarregar. Não há envio desses dados ao Supabase.

## Conectar o Supabase

1. Crie um projeto Supabase e aguarde o banco ficar disponível.
2. No **SQL Editor**, execute uma vez o conteúdo de `supabase/migrations/001_initial.sql`. A migração cria tabelas, funções, permissões e RLS.
3. Copie `.env.example` para `.env.local` e preencha:
   - `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable key (ou anon key legada).
   - `SUPABASE_SECRET_KEY`: secret key (ou service_role legada). **Somente no servidor**; nunca publique em repositório nem use prefixo `NEXT_PUBLIC`.
4. Em **Authentication → URL Configuration**, configure Site URL para `http://localhost:3000` em desenvolvimento e autorize os redirects `http://localhost:3000/**`. Na produção, substitua pelo domínio HTTPS da Vercel e autorize esse domínio.
5. Mantenha confirmação de e-mail habilitada. Para enviar e-mails a endereços reais de ambos, configure um SMTP no Supabase Auth. O remetente padrão tem restrições e limites; não presuma que ele atenderá ambos. Se usar um provedor com franquia gratuita, confira os limites atuais. O app não envia e-mails por conta própria.
6. Reinicie `npm run dev` após mudar as variáveis.

## Primeiro acesso do casal

1. Cada pessoa cria sua conta e confirma o próprio e-mail.
2. Uma pessoa entra, cria o espaço e informa os dois nomes. Ela ocupa a posição “Pessoa 1”.
3. Em **Nosso espaço**, o criador informa o e-mail do parceiro e gera um convite. Copie e envie o link manualmente.
4. O parceiro abre o link e entra com o **mesmo e-mail informado**. O código é preservado nesta aba durante o login. Se confirmar e-mail em outra aba/dispositivo, abra novamente o convite original.
5. O convite expira em sete dias, funciona uma vez e é substituído quando um novo é gerado. O limite é de dois membros. Quem recebe convite não deve criar outro espaço antes de aceitá-lo.
6. Cadastrem as contas de uso diário com saldo inicial e data; revisem o perfil 50/30/10/10 em **Planejamento → Editar regras**; cadastrem rendas, gastos e cartões.

Cada membro vê e altera os mesmos registros. Os nomes identificam as pessoas nos gastos; o ID de autenticação identifica o autor na auditoria. Somente o criador gerencia convites.

## Funcionalidades

- Resumo mensal: receitas previstas/recebidas, gastos previstos, pendências, caixa projetado e capacidade adicional de poupança.
- Receitas e despesas à vista; edição, exclusão, confirmação de pagamento e divisão meio a meio, proporcional à renda ou personalizada.
- Regras de recorrência mensal, com início/fim e geração idempotente ao consultar o mês.
- Cartões: limite estimado, fechamento, vencimento, compras parceladas, faturas, pagamentos parciais e estornos por parcela.
- Metas com saldo inicial, prioridade, prazo, aportes/retiradas realizados ou planejados e sugestão de aporte limitada ao orçamento/caixa.
- Orçamento mensal com Contas, Diversão, Reserva e Investimentos; total de percentuais deve ser 100%.
- Transferências entre contas; acertos entre as duas pessoas sem gerar renda/despesa artificial.
- Relatórios por categoria, seis meses de histórico, custo da moradia e simulação do aluguel.
- Importação CSV com mapeamento, prévia, revisão de duplicatas, limite 5 MB/5.000 linhas e desfazer lote não editado/conciliado.
- Exportação CSV dos lançamentos filtrados. Exportar CSV **não** é backup restaurável de todo o banco.
- Instalação PWA, página offline explícita e nenhum cache de dados financeiros pelo service worker.

## Como os números funcionam

**Dinheiro:** centavos inteiros. Valores em reais são convertidos na entrada e formatados em pt-BR. Parcelamento distribui o resto de centavos na última parcela.

**Renda:** valores líquidos cadastrados. Saldo inicial de conta, transferências e retiradas de metas não são receitas. A base percentual é a renda prevista do mês.

**Consumo:** despesa à vista pertence ao mês do vencimento. Parcela de cartão pertence ao mês de vencimento da fatura. Pagar a fatura não gera uma nova despesa. Aportes em metas não são consumo.

**Caixa:** saldos iniciais + entradas pagas − saídas pagas − pagamentos de fatura − aportes realizados + retiradas, com transferências por conta. O painel do mês projeta pendências até seu final, incluindo contas atrasadas. Reservas registradas em metas ficam fora do saldo disponível.

**Pode guardar mais:** menor valor entre resultado mensal ainda não destinado e caixa projetado menos margem mínima, limitado inferiormente a zero. Déficits continuam visíveis nos outros indicadores.

**Metas:** meses restantes incluem o mês selecionado; não se presume rentabilidade. Reserva/investimentos dividem a capacidade conforme suas cotas restantes; metas são atendidas por prioridade e prazo. Excesso sem destinação não vira aporte automático.

**Cartões:** compra no dia do fechamento vai para a próxima fatura por padrão; a primeira data pode ser corrigida manualmente. Pagamento parcial é distribuído proporcionalmente entre compras para os acertos. Estornos preservam a compra original e reduzem acertos quando apropriado. Registre juros como encargos separados. Não realizamos pagamentos bancários.

**Moradia:** compara os custos cadastrados com a renda e simula substituir o aluguel informado. Não estima preço de mercado nem garante que um valor seja adequado para todo casal.

## Publicar na Vercel

1. Crie um repositório GitHub e envie esta pasta, excluindo `.env.local`, `node_modules` e `.next` (já estão no `.gitignore`).
2. Importe o repositório na Vercel. Framework: **Next.js**. Build: `npm run build`. Install: `npm ci`.
3. Adicione as três variáveis de `.env.example` em **Environment Variables**. Publique novamente quando variáveis públicas mudarem.
4. Configure o domínio da Vercel no Supabase Auth, incluindo as URLs de redirecionamento. Use URLs estáveis, evitando depender de endereços aleatórios de preview para recuperação de senha.
5. Teste o fluxo de cadastro/convite com dois usuários reais antes de registrar dados financeiros reais.
6. No celular Android, use “Instalar aplicativo” ou o menu do navegador. No Safari do iPhone: Compartilhar → Adicionar à Tela de Início. A instalação requer HTTPS (ou localhost para desenvolvimento).

O projeto não foi conectado a uma conta Supabase/Vercel durante a geração. Nenhum deploy foi realizado. Os planos gratuitos têm cotas e podem mudar; o Supabase Free pode pausar projetos pouco ativos. Vercel Hobby destina-se a uso pessoal/não comercial. A hospedagem não inclui garantia de backup, envio de e-mails ou disponibilidade contínua.

## Arquitetura

| Caminho | Responsabilidade |
| --- | --- |
| `src/domain` | Tipos Zod, comandos, cálculos em centavos, CSV e dados fictícios |
| `src/components` | Interface e formulários por módulo |
| `src/app/api/finance` | Validação de sessão/comando, revisão e escrita atômica |
| `src/app/api/household` | Criar espaço, gerar e aceitar convite |
| `src/lib/server.ts` | Verificação de usuário e cliente privilegiado exclusivo do servidor |
| `supabase/migrations` | PostgreSQL, RLS, convites, idempotência e auditoria |
| `tests` | Cálculos e integração SQL com PGlite |

**Decisão de implementação:** as entidades financeiras são coleções tipadas em um agregado JSONB versionado por casal, em vez das tabelas financeiras separadas esboçadas no design. Membros, convites, revisões e auditoria são relacionais. Isso permite salvar operações envolvendo múltiplos saldos em uma transação, com um único domínio TypeScript compartilhado pela API e pela demonstração. O custo é tornar consultas analíticas SQL menos diretas e reescrever o agregado em cada operação; adequado ao escopo de dois usuários, com limites de volume declarados nos schemas.

O navegador envia comandos à API Next.js; nunca recebe a chave privilegiada. O servidor valida `auth.getUser`, a associação ao espaço e o comando; a função `save_finance` verifica a associação novamente, bloqueia a linha e compara a revisão. Leitura por RLS; escrita direta por usuários é negada. Conflitos retornam erro e recarregam os dados, preservando o formulário para revisão. O painel atualiza ao ganhar foco e a cada 30 segundos enquanto visível.

## Testes e verificações

```bash
npm test
npm run typecheck
npm run build
npm run test:http
```

O teste de SQL usa PostgreSQL embarcado via PGlite, com funções `auth.uid`/`auth.jwt` simuladas, para executar a **mesma migração** e verificar isolamento, convites, limite de membros, conflito e idempotência. Ele não substitui a homologação no Supabase hospedado nem testa entrega real de e-mail.

## Operação e limites

- Precisam de conexão para gravar. A demonstração não é uma conta real nem armazenamento permanente.
- Captura automática de bancos, push, OCR, juros automáticos, multi-moeda e escrita offline ficam fora desta versão.
- Alterar/excluir lançamento à vista recalcula saldo e deixa evento de auditoria. Compras no cartão são ajustadas por estorno; pagamentos de fatura não são apagados pela UI.
- O arquivo CSV deve trazer datas YYYY-MM-DD ou DD/MM/YYYY, valores sem símbolo monetário e tipo `receita`/`despesa`. Nomes de conta, pessoa e categoria precisam existir. Status: `pago`, `recebido` ou `pendente`. Lotes importados usam divisão inicial 50/50 e não geram parcelas.
- Mantenham cópias periódicas do banco completo pelo painel/CLI do Supabase e testem restauração em outro ambiente. O CSV de lançamentos não contém todas as metas, convites e auditoria.
- Não armazenar CVV, números completos de cartão ou senhas bancárias. Revisem os dados cadastrais e as projeções; o aplicativo só conhece os lançamentos informados.

Fontes de referência: [PWA no Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps), [Auth no Supabase](https://supabase.com/docs/guides/auth), [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Supabase Free](https://supabase.com/pricing).

O relatório de testes e os limites de homologação estão em [docs/VERIFICACAO.md](docs/VERIFICACAO.md).
