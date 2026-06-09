# 💳 Guia de Controle Inteligente de Parcelas

## 🎯 **Nova Lógica (Agora Implementada!)**

Agora o app **automaticamente** coloca os gastos de crédito no mês correto!

---

## 📋 **PASSO 1: Atualizar o Banco de Dados**

1. Abra https://supabase.com
2. **SQL Editor** → **New Query**
3. Copie o SQL de `INSTALLMENT_MONTH_MIGRATION.sql`:

```sql
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS installment_month TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS installment_number BIGINT DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_expenses_installment_month
  ON expenses(user_id, installment_month);
```

4. Clique em **RUN ▶️**

---

## ✅ **Como Funciona Agora**

### **Exemplo 1: Presente em Junho | Crédito 1x | R$ 693,89**

**O que você faz:**
- Data: Junho
- Descrição: Presente
- Valor: 693,89
- Forma: Crédito
- Parcelas: 1x

**O que aparece:**

| Mês | Descrição | Valor | Status |
|-----|-----------|-------|--------|
| **Junho** | Presente (1/1) | 693,89 | ⏳ Pendente (sai em julho) |
| **Julho** | Presente (1/1) | 693,89 | ✅ Pago |
| **Agosto** | — | — | — |

**Resultado:** Só aparece em julho (quando realmente sai) ✓

---

### **Exemplo 2: Compra em Junho | Crédito 2x | R$ 500,00**

**O que você faz:**
- Data: Junho
- Descrição: Produto
- Valor: 500,00
- Forma: Crédito
- Parcelas: 2x

**O que aparece:**

| Mês | Descrição | Valor | Status |
|-----|-----------|-------|--------|
| **Junho** | Produto (1/2) | 250,00 | ⏳ Pendente (sai em julho) |
| **Junho** | Produto (2/2) | 250,00 | ⏳ Pendente (sai em agosto) |
| **Julho** | Produto (1/2) | 250,00 | ✅ Pago |
| **Agosto** | Produto (2/2) | 250,00 | ✅ Pago |
| **Setembro** | — | — | — |

**Resultado:** Parcela 1 em julho, parcela 2 em agosto ✓

---

### **Exemplo 3: Gasolina em Junho | Débito | R$ 85,00**

**O que você faz:**
- Data: Junho
- Descrição: Gasolina
- Valor: 85,00
- Forma: Débito
- Já pago: ☑ Sim

**O que aparece:**

| Mês | Descrição | Valor | Status |
|-----|-----------|-------|--------|
| **Junho** | Gasolina | 85,00 | ✅ Pago |
| **Julho** | — | — | — |

**Resultado:** Aparece em junho (saiu na hora) ✓

---

## 🔄 **Como o App Funciona Agora**

### **Débito / PIX:**
```
Você gasta em JUNHO
↓
Aparece em JUNHO (desconta do saldo imediatamente)
```

### **Crédito 1x:**
```
Você gasta em JUNHO
↓
Aparece em JUNHO como "Pendente (sai em julho)"
↓
Aparece em JULHO como "Pago" (desconta do saldo)
↓
Não aparece em AGOSTO
```

### **Crédito 2x:**
```
Você gasta 500 em JUNHO
↓
Cria 2 parcelas de 250 cada
↓
Aparece em JUNHO como "Pendente"
↓
Parcela 1 aparece em JULHO como "Pago"
Parcela 2 aparece em AGOSTO como "Pago"
↓
Não aparece em SETEMBRO
```

---

## 📊 **Visualização na Tela**

### **Lista de Gastos do Mês**

**Junho:**
```
🎁 Presente (1/1) - 693,89
💳 Crédito | ⏳ Pendente (sai em julho)

🛍️ Produto (1/2) - 250,00
💳 Crédito | ⏳ Pendente (sai em julho)

🛍️ Produto (2/2) - 250,00
💳 Crédito | ⏳ Pendente (sai em agosto)

⛽ Gasolina - 85,00
🏧 Débito | ✅ Pago
```

**Julho:**
```
🎁 Presente (1/1) - 693,89
💳 Crédito | ✅ Pago em 01/07

🛍️ Produto (1/2) - 250,00
💳 Crédito | ✅ Pago em 01/07
```

**Agosto:**
```
🛍️ Produto (2/2) - 250,00
💳 Crédito | ✅ Pago em 01/08
```

---

## 💰 **Saldo Correto Agora**

### **Junho:**
```
Receitas:    R$ 3.000,00
Gastos:      R$ 85,00 (só débito/pix)
             + R$ 500,00 (crédito pendente, mas não desconta ainda)
Saldo Real:  R$ 2.915,00 ✅ (correto!)
```

### **Julho:**
```
Receitas:    R$ 3.000,00
Gastos:      R$ 693,89 + R$ 250,00 = R$ 943,89
Saldo Real:  R$ 2.056,11 ✅ (correto!)
```

### **Agosto:**
```
Receitas:    R$ 3.000,00
Gastos:      R$ 250,00 (segunda parcela)
Saldo Real:  R$ 2.750,00 ✅ (correto!)
```

---

## ✨ **Benefícios**

✅ Saldo sempre **correto e realista**
✅ Você vê quando vai sair do banco
✅ Parcelas aparecem no mês correto
✅ Controle total de fluxo de caixa
✅ Sem surpresas no fim do mês

---

## 🚀 **Próximo Passo**

1. Execute o SQL acima
2. Atualize a página (F5)
3. Teste adicionando uma compra com crédito 2x
4. Veja a mágica acontecer! ✨

---

**Seu app agora tem controle inteligente de parcelas!** 🎯
