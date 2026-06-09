# 🆘 CORRIGIR ERRO DE PAGAMENTO

Se você viu o erro "Supabase error details: {}", significa que as colunas de pagamento ainda não foram adicionadas.

---

## 📋 PASSO-A-PASSO RÁPIDO

### 1️⃣ **Abra o Supabase**
- URL: https://supabase.com
- Entre no projeto

### 2️⃣ **Vá para SQL Editor**
- Menu esquerdo → **SQL Editor**
- Clique em **New Query**

### 3️⃣ **Copie ESTE SQL EXATO:**

```sql
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'debit';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS installments BIGINT DEFAULT 1;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_date DATE;

SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'expenses' ORDER BY ordinal_position;
```

### 4️⃣ **Cole no editor e clique em RUN**

### 5️⃣ **Você verá:**
```
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE

(resultado do SELECT com todas as colunas)
```

---

## ✅ VERIFICAR SE FUNCIONOU

Na tabela de resultado do SELECT, procure por estas linhas:
- `payment_method` | `text`
- `installments` | `bigint`
- `is_paid` | `boolean`
- `paid_date` | `date`

Se aparecerem, **tudo funcionou!** ✓

---

## 🔄 DEPOIS DE EXECUTAR

1. **Atualize a página** da app (F5 ou Ctrl+R)
2. **Teste adicionar um gasto** novamente
3. **Agora deve funcionar!** ✅

---

## ❌ SE AINDA NÃO FUNCIONAR

Tente este SQL alternativo:

```sql
-- Adicionar cada coluna uma por uma
ALTER TABLE IF EXISTS expenses 
ADD COLUMN payment_method TEXT DEFAULT 'debit';

ALTER TABLE IF EXISTS expenses 
ADD COLUMN installments BIGINT DEFAULT 1;

ALTER TABLE IF EXISTS expenses 
ADD COLUMN is_paid BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS expenses 
ADD COLUMN paid_date DATE;

-- Verificar
SELECT * FROM expenses LIMIT 1;
```

---

## 💡 DICA

Se receber erro "column already exists", significa que as colunas já foram adicionadas!
Nesse caso, apenas atualize a página (F5) e teste novamente.

---

**Aviso:** Não delete nem renomeie as colunas depois. Elas são essenciais!

---

## 🆘 ÚLTIMA OPÇÃO

Se nada funcionar, envie a mensagem de erro exata que aparece no SQL Editor.
