-- ===================================
-- ADICIONAR COLUNAS DE PAGAMENTO
-- ===================================
-- COPIE E COLE NO SQL EDITOR DO SUPABASE

-- 1. ADICIONAR COLUNAS À TABELA expenses
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'debit',
ADD COLUMN IF NOT EXISTS installments BIGINT DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS paid_date DATE;

-- 2. CRIAR ÍNDICE
CREATE INDEX IF NOT EXISTS idx_expenses_payment_status
  ON expenses(user_id, is_paid, payment_method);

-- 3. VERIFICAR AS COLUNAS CRIADAS
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'expenses'
ORDER BY ordinal_position;

-- Se tudo funcionou, você verá:
-- column_name          | data_type | column_default
-- ==========================================
-- id                   | uuid      |
-- user_id              | uuid      |
-- month_key            | text      |
-- category             | text      |
-- description          | text      |
-- amount_cents         | bigint    |
-- date                 | date      |
-- created_at           | timestamp |
-- updated_at           | timestamp |
-- payment_method       | text      | 'debit'::text
-- installments         | bigint    | 1
-- is_paid              | boolean   | false
-- paid_date            | date      |

-- Se as colunas não aparecerem, tente executar APENAS este comando:
-- ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'debit';
-- ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS installments BIGINT DEFAULT 1;
-- ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;
-- ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS paid_date DATE;
