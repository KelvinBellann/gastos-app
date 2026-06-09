-- ===================================
-- GASTOS APP - DATABASE SETUP
-- ===================================
-- Copie e cole este SQL no SQL Editor do Supabase
-- ===================================

-- 1. CRIAR TABELA DE RECEITAS
CREATE TABLE IF NOT EXISTS incomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "month_key" TEXT NOT NULL, -- Formato: "2024-01"
  salary_net_cents BIGINT DEFAULT 0, -- Salário em centavos
  multibenefits_cents BIGINT DEFAULT 0, -- Multibenefícios em centavos
  food_cents BIGINT DEFAULT 0, -- Vale alimentação em centavos
  spouse_salary_cents BIGINT DEFAULT 0, -- Salário esposa em centavos
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, "month_key")
);

-- 2. CRIAR TABELA DE GASTOS
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "month_key" TEXT NOT NULL, -- Formato: "2024-01"
  category TEXT NOT NULL, -- fixos, mercado, aleatorios, etc
  description TEXT NOT NULL, -- O que foi gasto
  amount_cents BIGINT NOT NULL, -- Valor em centavos
  date DATE NOT NULL, -- Data do gasto
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 3. CRIAR TABELA DE RECEITAS VARIÁVEIS
CREATE TABLE IF NOT EXISTS variable_incomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "month_key" TEXT NOT NULL, -- Formato: "2024-01"
  description TEXT NOT NULL, -- Ex: Bônus, Freelance
  amount_cents BIGINT NOT NULL, -- Valor em centavos
  date_from DATE NOT NULL, -- Data inicial
  date_to DATE NOT NULL, -- Data final
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- ===================================
-- CRIAR ÍNDICES PARA PERFORMANCE
-- ===================================

CREATE INDEX IF NOT EXISTS incomes_user_id_month_key
  ON incomes(user_id, "month_key");

CREATE INDEX IF NOT EXISTS expenses_user_id_month_key
  ON expenses(user_id, "month_key");

CREATE INDEX IF NOT EXISTS expenses_user_id_date
  ON expenses(user_id, date);

CREATE INDEX IF NOT EXISTS variable_incomes_user_id_month_key
  ON variable_incomes(user_id, "month_key");

-- ===================================
-- ATIVAR ROW LEVEL SECURITY (RLS)
-- ===================================

-- Ativar RLS para a tabela incomes
ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;

-- Ativar RLS para a tabela expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Ativar RLS para a tabela variable_incomes
ALTER TABLE variable_incomes ENABLE ROW LEVEL SECURITY;

-- ===================================
-- CRIAR POLÍTICAS DE SEGURANÇA
-- ===================================

-- INCOMES - Usuário só pode ver seus próprios dados
CREATE POLICY "Users can view own incomes" ON incomes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own incomes" ON incomes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own incomes" ON incomes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own incomes" ON incomes
  FOR DELETE
  USING (auth.uid() = user_id);

-- EXPENSES - Usuário só pode ver seus próprios gastos
CREATE POLICY "Users can view own expenses" ON expenses
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses" ON expenses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses" ON expenses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses" ON expenses
  FOR DELETE
  USING (auth.uid() = user_id);

-- VARIABLE_INCOMES - Usuário só pode ver suas receitas variáveis
CREATE POLICY "Users can view own variable incomes" ON variable_incomes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own variable incomes" ON variable_incomes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own variable incomes" ON variable_incomes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own variable incomes" ON variable_incomes
  FOR DELETE
  USING (auth.uid() = user_id);

-- ===================================
-- CRIAR FUNÇÕES PARA ATUALIZAR updated_at
-- ===================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para incomes
CREATE TRIGGER update_incomes_updated_at BEFORE UPDATE ON incomes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para expenses
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para variable_incomes
CREATE TRIGGER update_variable_incomes_updated_at BEFORE UPDATE ON variable_incomes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================
-- COMENTÁRIOS SOBRE AS TABELAS
-- ===================================
COMMENT ON TABLE incomes IS 'Receitas fixas mensais (salário, benefícios, alimentação)';
COMMENT ON TABLE expenses IS 'Gastos mensais por categoria';
COMMENT ON TABLE variable_incomes IS 'Receitas variáveis com período específico (bônus, freelance)';

COMMENT ON COLUMN expenses.amount_cents IS 'Valor em centavos (ex: 10000 = R$ 100,00)';
COMMENT ON COLUMN incomes.salary_net_cents IS 'Salário líquido em centavos';
COMMENT ON COLUMN variable_incomes.amount_cents IS 'Valor em centavos';
