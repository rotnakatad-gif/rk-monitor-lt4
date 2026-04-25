// Reset penuh:
//  - hapus semua row di realisasi_entries
//  - kosongkan semua file di bucket bukti-realisasi
//  - kosongkan tab Realisasi_Entries (kecuali header)
//  - kosongkan kolom U..AF di tab Data
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHEET_ID = '1tLWXV07F2aTZWy9iTbxOoSpvKfJrfYzVcAG36AjnMmI';
const DATA_TAB = 'Data';
const LOG_TAB = 'Realisasi_Entries';
const GATEWAY = 'https://connector-gateway.lovable.dev/google_sheets/v4';

async function gw(url: string, opts: RequestInit, lovableKey: string, sheetsKey: string) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': sheetsKey,
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Sheets ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Hapus semua file di bucket
    const removeAll = async (prefix = '') => {
      const { data: items } = await sb.storage.from('bukti-realisasi').list(prefix, { limit: 1000 });
      if (!items) return;
      for (const it of items) {
        const path = prefix ? `${prefix}/${it.name}` : it.name;
        if (it.id === null) await removeAll(path);
        else await sb.storage.from('bukti-realisasi').remove([path]);
      }
    };
    await removeAll('');

    // 2. Hapus semua row di DB
    await sb.from('realisasi_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 3. Reset sheet (jika connector tersambung)
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const sheetsKey = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    let sheetReset: any = { skipped: 'no connector' };
    if (lovableKey && sheetsKey) {
      // 3a. Kosongkan semua isi log (kecuali header A1:P1)
      try {
        await gw(
          `${GATEWAY}/spreadsheets/${SHEET_ID}/values/${LOG_TAB}!A2:P:clear`,
          { method: 'POST', body: '{}' },
          lovableKey, sheetsKey,
        );
      } catch (e) {
        sheetReset.log_error = String(e);
      }
      // 3b. Kosongkan kolom U..AF di tab Data
      try {
        await gw(
          `${GATEWAY}/spreadsheets/${SHEET_ID}/values/${DATA_TAB}!U2:AF:clear`,
          { method: 'POST', body: '{}' },
          lovableKey, sheetsKey,
        );
      } catch (e) {
        sheetReset.data_error = String(e);
      }
      sheetReset.ok = !sheetReset.log_error && !sheetReset.data_error;
    }

    return new Response(JSON.stringify({ ok: true, sheetReset }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
