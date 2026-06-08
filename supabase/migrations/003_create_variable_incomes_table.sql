-- Create variable_incomes table for non-recurring income
CREATE TABLE IF NOT EXISTS public.variable_incomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_variable_incomes_user_month ON public.variable_incomes(user_id, month_key);

-- Enable RLS
ALTER TABLE public.variable_incomes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own variable incomes" ON public.variable_incomes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own variable incomes" ON public.variable_incomes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own variable incomes" ON public.variable_incomes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own variable incomes" ON public.variable_incomes
  FOR DELETE USING (auth.uid() = user_id);
