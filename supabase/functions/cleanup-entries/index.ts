import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    // List all files recursively in bucket
    const removeAll = async (prefix = '') => {
      const { data: items } = await sb.storage.from('bukti-realisasi').list(prefix, { limit: 1000 });
      if (!items) return;
      for (const it of items) {
        const path = prefix ? `${prefix}/${it.name}` : it.name;
        if (it.id === null) {
          // folder
          await removeAll(path);
        } else {
          await sb.storage.from('bukti-realisasi').remove([path]);
        }
      }
    };
    await removeAll('');
    const { error } = await sb.from('realisasi_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    return new Response(JSON.stringify({ ok: true, dbError: error?.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
