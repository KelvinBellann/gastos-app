-- Create incomes table
CREATE TABLE IF NOT EXISTS public.incomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  salary_net_cents INTEGER DEFAULT 0,
  multibenefits_cents INTEGER DEFAULT 0,
  food_cents INTEGER DEFAULT 0,
  spouse_salary_cents INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_incomes_user_month ON public.incomes(user_id, month_key);

-- Enable RLS
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own incomes" ON public.incomes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own incomes" ON public.incomes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own incomes" ON public.incomes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own incomes" ON public.incomes
  FOR DELETE USING (auth.uid() = user_id);
