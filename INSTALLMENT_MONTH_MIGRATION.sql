-- ===================================
-- ADICIONAR CONTROLE DE PARCELAS POR MÊS
-- ===================================

-- 1. ADICIONAR COLUNA installment_month
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS installment_month TEXT;

-- 2. ADICIONAR COLUNA installment_number (qual parcela é essa)
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS installment_number BIGINT DEFAULT 1;

-- 3. CRIAR ÍNDICE PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_expenses_installment_month
  ON expenses(user_id, installment_month);

-- 4. COMENTÁRIOS
COMMENT ON COLUMN expenses.installment_month IS 'Mês em que esta parcela será debitada (formato: YYYY-MM)';
COMMENT ON COLUMN expenses.installment_number IS 'Qual parcela é essa (1, 2, 3...)';

-- ===================================
-- VERIFICAÇÃO
-- ===================================
-- Execute este SELECT para verificar as colunas:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'expenses'
ORDER BY ordinal_position;

-- Você deve ver:
-- installment_month (text)
-- installment_number (bigint)
