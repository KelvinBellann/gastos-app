# 🗄️ Guia de Configuração do Supabase

## ⚠️ IMPORTANTE
Se você já tem dados salvos, **FAÇA BACKUP PRIMEIRO**!

---

## 📋 Passo 1: Acessar o Supabase

1. Abra https://supabase.com
2. Faça login com sua conta
3. Selecione seu projeto `gastos-app`

---

## 🔧 Passo 2: Abrir o SQL Editor

1. No menu lateral esquerdo, clique em **SQL Editor**
2. Clique em **New Query** (novo botão verde)
3. Você verá um editor em branco

---

## 📝 Passo 3: Copiar o SQL

1. Abra o arquivo `SUPABASE_SETUP.sql` (está no repositório)
2. **Copie TODO o conteúdo** (Ctrl+A, Ctrl+C)
3. Cole no SQL Editor do Supabase (Ctrl+V)

**OU** copie o SQL abaixo:

```sql
-- Clique no botão de copiar abaixo do SQL
[veja o arquivo SUPABASE_SETUP.sql]
```

---

## ▶️ Passo 4: Executar o SQL

1. Clique no botão **▶️ RUN** (canto superior direito)
2. Aguarde alguns segundos
3. Você verá mensagens de sucesso no console

---

## ✅ Passo 5: Verificar se Funcionou

Se vir mensagens como:
```
CREATE TABLE
CREATE INDEX
ALTER TABLE
CREATE POLICY
CREATE TRIGGER
```

**✅ Tudo funcionou!**

---

## 🗂️ Passo 6: Verificar as Tabelas

1. Ainda no Supabase, clique em **Tables** (menu lateral)
2. Você deverá ver:
   - `incomes` - Receitas fixas
   - `expenses` - Gastos
   - `variable_incomes` - Receitas variáveis

---

## 🚀 Passo 7: Testar a Aplicação

1. Volte para http://localhost:3000
2. Tente adicionar um gasto
3. **Deve funcionar agora!** ✅

---

## ❌ Se Não Funcionar

### Erro: "Relation 'public.expenses' does not exist"
- As tabelas não foram criadas
- Volte ao Passo 3 e execute o SQL novamente

### Erro: "new row violates row-level security policy"
- As políticas RLS não foram aplicadas corretamente
- Verifique se todas as linhas do SQL foram executadas

### Erro: "Invalid user_id"
- Você não está logado ou há problema com autenticação
- Faça logout e login novamente em http://localhost:3000

---

## 📊 O Que Cada Tabela Faz

### `incomes` (Receitas)
Armazena:
- Salário líquido (mensalidade)
- Multibenefícios (vale alimentação, etc)
- Alimentação (vale refeição)
- Salário cônjuge (esposa)

**Formato:** Cada mês tem um registro

### `expenses` (Gastos)
Armazena:
- Categoria (fixos, mercado, etc)
- Descrição (o que foi comprado)
- Valor em centavos
- Data do gasto

**Formato:** Um registro por gasto

### `variable_incomes` (Receitas Variáveis)
Armazena:
- Descrição (Bônus, Freelance, etc)
- Valor em centavos
- Data início e fim

**Formato:** Um registro por receita variável

---

## 🔒 Segurança (RLS)

As políticas **Row Level Security** garantem que:
- ✅ Cada usuário vê **apenas seus próprios dados**
- ✅ Ninguém pode acessar dados de outro usuário
- ✅ Dados são automaticamente filtrados por `user_id`

---

## 💾 Valores em Centavos

**IMPORTANTE:** Todos os valores são armazenados em centavos!

Exemplos:
- R$ 100,00 = `10000` centavos
- R$ 50,50 = `5050` centavos
- R$ 1.000,00 = `100000` centavos

A app converte automaticamente para você! 🎯

---

## 🆘 Precisa de Ajuda?

Se algo não funcionar:
1. Abra o console do navegador (F12)
2. Copie a mensagem de erro completa
3. Tente executar o SQL novamente

Se o erro persistir, todos os detalhes aparecerão no console do navegador.

---

**Depois de concluir tudo, sua app estará 100% funcional!** 🎉
