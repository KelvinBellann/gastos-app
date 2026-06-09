# 💳 Guia de Controle de Pagamentos

## 📋 Passo 1: Executar o SQL no Supabase

1. Abra https://supabase.com
2. Vá para **SQL Editor**
3. Copie TODO o conteúdo de `PAYMENT_CONTROL_MIGRATION.sql`
4. Cole no editor
5. Clique em **▶️ RUN**

Você verá mensagens de sucesso como:
```
ALTER TABLE
CREATE INDEX
COMMENT
```

---

## 🎯 Passo 2: Nova Interface de Gastos

Após executar o SQL, a interface de "Novo gasto" será assim:

### **Seção 1: Informações Básicas**
- Categoria
- Descrição
- Valor

### **Seção 2: Forma de Pagamento** (NOVO!)
```
Forma de Pagamento:
[v] Débito / PIX / Crédito

Parcelas: (aparece apenas para crédito)
[1] [2] [3] [4] [5] [6] [7] [8] [9] [10] [11] [12]
```

### **Seção 3: Status de Pagamento** (NOVO!)
```
☐ Já foi pago?
  ↓ Se marcar, aparece:
  Data do pagamento: [__/__/____]
```

---

## 💡 Exemplos de Uso

### **Exemplo 1: Débito (Já Pago)**
- Descrição: Gasolina
- Valor: 100
- Forma: Débito
- ☑ Já foi pago?
- Data: 09/06/2026

**Resultado:**
```
🚗 Gasolina - 100,00
Débito | Pago em 09/06/2026
```

### **Exemplo 2: Crédito (3 Parcelas, Ainda Não Pago)**
- Descrição: Faculdade
- Valor: 1.500
- Forma: Crédito
- Parcelas: 3
- ☐ Já foi pago? (desmarcado)

**Resultado:**
```
🏫 Faculdade - 1.500,00
Crédito | 3x de 500,00 | Pendente
```

### **Exemplo 3: PIX (Já Pago)**
- Descrição: Restaurante
- Valor: 85
- Forma: PIX
- ☑ Já foi pago?
- Data: 08/06/2026

**Resultado:**
```
🍽️ Restaurante - 85,00
PIX | Pago em 08/06/2026
```

---

## 📊 Visualização na Lista

### **Gastos Agrupados com Pagamento**
```
🏋️ Academia - 220 ×2         [▼] [✎] [✕]
  Débito | Pendente
  
  ├─ 110,00 (Débito - Pendente) [✎] [✕]
  └─ 110,00 (Débito - Pago)      [✎] [✕]
```

---

## 🎨 Ícones de Forma de Pagamento

- 💳 Crédito
- 🏧 Débito
- 📱 PIX

---

## 📈 Filtros Futuros (Opcional)

Com esse controle, você poderá:
- ✅ Ver gastos pagos vs pendentes
- ✅ Ver quanto falta pagar no crédito
- ✅ Acompanhar parcelas
- ✅ Gerar relatório de débitos

---

## ❓ Dúvidas Frequentes

**P: Se eu pago em 3 vezes no crédito, devo adicionar 1 gasto ou 3?**
R: Apenas 1 gasto! A app controla as 3 parcelas automaticamente.

**P: Posso editar a forma de pagamento depois?**
R: Sim! Clique em ✎ e edite.

**P: Se marcar "Pago", o valor sai do saldo?**
R: Não, o valor sempre conta para o saldo. "Pago" é apenas para controle.

**P: Débito e PIX são iguais?**
R: Na maioria das vezes sim! Use Débito para débito em conta, PIX para transferências.

---

## ✅ Próximas Etapas

1. Execute o SQL acima
2. Atualize a página (F5)
3. Teste adicionando um gasto com crédito
4. Veja o sistema funcionando!

**Pronto para usar!** 🚀
