-- ===================================
-- ADICIONAR CONTROLE DE PAGAMENTOS
-- ===================================
-- Execute este SQL no Supabase SQL Editor

-- 1. ADICIONAR COLUNAS À TABELA expenses
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'debit', -- 'credit', 'debit', 'pix'
ADD COLUMN IF NOT EXISTS installments BIGINT DEFAULT 1, -- Número de parcelas
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false, -- Se foi pago
ADD COLUMN IF NOT EXISTS paid_date DATE, -- Data do pagamento
ADD COLUMN IF NOT EXISTS notes TEXT; -- Notas adicionais

-- 2. CRIAR ÍNDICE PARA PAGAMENTOS NÃO REALIZADOS
CREATE INDEX IF NOT EXISTS expenses_payment_status
  ON expenses(user_id, is_paid, payment_method);

-- 3. COMENTÁRIOS
COMMENT ON COLUMN expenses.payment_method IS 'Forma de pagamento: credit (crédito), debit (débito), pix';
COMMENT ON COLUMN expenses.installments IS 'Número de parcelas (1 para débito/pix, 1-12 para crédito)';
COMMENT ON COLUMN expenses.is_paid IS 'Se o pagamento foi realizado';
COMMENT ON COLUMN expenses.paid_date IS 'Data em que o pagamento foi realizado';
COMMENT ON COLUMN expenses.notes IS 'Notas adicionais sobre o pagamento';

-- ===================================
-- VERIFICAÇÃO
-- ===================================
-- Após executar, as colunas aparecerão em "Tables" > "expenses" com os novos campos:
-- - payment_method (text)
-- - installments (bigint)
-- - is_paid (boolean)
-- - paid_date (date)
-- - notes (text)
