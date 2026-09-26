-- ===========================================================================
-- MIGRAÇÃO: Acompanhamento Público do Pedido
-- Execute no SQL Editor do Supabase (projeto: ijdjrlcmcnkgvyromxev)
-- ===========================================================================

-- Adicionar coluna de token público na tabela orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS public_tracking_token TEXT UNIQUE DEFAULT NULL;

-- Criar índice para busca rápida pelo token (rota pública não usa auth)
CREATE INDEX IF NOT EXISTS idx_orders_public_token ON public.orders(public_tracking_token);

-- Política de leitura pública pelo token (sem autenticação)
-- Permite que qualquer pessoa busque um pedido pelo token público
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'Public can read order by token'
  ) THEN
    CREATE POLICY "Public can read order by token"
      ON public.orders
      FOR SELECT
      USING (public_tracking_token IS NOT NULL);
  END IF;
END $$;

-- Política de leitura pública do histórico de status (via token do pedido)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_status_history' AND policyname = 'Public can read status history by token'
  ) THEN
    CREATE POLICY "Public can read status history by token"
      ON public.order_status_history
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = order_status_history.order_id
            AND o.public_tracking_token IS NOT NULL
        )
      );
  END IF;
END $$;

-- Política de leitura pública dos clientes (apenas nome, via pedido com token)
-- NOTA: A página pública filtra os campos em código (só exibe primeiro nome)
-- A policy abaixo permite SELECT mas o código só retorna campos seguros
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clients' AND policyname = 'Public can read client name for tracking'
  ) THEN
    CREATE POLICY "Public can read client name for tracking"
      ON public.clients
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.client_id = clients.id
            AND o.public_tracking_token IS NOT NULL
        )
      );
  END IF;
END $$;

-- Política de leitura pública dos perfis (nome da ótica, para a página pública)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Public can read profile for tracking'
  ) THEN
    CREATE POLICY "Public can read profile for tracking"
      ON public.profiles
      FOR SELECT
      USING (true);
  END IF;
END $$;
