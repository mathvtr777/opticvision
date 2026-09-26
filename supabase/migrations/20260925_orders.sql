-- ===========================================================================
-- MIGRAÇÃO: Módulo de Pedidos
-- Execute no SQL Editor do Supabase (projeto: ijdjrlcmcnkgvyromxev)
-- ===========================================================================

-- 1. Tabela de Laboratórios
CREATE TABLE IF NOT EXISTS public.laboratories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.laboratories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'laboratories' AND policyname = 'Users can manage own laboratories') THEN
    CREATE POLICY "Users can manage own laboratories" ON public.laboratories FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_laboratories_updated_at ON public.laboratories;
CREATE TRIGGER update_laboratories_updated_at
  BEFORE UPDATE ON public.laboratories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabela de Pedidos
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number INTEGER NOT NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  seller_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sale_created',
  -- Laboratório
  laboratory_id UUID REFERENCES public.laboratories(id) ON DELETE SET NULL,
  lab_order_number TEXT,
  lab_sent_date DATE,
  lab_estimated_delivery DATE,
  lab_received_date DATE,
  lab_notes TEXT,
  -- Entrega
  estimated_delivery DATE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  -- Observações
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Users can manage own orders') THEN
    CREATE POLICY "Users can manage own orders" ON public.orders FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Função para número sequencial de pedido por usuário
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.order_number := COALESCE(
    (SELECT MAX(order_number) FROM public.orders WHERE user_id = NEW.user_id),
    0
  ) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_number ON public.orders;
CREATE TRIGGER trg_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para buscas frequentes
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON public.orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_sale_id ON public.orders(sale_id);

-- 3. Histórico de Status do Pedido (Timeline)
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  notes TEXT,
  changed_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_status_history' AND policyname = 'Users can manage own order_status_history') THEN
    CREATE POLICY "Users can manage own order_status_history"
      ON public.order_status_history FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);
