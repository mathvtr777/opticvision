-- ===========================================================================
-- MIGRAÇÃO: Dados Ópticos, Ajuste Manual de Venda e Observações
-- Execute no SQL Editor do Supabase
-- ===========================================================================

-- 1. Novos campos em CLIENTES
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS dnp_od NUMERIC,
  ADD COLUMN IF NOT EXISTS dnp_oe NUMERIC,
  ADD COLUMN IF NOT EXISTS pupillary_height_od NUMERIC,
  ADD COLUMN IF NOT EXISTS pupillary_height_oe NUMERIC,
  ADD COLUMN IF NOT EXISTS lens_type TEXT;

-- 2. Novos campos em ORDERS (Histórico da Produção)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dnp_od NUMERIC,
  ADD COLUMN IF NOT EXISTS dnp_oe NUMERIC,
  ADD COLUMN IF NOT EXISTS pupillary_height_od NUMERIC,
  ADD COLUMN IF NOT EXISTS pupillary_height_oe NUMERIC,
  ADD COLUMN IF NOT EXISTS lens_type TEXT,
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS final_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS lab_status TEXT DEFAULT 'awaiting_shipment';

-- 3. Novos campos em SALES
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Nova tabela de Auditoria de Ajuste de Preço
CREATE TABLE IF NOT EXISTS public.sale_price_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  original_amount NUMERIC NOT NULL,
  final_amount NUMERIC NOT NULL,
  difference NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.sale_price_adjustments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sale_price_adjustments' AND policyname = 'Users can manage own sale_price_adjustments') THEN
    CREATE POLICY "Users can manage own sale_price_adjustments" 
      ON public.sale_price_adjustments FOR ALL 
      USING (auth.uid() = user_id);
  END IF;
END $$;
