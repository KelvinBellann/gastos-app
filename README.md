# Controle de Gastos

App pessoal de controle de receitas e despesas por mes, com leitura de notas fiscais por OCR e comparacao de precos entre lojas.

Stack: Next.js 16 (App Router, React Compiler), React 19, Supabase (auth + Postgres com RLS), Tailwind 4, tesseract.js 7, Jest 29.

## Pre-requisitos

- Node 24 e npm 11 (versoes usadas na validacao de 2026-09-28)
- Projeto no Supabase com autenticacao por email/senha habilitada

## Configuracao

1. Instalar dependencias:

```bash
npm install
```

2. Criar `.env.local` na raiz (o arquivo e ignorado pelo git):

```
NEXT_PUBLIC_SUPABASE_URL=https://<projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

3. Criar o schema no SQL Editor do Supabase, nesta ordem:

| Ordem | Arquivo | O que cria |
|---|---|---|
| 1 | `SUPABASE_SETUP.sql` | tabelas `incomes`, `expenses`, `variable_incomes`, indices, RLS, trigger de `updated_at` |
| 2 | `PAYMENT_CONTROL_MIGRATION.sql` | colunas `payment_method`, `installments`, `is_paid`, `paid_date`, `notes` em `expenses` |
| 3 | `INSTALLMENT_MONTH_MIGRATION.sql` | colunas `installment_month` e `installment_number` em `expenses` |
| 4 | `supabase/migrations/001_create_receipts_tables.sql` | tabelas `receipts`, `receipt_items`, `store_products` (aba Recibos e Comparar) |

Observacoes:
- `ADD_PAYMENT_COLUMNS.sql` e um subconjunto do passo 2 (sem a coluna `notes`). Nao precisa rodar se o passo 2 foi executado.
- `supabase/migrations/002_create_incomes_table.sql` e `003_create_variable_incomes_table.sql` recriam tabelas que o passo 1 ja cria, com tipos diferentes (INTEGER em vez de BIGINT). Nao rodar depois do passo 1.
- `SUPABASE_SETUP.sql` nao e idempotente (`CREATE POLICY` e `CREATE TRIGGER` sem guarda). Rodar uma unica vez.

## Comandos

```bash
npm run dev      # servidor de desenvolvimento em http://localhost:3000
npm run build    # build de producao (roda o React Compiler)
npm run start    # serve o build
npm run lint     # eslint (eslint-config-next, regras do React Compiler)
npm test         # jest
npm run test:watch
```

## Estrutura

- `src/app/page.js`: verifica a sessao e alterna entre `LoginPage` e `Dashboard`
- `src/components/Dashboard.js`: mes, receitas, novo gasto, lista agrupada, abas Recibos e Comparar
- `src/components/IncomesManager.js`: receitas fixas e variaveis
- `src/components/ReceiptsTab.js` e `ReceiptUpload.js`: recibos e OCR
- `src/components/StoreComparison.js`: comparacao de precos por produto entre lojas
- `src/lib/receiptOCR.js` e `receiptParser.js`: extracao e parse do texto da nota
- `src/lib/supabaseClient.js`: cliente Supabase

Guias de uso: `EXPENSE_INPUT_GUIDE.md`, `PAYMENT_CONTROL_GUIDE.md`, `INSTALLMENT_GUIDE.md`. Testes: `TESTING.md`.
