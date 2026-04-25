// Hapus 1 entry: DB row + bukti file + baris di sheet Realisasi_Entries (cari via Entry ID di kolom P)
// Setelah ini, polling sync-from-sheet akan otomatis recompute kolom U..AF di tab Data.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHEET_ID = '1tLWXV07F2aTZWy9iTbxOoSpvKfJrfYzVcAG36AjnMmI';
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
    const { entry_id } = await req.json();
    if (!entry_id) throw new Error('entry_id required');

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Ambil data entry dulu (butuh bukti_path)
    const { data: row } = await sb.from('realisasi_entries').select('bukti_path').eq('id', entry_id).single();

    // 2. Hapus file bukti
    if (row?.bukti_path) {
      await sb.storage.from('bukti-realisasi').remove([row.bukti_path]);
    }

    // 3. Hapus row DB
    const { error: delErr } = await sb.from('realisasi_entries').delete().eq('id', entry_id);
    if (delErr) throw new Error(`DB delete: ${delErr.message}`);

    // 4. Hapus baris di sheet Realisasi_Entries (cari via Entry ID di kolom P)
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const sheetsKey = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    let sheetResult: any = { skipped: true };
    if (lovableKey && sheetsKey) {
      try {
        // Ambil kolom P (Entry ID) untuk cari row index
        const idsRes = await gw(
          `${GATEWAY}/spreadsheets/${SHEET_ID}/values/${LOG_TAB}!P2:P`,
          {}, lovableKey, sheetsKey,
        );
        const ids: string[][] = idsRes?.values || [];
        let foundRow = -1;
        for (let i = 0; i < ids.length; i++) {
          if ((ids[i]?.[0] || '').trim() === entry_id) { foundRow = i + 2; break; }
        }
        if (foundRow > 0) {
          // Cari sheetId numeric dari LOG_TAB
          const meta = await gw(`${GATEWAY}/spreadsheets/${SHEET_ID}`, {}, lovableKey, sheetsKey);
          const sheet = (meta?.sheets || []).find((s: any) => s?.properties?.title === LOG_TAB);
          const sheetId = sheet?.properties?.sheetId;
          if (sheetId !== undefined) {
            await gw(`${GATEWAY}/spreadsheets/${SHEET_ID}:batchUpdate`, {
              method: 'POST',
              body: JSON.stringify({
                requests: [{
                  deleteDimension: {
                    range: { sheetId, dimension: 'ROWS', startIndex: foundRow - 1, endIndex: foundRow },
                  },
                }],
              }),
            }, lovableKey, sheetsKey);
            sheetResult = { ok: true, deleted_row: foundRow };
          }
        } else {
          sheetResult = { ok: true, not_in_sheet: true };
        }
      } catch (e) {
        sheetResult = { ok: false, error: String(e) };
      }
    }

    return new Response(JSON.stringify({ ok: true, sheet: sheetResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
