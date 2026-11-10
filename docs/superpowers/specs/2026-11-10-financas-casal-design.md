# Finanças do casal — projeto da primeira versão

Data: 10/11/2026. Status: proposta consolidada para aprovação; implementação ainda não iniciada.

## Objetivo e decisões confirmadas

PWA para um casal compreender gastos mensais, sustentar a moradia, dividir contas e guardar dinheiro. Next.js com TypeScript na Vercel e Supabase para banco e autenticação, escolhidos pelo usuário. Dois logins, transparência total: ambos visualizam e gerenciam todos os dados. Cores vibrantes distinguem receitas, gastos, saldo, metas e destinações percentuais do salário.

Sucesso: mostrar quanto entrou, quanto foi gasto, quanto já está comprometido e quanto pode ser destinado às metas sem esconder déficits. Evitar dupla contagem de faturas, transferências e aportes. O produto usa “receitas” e “saldo”, não chama salário de lucro.

## Abordagens consideradas

1. React/Vite com backend gerenciado: adequado a uma SPA/PWA, mas o usuário optou por Next.js.
2. Next.js + Supabase (escolhida): PostgreSQL e autenticação integrados, menos infraestrutura própria; depende das cotas e disponibilidade dos serviços.
3. Next.js + Neon + autenticação separada: viável, com mais integrações para manter; descartada em favor do Supabase.

Hospedagem pretendida: Vercel Hobby para uso pessoal e Supabase Free, dentro das cotas. O Supabase gratuito pode pausar por baixa atividade. Não prometer disponibilidade ou gratuidade permanentes. Publicação depende do acesso às contas do usuário; entregar código e instruções se esse acesso não estiver disponível. Não substituir Next.js por outro framework ou migrar a hospedagem sem alinhamento.

## Escopo funcional

- Onboarding: criar espaço do casal, cadastrar rendas líquidas e datas previstas, saldo inicial das contas, cartões e percentuais. Valores pessoais não serão preenchidos a partir de memórias antigas.
- Login por e-mail e senha, recuperação de senha e convite ao segundo membro. Convite de uso único, com validade, vinculado ao e-mail; no máximo dois membros ativos. Ambos têm iguais permissões sobre os registros financeiros.
- Painel mensal com filtros por mês e pessoa, visão consolidada, receitas previstas/recebidas, despesas, faturas, vencimentos, saldo de caixa e projeção. Exibir a data de atualização e distinguir previsão de realização.
- CRUD de receitas e despesas, categorias, responsável, pagador, forma de pagamento, vencimento e status. Gastos recorrentes e parcelados. Categorias arquivadas continuam nos relatórios históricos.
- Contas compartilhadas divididas igualmente, por percentual ou proporcionalmente às rendas líquidas informadas. Guardar a divisão em cada lançamento; mudar a renda não altera meses anteriores. A soma das cotas deve ser 100%. Arredondar centavos de modo determinístico.
- Em despesas pagas por conta bancária, inferir o pagador pelo titular da conta selecionada, sem pedir a mesma informação duas vezes. Ao editar lançamento existente, preservar o pagador já registrado se a conta não mudar. Pagamentos de fatura continuam identificando quem pagou, com o titular do cartão como padrão editável.
- Acertos entre o casal: saldo de quem deve a quem calculado somente a partir de despesas efetivamente pagas e das cotas de responsabilidade. Registrar reembolso como transferência interna, sem nova receita ou despesa no consolidado.
- Cartões: titular, nome, limite informado, fechamento, vencimento, compras, parcelas, faturas e pagamentos. Limite disponível será estimado a partir dos lançamentos cadastrados e identificado como estimativa.
- Orçamento: grupos Contas essenciais, Diversão, Reserva e Investimentos; categorias de consumo pertencem a Contas ou Diversão. Metas pertencem a Reserva ou Investimentos, sem dupla destinação.
- Metas: nome, objetivo monetário, saldo já acumulado, prazo, prioridade, grupo, aportes e retiradas; proposta mensal com base na sobra e no prazo.
- Moradia: aluguel, condomínio, água, energia, internet e outras categorias marcadas como moradia. Mostrar percentual da renda e efeito nas metas; simular troca do aluguel mantendo outras premissas explícitas. Não avaliar preço de mercado sem comparáveis.
- Relatórios mensais por categoria/pessoa, comparação com meses anteriores e orçamento. Meses incompletos são identificados.
- Entrada manual e CSV com prévia, mapeamento de colunas, erros por linha e confirmação. Proposta do assistente: CSV nesta versão, sem conexão bancária automática. Exportar registros em CSV.

## Percentuais e cálculo das metas

Percentuais são regras de orçamento escolhidas pelo casal, não uma obrigação universal nem recomendação de investimento. Proposta inicial editável: 50% Contas, 30% Diversão, 10% Reserva, 10% Investimentos. O onboarding exige revisar/confirmar o perfil; total deve ser 100%, cada percentual entre 0 e 100. Mostrar também os valores em reais.

Base planejada R: soma das rendas líquidas previstas do mês, inicialmente salários; renda extra só entra quando adicionada à previsão. A base realizada considera somente valores recebidos. Manter versões mensais do orçamento, evitando recalcular histórico ao alterar o perfil. Renda zero resulta em percentuais realizados “não aplicáveis”, sem divisão por zero.

Orçamento de cada grupo = R × percentual / 100. Distribuir resíduos de centavos pelo método dos maiores restos. Exemplo fictício com R = R$ 8.000: Contas R$ 4.000, Diversão R$ 2.400, Reserva R$ 800 e Investimentos R$ 800.

Separar três conceitos:

1. Resultado mensal previsto = receitas previstas − despesas previstas do mês (parcelas de cartão contam no mês da fatura; pagamento da fatura não conta novamente).
2. Caixa projetado até o fim do mês = saldo atual das contas de uso diário + entradas ainda previstas − saídas ainda pendentes, incluindo faturas e transferências planejadas para metas. Nunca subtrair novamente saídas já refletidas no saldo atual.
3. Capacidade adicional para metas = máximo de zero e o menor entre (resultado mensal previsto menos aportes já feitos/comprometidos no mês) e (caixa projetado menos margem mínima de caixa configurável, inicialmente zero). Mostrar déficits nos indicadores de origem; zero na capacidade não esconde saldo negativo.

Saldo atual exclui contas de reserva/investimento. Aportes representam transferências para essas contas ou para um saldo de meta segregado: não são despesas de consumo. Aporte inicial de uma meta não é receita do mês. Uma transferência/aporte deve alimentar o saldo da meta uma única vez.

Necessidade mensal da meta = valor restante / número de meses incluindo o mês corrente até o prazo. Valor restante nunca negativo; arredondar para cima ao centavo. Prazo vencido com saldo faltante resulta em alerta para revisar prazo, sem divisão inválida.

Recomendação de aporte: calcular cotas restantes de Reserva/Investimentos após aportes realizados ou já planejados; distribuir a capacidade disponível entre esses grupos proporcionalmente às cotas restantes. Dentro do grupo, atender metas por prioridade e depois pelo prazo, limitadas à necessidade mensal de cada meta. Eventual valor não utilizado fica como “sobra sem destinação”, com ação explícita para realocar. Não criar aportes automaticamente.

Se as despesas superarem o orçamento, mostrar o excesso e a redução da capacidade de poupar. Se a capacidade for menor que a necessidade das metas, mostrar a diferença, sem fingir que a meta é viável. Projeções não presumem juros ou rentabilidade.

## Regras contábeis e de calendário

- Moeda BRL em centavos inteiros; datas de vencimento sem horário; timestamps de auditoria em UTC e exibição America/Sao_Paulo.
- O saldo inicial de uma conta é uma fotografia que já inclui movimentações até a data informada. Receitas, despesas, pagamentos, aportes e transferências nessa data ou anteriores permanecem no orçamento e no histórico, mas não alteram o caixa novamente; somente movimentações posteriores são aplicadas ao saldo.
- Despesas à vista entram no orçamento no mês do vencimento e no caixa na data do pagamento. Atrasos continuam pendentes na projeção corrente, sem duplicar a competência histórica.
- Compra parcelada distribui o total em parcelas exatas, com resto na última; orçamento usa cada parcela no mês de vencimento de sua fatura. Mostrar também o total contratado e o saldo de parcelas futuras separadamente.
- No dia de fechamento, proposta padrão: compra vai para a próxima fatura. Permitir ajustar a primeira fatura manualmente, pois bancos variam. Dias inexistentes usam o último dia do mês; vencimento segue o fechamento e avança o mês quando necessário.
- Pagamento parcial de fatura reduz a obrigação e o caixa pelo valor pago; saldo restante continua aberto/atrasado. Juros e encargos são lançamentos explícitos, nunca estimados automaticamente. Impedir pagamento acima do saldo aberto nesta versão.
- Acerto de cartão nasce somente ao pagar a fatura. Proposta de implementação: distribuir pagamentos parciais proporcionalmente aos saldos líquidos positivos das parcelas/compras na fatura, usando maiores restos para os centavos; persistir essa distribuição. Identificar o pagador real no pagamento (padrão: titular, editável). Cada fração paga usa a divisão original da compra para calcular o acerto, sem supor que o titular pagou tudo. Estornos reduzem primeiro o saldo ainda não pago da compra; a parte que exceder esse saldo reverte proporcionalmente os acertos anteriormente gerados, preservando histórico. Créditos sem compra vinculada exigem ajuste explícito e não geram acerto automaticamente.
- Estorno de cartão é crédito vinculado à compra e à fatura escolhida; não apaga o histórico. Fatura com crédito líquido carrega esse crédito para a seguinte. Histórico de pagamento não pode ser eliminado por editar uma compra: operações devem revalidar o saldo e solicitar ajuste explícito.
- Recorrências geradas de maneira idempotente ao abrir o mês e no servidor ao salvar regras; sem cron obrigatório. Edição permite “somente esta ocorrência” ou “esta e futuras”, preservando as anteriores.
- Confirmação de pagamento e geração de parcelas devem ser atômicas/idempotentes; reenvio de requisição não duplica registros. Concorrência de edição usa versão do registro e avisa conflito.

## Aparência e acessibilidade

Interface em português, responsiva, com prioridade ao celular e boa utilização no desktop. Proposta visual: fundo neutro, cartões com destaques vibrantes e tipografia legível. Verde-esmeralda para receitas/saldo positivo; coral/vermelho para despesas e déficits; âmbar para pendências; violeta para metas/reserva; azul para investimentos. Diversão recebe fúcsia como identidade de grupo, sem substituir o status de gasto. Cor nunca é o único sinal: rótulos, ícones, valores e padrões acessíveis acompanham os gráficos. Contraste adequado, navegação por teclado, foco visível e formulários com erros claros.

Navegação proposta: Resumo, Lançamentos, Cartões, Planejamento e Mais (relatórios, moradia, importação, configurações). Estados vazios orientam o primeiro cadastro. Dados de demonstração apenas em modo separado e explicitamente identificado; jamais misturados ao espaço real.

## Arquitetura e dados

Next.js App Router + TypeScript estrito; componentes cliente apenas onde houver interatividade. Supabase Auth e PostgreSQL com migrações SQL e RLS. Validação de entradas no servidor, funções puras para cálculos financeiros e testes unitários dessas regras. Escolha de biblioteca de UI e gráficos fica com a implementação, respeitando o visual proposto.

Entidades: profiles, households, household_members, invitations, accounts, categories, income_entries, expense_entries, expense_splits, recurrence_rules, cards, card_purchases, installments, invoices, invoice_payments, transfers, budgets, budget_allocations, goals, goal_movements, import_batches e audit_events. Todas as tabelas financeiras incluem household_id, autoria e timestamps. Relações validam que as duas pontas pertencem ao mesmo espaço. Faturas agregam parcelas/créditos; não duplicam despesas.

Segurança: RLS exige associação ao espaço em leituras e escritas; testes com terceiro usuário devem negar acesso. Identidade do autor vem da sessão, não do formulário. Convites e associação têm escrita controlada e limite atômico de dois membros. Chaves privilegiadas nunca chegam ao navegador. Ambos podem editar dados financeiros; somente o criador gerencia o convite. Registrar autor e alterações relevantes. Não armazenar número completo de cartão, CVV ou credenciais bancárias.

Sincronização após salvar e ao retornar à janela; refetch periódico enquanto ativo. A primeira versão exige internet para ler/escrever dados financeiros. PWA instala via manifest, ícones e service worker; cache somente de arquivos públicos e página offline, nunca de respostas autenticadas. Offline exibe indisponibilidade explícita, sem simular salvamento; escrita offline e resolução de conflitos ficam fora da versão.

Importação: formato inicial para receitas/despesas à vista, sem importação automática de parcelas/faturas. Campos: tipo, descrição, valor, data, categoria, conta, pessoa e status. Repetição do mesmo arquivo é bloqueada por hash no espaço; possíveis duplicatas entre arquivos são sinalizadas para revisão, sem apagar transações legítimas iguais. Limite proposto: 5.000 linhas/5 MB, carregamento integral ou falha sem importação parcial. Reversão permitida antes de edição/conciliação dos registros importados. Exportação protege contra fórmulas em células de texto e identifica filtros aplicados.

## Fora da primeira versão

Open Finance, captura de notificações bancárias, OCR, pagamento de boletos, movimentação financeira real, cálculo de rendimentos, indicação de ativos, comparação imobiliária de mercado, push automático, multi-moeda e escrita offline. Nenhum dado real é necessário para desenvolver e testar.

## Verificação e entrega

Testes: centavos e percentuais; renda zero; divisão proporcional; janeiro/fevereiro e virada de ano; fechamento e vencimento; parcelas e estornos; pagamento parcial; evitar dupla contagem; metas vencidas e inviáveis; caixa negativo; recorrência idempotente; importação repetida; isolamento RLS e tentativa de terceiro membro; conflitos de edição.

Fluxo de aceitação com valores fictícios: criar dois usuários no mesmo espaço, lançar renda, aluguel dividido e compra parcelada, confirmar pagamentos e verificar painel, fatura, acertos e meta em ambos os logins. Verificar instalação PWA, estados offline, contraste e responsividade. Executar checagem de tipos, testes e build de produção.

Entregar fonte Next.js, migrações Supabase, testes de cálculo, exemplo de variáveis sem segredos e guia de configuração/publicação na Vercel. Informar claramente testes de integração que não puderem rodar sem um projeto Supabase configurado. Exportação CSV não equivale a backup restaurável completo do banco.

## Decisões propostas pelo assistente para aprovação

Perfil inicial 50/30/10/10 ajustável, renda líquida como base, regras de sobra descritas acima, CSV de lançamentos à vista, comportamento de fechamento, rateio proporcional de pagamentos parciais de fatura, ausência de escrita offline, paleta e organização de navegação. Regras universais de percentual não são presumidas. A revisão do projeto levantou o rateio de pagamentos parciais, resolvido como proposta acima. Depois da aprovação deste projeto, elaborar o plano de implementação.
