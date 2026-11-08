# Testes

## Rodar

```bash
npm test                                 # uma execucao
npm run test:watch                       # modo watch
npm test -- localDb.test.js              # um arquivo
npm test -- --coverage                   # com cobertura
```

Configuração em `jest.config.js` (`next/jest`, ambiente jsdom, alias `@/` para `src/`) e `jest.setup.js` (`@testing-library/jest-dom`). O jsdom fornece o `localStorage` usado pelo banco local.

## Estado atual (2026-11-08)

| Suite | Cobre |
|---|---|
| `src/lib/localDb.test.js` | filtro de gastos por mês, CRUD, desfazer, cascata de recibos, exportar e importar backup, JSON corrompido |
| `src/lib/plan.test.js` | divisão essencial primeiro, mês fraco, renda que não cobre, bônus para o futuro, reserva antes de investir, previsões, gasto real com benefícios |
| `src/lib/text.test.js` | padrão de escrita das descrições: primeira letra maiúscula, resto minúsculo, espaços sobrando |
| `src/lib/expenses.test.js` | divisão de parcelas, virada de ano, registros por forma de pagamento, período, filtro e agrupamento |
| `src/lib/dates.test.js` | datas no fuso local |
| `src/lib/receiptParser.test.js` | parser da nota fiscal |
| `src/lib/statementParser.test.js` | valores, OFX 1.x e 2.x, CSV dos principais bancos, Latin-1, texto de OCR em tabela e em lista de app, prints sobrepostos |
| `src/lib/statementClassifier.test.js` | categorias do extrato, duplicados, gastos fixos, fatura e investimento, gravação no mês certo |
| `src/components/MoneyInput.test.js` | formatação de centavos (cópia da lógica) |
| `src/components/IncomesManager.test.js` | soma das receitas fixas (cópia da lógica) |

Resultado em 2026-11-08: 10 suítes, 144 testes, 144 passaram, 0 falharam, 0 em skip.

Limitação: os testes de `MoneyInput` e `IncomesManager` reimplementam a lógica e não importam o componente.

## Próximos passos

- [ ] Render dos componentes com `@testing-library/react`
- [ ] E2E com Playwright versionado no repositório
