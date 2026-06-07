-- Create receipts table
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  store_name TEXT NOT NULL,
  receipt_date DATE NOT NULL,
  image_url TEXT,
  raw_text TEXT,
  confidence_score INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create receipt_items table
CREATE TABLE IF NOT EXISTS public.receipt_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity DECIMAL(10, 2) DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  total_price_cents INTEGER NOT NULL,
  category TEXT,
  position INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create store_products table for analytics
CREATE TABLE IF NOT EXISTS public.store_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  latest_price_cents INTEGER,
  last_seen_date DATE,
  average_price_cents INTEGER DEFAULT 0,
  min_price_cents INTEGER,
  max_price_cents INTEGER,
  purchase_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, store_name, product_name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_receipts_user_month ON public.receipts(user_id, month_key);
CREATE INDEX IF NOT EXISTS idx_receipts_store ON public.receipts(store_name);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON public.receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_store_products_user ON public.store_products(user_id);

-- Enable RLS
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own receipts" ON public.receipts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own receipts" ON public.receipts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own receipts" ON public.receipts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own receipts" ON public.receipts
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view receipt items for their receipts" ON public.receipt_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.receipts WHERE id = receipt_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert receipt items for their receipts" ON public.receipt_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.receipts WHERE id = receipt_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete receipt items for their receipts" ON public.receipt_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.receipts WHERE id = receipt_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can view their own store products" ON public.store_products
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own store products" ON public.store_products
  FOR ALL USING (auth.uid() = user_id);
