# Testes

## Rodar

```bash
npm install
npm test               # uma execucao
npm run test:watch     # modo watch
npm test -- MoneyInput.test.js          # um arquivo
npm test -- --testNamePattern="null"    # por nome
npm test -- --coverage                  # com cobertura
```

Configuracao em `jest.config.js` (`next/jest`, ambiente jsdom, alias `@/` para `src/`) e `jest.setup.js` (`@testing-library/jest-dom`).

## Estado atual (2026-09-28)

| Suite | Casos | Cobre |
|---|---|---|
| `src/components/MoneyInput.test.js` | 14 | formatacao de centavos para `R$` e parse da digitacao |
| `src/components/IncomesManager.test.js` | 6 | soma das receitas fixas com `income` null/undefined |
| Total | 20 passaram, 0 falharam, 0 skip | |

Limitacao: os dois arquivos reimplementam a logica dentro do proprio teste e nao importam os componentes de `src/`. Uma regressao no componente real nao faz esses testes falharem. `@testing-library/react` 16 e `@testing-library/dom` 10 estao instalados e compativeis com React 19, entao o proximo passo e renderizar os componentes de verdade.

## Sem cobertura

- `Dashboard.js`: divisao de parcelas, agrupamento por descricao/dia, carregamento por mes
- `receiptParser.js`: funcoes puras, candidato imediato a teste unitario
- `receiptOCR.js`, `LoginPage.js`, `ReceiptsTab.js`, `ReceiptUpload.js`, `StoreComparison.js`
- qualquer chamada ao Supabase (sem mock configurado)

## Proximos passos

- [ ] Testes de `receiptParser.js` com textos reais de nota
- [ ] Render dos componentes com `@testing-library/react` e mock de `@/lib/supabaseClient`
- [ ] Testes da divisao de parcelas em `Dashboard.js` (valor por parcela e resto na ultima)
- [ ] E2E com Playwright
