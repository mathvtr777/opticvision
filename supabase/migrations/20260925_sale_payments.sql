-- ===========================================================================
-- MIGRAÇÃO: Sistema de Pagamentos Parciais e Parcelamentos
-- Execute este script no SQL Editor do Supabase (projeto: ijdjrlcmcnkgvyromxev)
-- ===========================================================================

-- 1. Adicionar colunas na tabela sales (compatível com dados existentes)
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Atualizar vendas existentes: considerar como pagas (retrocompatibilidade)
UPDATE public.sales
  SET payment_status = 'paid',
      paid_amount = total_amount
  WHERE paid_amount = 0;

-- 2. Criar tabela de recebimentos (múltiplos pagamentos por venda)
CREATE TABLE IF NOT EXISTS public.sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sale_payments' AND policyname = 'Users can manage own sale_payments'
  ) THEN
    CREATE POLICY "Users can manage own sale_payments"
      ON public.sale_payments FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Gerar recebimentos para as vendas existentes (retrocompatibilidade)
-- Para cada venda que já está paga, criar um registro de recebimento
INSERT INTO public.sale_payments (sale_id, user_id, amount, payment_method, payment_date, notes)
SELECT
  s.id,
  s.user_id,
  s.total_amount,
  s.payment_method,
  COALESCE(s.created_at::DATE, CURRENT_DATE),
  'Migração automática - pagamento original'
FROM public.sales s
WHERE s.payment_status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM public.sale_payments sp WHERE sp.sale_id = s.id
  );
