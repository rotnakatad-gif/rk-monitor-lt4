import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPREADSHEET_ID = '1B2UPHU3uRAa6ixwEjYxNbCiUkBIg_31Dkh6W3g9_Nvc';
const SHEET_TAB = 'Realisasi_Entries';
const GATEWAY = 'https://connector-gateway.lovable.dev/google_sheets/v4';

const HEADERS = [
  'Tanggal Entry', 'Tahun', 'Bulan', 'Program', 'Kegiatan', 'Sub Kegiatan',
  'Belanja', 'Sumber Dana', 'Nilai Realisasi', 'Kode RUP', 'No Kode Paket',
  'No Surat Pesanan', 'Keterangan', 'Bukti URL', 'Bukti Filename', 'Entry ID'
];

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

async function gw(url: string, opts: RequestInit = {}, lovableKey: string, sheetsKey: string) {
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
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!res.ok) {
    throw new Error(`Sheets API ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

async function ensureSheetTab(lovableKey: string, sheetsKey: string) {
  const meta = await gw(`${GATEWAY}/spreadsheets/${SPREADSHEET_ID}`, {}, lovableKey, sheetsKey);
  const exists = (meta?.sheets || []).some((s: any) => s?.properties?.title === SHEET_TAB);
  if (exists) return;

  await gw(`${GATEWAY}/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: SHEET_TAB } } }],
    }),
  }, lovableKey, sheetsKey);

  // write headers
  await gw(`${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_TAB}!A1:P1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [HEADERS] }),
  }, lovableKey, sheetsKey);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const sheetsKey = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    if (!lovableKey) throw new Error('LOVABLE_API_KEY missing');
    if (!sheetsKey) throw new Error('GOOGLE_SHEETS_API_KEY missing (Google Sheets connector belum tersambung)');

    const { entry_id } = await req.json();
    if (!entry_id) throw new Error('entry_id required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: row, error } = await supabase
      .from('realisasi_entries').select('*').eq('id', entry_id).single();
    if (error || !row) throw new Error(`Entry not found: ${error?.message}`);

    let buktiUrl = '';
    if (row.bukti_path) {
      const { data: pub } = supabase.storage.from('bukti-realisasi').getPublicUrl(row.bukti_path);
      buktiUrl = pub.publicUrl;
    }

    await ensureSheetTab(lovableKey, sheetsKey);

    const values = [[
      new Date(row.created_at).toISOString(),
      row.tahun,
      BULAN[row.bulan - 1] || row.bulan,
      row.program,
      row.kegiatan,
      row.sub_kegiatan,
      row.belanja,
      row.sumber_dana,
      Number(row.nilai_realisasi),
      row.kode_rup || '',
      row.no_kode_paket || '',
      row.no_surat_pesanan || '',
      row.keterangan || '',
      buktiUrl,
      row.bukti_filename || '',
      row.id,
    ]];

    await gw(
      `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_TAB}!A:P:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values }) },
      lovableKey, sheetsKey,
    );

    await supabase.from('realisasi_entries')
      .update({ synced_to_sheet: true, synced_at: new Date().toISOString() })
      .eq('id', entry_id);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('sync-to-sheet error:', msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
