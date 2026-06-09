# Testing Guide - Gastos App

## Visão Geral

Este documento descreve a estratégia de testes para a aplicação Gastos App.

## Configuração

### Instalação de Dependências

```bash
npm install
```

### Executar Testes

```bash
# Rodar testes uma vez
npm test

# Rodar testes em modo watch (auto-rerun ao salvar)
npm test:watch
```

## Cobertura de Testes

### 1. **MoneyInput Component** (`MoneyInput.test.js`)

Testa o componente principal de entrada de valores monetários:

- ✅ Renderização com label
- ✅ Formatação correta de valores (ex: 250000 centavos → 2.500,00)
- ✅ Tratamento de valores vazios
- ✅ Conversão de entrada do usuário para centavos
- ✅ Remoção de caracteres não-numéricos
- ✅ Manejo de zero
- ✅ Atualização quando props mudam
- ✅ Limpeza de input
- ✅ Estado desabilitado
- ✅ Formatação de valores grandes

### 2. **IncomesManager Component** (`IncomesManager.test.js`)

Testa o gerenciador de receitas fixas e variáveis:

- ✅ Renderização de seção de receitas fixas
- ✅ Exibição correta de valores
- ✅ **Segurança: Não quebra quando `income` é null**
- ✅ **Segurança: Não quebra quando `income` é undefined**
- ✅ Callback correto ao mudar valores
- ✅ Renderização de receitas variáveis
- ✅ Mensagem quando não há receitas variáveis
- ✅ Exibição correta de totais
- ✅ Renderização de todos os labels de receita

### 3. **Money Conversion Utilities** (`moneyUtils.test.js`)

Testa as funções de conversão de moeda:

- ✅ Conversão de centavos para BRL
- ✅ Tratamento de zero
- ✅ Tratamento de null/undefined
- ✅ Formatação de valores grandes
- ✅ Conversão de string BRL para centavos
- ✅ Remoção de símbolos de moeda
- ✅ Validação de entrada inválida
- ✅ Roundtrip conversion (ida e volta)

## Problemas Identificados e Testados

### 1. **Null Income Bug** ✅ CORRIGIDO

**Problema:** Quando `income` era null, o código tentava fazer spread (`{...income}`), causando erro.

**Solução:** Envolver MoneyInputs em verificação `if (income)` no IncomesManager.

**Teste:** `IncomesManager.test.js` testa cenários com `income={null}` e `income={undefined}`.

### 2. **Stale Closure References** ✅ CORRIGIDO

**Problema:** Variáveis capturadas em closures ficavam desatualizada quando o estado mudava.

**Solução:** Usar funções de callback nos `setStates` para acessar sempre o valor mais recente.

**Testes:** Cobertura em `MoneyInput.test.js` para garantir que mudanças de props são refletidas.

### 3. **Type Validation** ✅ CORRIGIDO

**Problema:** `typeof amount === 'number'` poderia falhar em edge cases.

**Solução:** Usar `Number.isInteger()` para validação robusta.

**Testes:** `moneyUtils.test.js` testa conversões com vários tipos de entrada.

## Executando Testes Específicos

```bash
# Rodar apenas testes do MoneyInput
npm test -- MoneyInput.test.js

# Rodar apenas testes do IncomesManager
npm test -- IncomesManager.test.js

# Rodar testes com padrão de nome
npm test -- --testNamePattern="null"

# Rodar com cobertura
npm test -- --coverage
```

## Fluxo de Desenvolvimento Recomendado

1. **Fazer uma mudança de código**
2. **Rodar testes:** `npm test:watch`
3. **Corrigir falhas antes de fazer push**
4. **Confirmar que testes passam**
5. **Fazer commit com testes passando**

## Cobertura de Testes

Alvo: **Mínimo 80% de cobertura** para funcionalidades críticas

- ✅ Entrada de dados
- ✅ Conversão de moeda
- ✅ Manejo de erros
- ✅ Estados null/undefined

## Integrando com CI/CD

Quando integrar com GitHub Actions/Vercel, adicionar:

```yaml
- name: Run Tests
  run: npm test -- --coverage

- name: Check Coverage
  run: npm test -- --coverage --passWithNoTests
```

## Problemas Comuns

### Erro: "Cannot find module '@/lib/supabaseClient'"

**Solução:** Certificar que `moduleNameMapper` no `jest.config.js` está correto.

### Erro: "ReferenceError: document is not defined"

**Solução:** Usar `testEnvironment: 'jest-environment-jsdom'` no jest.config.js.

### Testes lentos

**Solução:** Usar mocks para Supabase (já configurado em IncomesManager.test.js).

## Próximas Melhorias

- [ ] Testes de integração (e2e com Playwright)
- [ ] Testes de API Supabase
- [ ] Testes de formulários completos
- [ ] Performance tests
- [ ] Visual regression tests
