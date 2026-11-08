# Controle de Gastos

App pessoal de receitas e despesas por mês, com leitura de nota fiscal por OCR e comparação de preços entre lojas. Roda 100% local: sem servidor, sem conta e sem banco externo.

Stack: Next.js 16 (App Router, React Compiler), React 19, Tailwind 4, Phosphor Icons, tesseract.js 7, Jest 29.

## Onde ficam os dados

- Tudo fica no `localStorage` do navegador, na chave `gastos-app:db:v1`, com as tabelas `incomes`, `expenses`, `variable_incomes`, `receipts`, `receipt_items`, `plan_settings`, `plan_months` e `plan_contributions`.
- Cada navegador e cada aparelho tem a sua cópia. Abrir o app no celular não mostra o que foi lançado no computador.
- Limpar os dados do site no navegador apaga tudo. Por isso o topo do app tem dois botões:
  - **Exportar backup**: baixa `gastos-backup-AAAA-MM-DD.json` com todas as tabelas.
  - **Importar backup**: substitui os dados deste navegador pelos do arquivo, depois de confirmar. Arquivo de outro formato é recusado sem apagar nada.
- A leitura da nota (OCR) roda no próprio navegador. A imagem não é gravada, só o texto lido e os itens.

## Rodar

Pré-requisito: Node 24 e npm 11.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # site estatico em out/ (output: "export")
npm run start    # serve out/ em http://localhost:3000
npm run build:ios  # build + copia out/ para o app iOS em ios/
npm run lint
npm test
```

Não há variável de ambiente. O `.env.local` antigo (Supabase) não é mais usado.

## App iOS

`ios/` é um app nativo que abre o site de `out/` num `WKWebView`, compilado e instalado no iPhone com [xtool](https://xtool.sh) a partir do Windows (via WSL), sem Mac nem Xcode. Os dados ficam no próprio iPhone. O passo a passo está em [ios/README.md](ios/README.md).

## Como o app funciona

| Situação | Comportamento |
|---|---|
| Gasto fixo | Um registro que aparece em todos os meses e conta como pago |
| Débito ou Pix | Um registro no mês, pago ou pendente, com data de pagamento opcional |
| Crédito em N parcelas | N registros "Descrição (i/N)"; a parcela i vence i meses depois da compra. Todos contam também no mês da compra (regra herdada, ver dívida abaixo) |
| Lançamentos iguais no mesmo dia | Somados numa linha "2x"; editar e excluir valem para cada registro do grupo |
| Excluir | Imediato, com "Desfazer" por 6 segundos |
| Receitas | 4 fixas por mês (salário, multibenefícios, alimentação, salário esposa) e variáveis com período; ambas entram no saldo |
| Filtro de período | Hoje, 7 dias, 30 dias ou Todos; o resumo de gastos acompanha o filtro |
| Mês e aba | Ficam na URL (`?mes=2026-10&aba=recibos`) |

## Importar extrato

O botão **Importar extrato**, em "Novo gasto", aceita foto ou print (uma ou várias imagens, lidas por OCR) e arquivo exportado pelo banco em OFX, CSV ou PDF com texto. Tudo é lido no aparelho; não há conexão com o banco, porque o Open Finance exigiria servidor e um agregador contratado.

Cada lançamento passa por `src/lib/statementClassifier.js` e aparece numa tela de conferência, com categoria editável e total por categoria:

| Situação | Comportamento |
|---|---|
| Categoria | A que a pessoa já usou para a mesma descrição; senão, regras por palavra-chave (mercado, banco, assinaturas, contas, transporte, saúde, transferências...). Sem regra, cai em Aleatórios |
| Entrada de dinheiro | Fica de fora e o total ignorado é informado: salário já é receita no app |
| Mesma data e valor de um gasto existente | Vem desmarcado, para reimportar sem duplicar |
| Mesmo valor de um gasto fixo | Vem desmarcado, porque fixos já contam em todos os meses |
| Pagamento de fatura e investimento | Vêm desmarcados, porque não são consumo |
| Mês do gasto | O da data do lançamento, mesmo que o extrato cruze meses |
| Extrato de cartão | Segue a regra do crédito: parcela única no mês seguinte à compra |
| Depois de importar | "Desfazer" por 6 segundos remove todos os lançamentos importados |

Para melhorar a classificação, acrescente termos em `RULES`: a ordem importa, porque a primeira regra que casa vale.

## Aba Plano

Divide a renda do casal todo mês entre essenciais, lazer e futuro, e acompanha a reserva de emergência e a meta de viver de renda.

| Regra | Como funciona |
|---|---|
| Renda para dividir | Seu salário + salário da esposa + receitas variáveis do mês |
| Benefícios | Multibenefícios e alimentação ficam fora da divisão e abatem os gastos de mercado e lanches |
| Essenciais primeiro | Valor fixo definido em Ajustes do plano (padrão 50% da renda base até ser definido); não cai em mês fraco |
| Sobra | Dividida entre lazer e futuro, padrão 60/40 (a proporção 30/20) |
| Receitas variáveis | Opcional: vão inteiras para o futuro |
| Futuro | Enche a reserva até o alvo e só depois vai para investimentos |
| Reserva | 6 meses de essenciais (ajustável) |
| Viver de renda | Custo de vida (essenciais + lazer médio) dividido pelo rendimento real ao mês (padrão 0,4%, multiplicador 250) |
| Proporção do casal | Mostra quanto cada um representa na renda e a parte de cada um nos essenciais |

Fluxo do mês:
1. Conferir os salários do mês.
2. "Fechar o mês" grava a sugestão, ou "Ajustar" para mudar essenciais e lazer antes de fechar.
3. Registrar os aportes feitos (ou "Registrar o que falta") e retiradas da reserva quando houver.
4. Acompanhar quanto já saiu de essenciais e lazer. Aqui o crédito conta no mês da parcela, não no mês da compra.

Previsões usam a média do futuro dos últimos 3 meses fechados. A reserva é tratada como dinheiro parado, sem rendimento.

## Estrutura

- `src/app/page.js`: renderiza o painel só no navegador, onde vivem os dados
- `src/components/Dashboard.js`: cabeçalho, mês, abas, backup e resumo
- `src/components/ExpenseForm.js`, `ExpenseList.js`, `CategoryBreakdown.js`: novo gasto, lançamentos e totais por categoria
- `src/components/IncomesManager.js`: receitas fixas e variáveis
- `src/components/PlanTab.js`, `PlanContributions.js`, `PlanSettings.js`: aba Plano
- `src/components/ReceiptsTab.js`, `ReceiptUpload.js`, `StoreComparison.js`: recibos, leitura da nota e comparação de preços
- `src/components/ui.js`: botões, campos, cartões, avisos e toast
- `src/lib/localDb.js`: banco local, desfazer, exportar e importar
- `src/lib/expenses.js`: parcelas, períodos, filtro e agrupamento
- `src/lib/plan.js`: divisão do mês, gasto real por pote, metas e previsões
- `src/lib/receiptOCR.js`, `receiptParser.js`: leitura e interpretação da nota
- `src/components/StatementImport.js`: importação e conferência do extrato
- `src/lib/statementParser.js`, `statementPdf.js`, `statementClassifier.js`: leitura de OFX, CSV, PDF e texto de OCR, e categorização dos lançamentos
- `src/app/globals.css`: tokens de cor dos temas claro e escuro

## Dívida conhecida

- Na aba Gastos, parcelas de crédito somam no mês da compra e de novo no mês de vencimento. Mudar isso é decisão de produto, não correção. A aba Plano já conta só no mês da parcela.
- Os dados ficam em um navegador só. Para usar em dois aparelhos, escolha um como oficial e use exportar e importar backup.
