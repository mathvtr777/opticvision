import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

let SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// A chave anônima pode estar definida como VITE_SUPABASE_ANON_KEY ou, como
// neste projeto, como VITE_SUPABASE_PUBLISHABLE_KEY. Lemos as duas: se a
// primeira estiver ausente, usamos a segunda. Antes, ler só a primeira fazia
// o client cair no placeholder e o banco retornar 'invalid api key'.
let SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Higieniza as chaves removendo aspas duplas, simples ou espaços que
// frequentemente causam o erro 'invalid api key' ao serem lidos do .env
if (SUPABASE_URL === 'undefined') SUPABASE_URL = undefined;
if (SUPABASE_ANON_KEY === 'undefined') SUPABASE_ANON_KEY = undefined;

SUPABASE_URL = SUPABASE_URL?.replace(/['"]/g, '')?.trim()?.replace(/\/rest\/v1\/?$/, '');
SUPABASE_ANON_KEY = SUPABASE_ANON_KEY?.replace(/['"]/g, '')?.trim();

// Placeholders VÁLIDOS usados apenas quando as variáveis de ambiente estão
// ausentes. O createClient do supabase-js lança uma exceção se receber uma URL
// vazia ou inválida, e como este módulo é importado na inicialização, esse
// erro derrubava toda a árvore React durante a importação e deixava a tela em
// branco. Passando valores bem formados, o app renderiza normalmente; as
// chamadas ao banco falham em runtime e caem nos toasts de erro das páginas.
const FALLBACK_URL = 'https://placeholder.supabase.co';
const FALLBACK_ANON_KEY = 'public-anon-key-placeholder';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    'Variáveis de ambiente do Supabase ausentes. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Usando valores placeholder para evitar tela em branco.'
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(
  SUPABASE_URL || FALLBACK_URL,
  SUPABASE_ANON_KEY || FALLBACK_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
