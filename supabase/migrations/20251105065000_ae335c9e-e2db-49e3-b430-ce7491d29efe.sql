-- Fix security warnings for existing functions
-- Update update_updated_at_column function with search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Update handle_new_user function (already has search_path, but ensuring it's correct)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, establishment_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'establishment_name', 'Meu Estabelecimento')
  );
  RETURN NEW;
END;
$function$;