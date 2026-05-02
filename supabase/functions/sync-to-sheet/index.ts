import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Satu spreadsheet untuk semuanya:
//   - tab "Data"               -> sumber anggaran + akumulasi realisasi (kolom U..AF)
//   - tab "Realisasi_Entries"  -> log semua entry realisasi (riwayat per baris)
const SHEET_ID = '1tLWXV07F2aTZWy9iTbxOoSpvKfJrfYzVcAG36AjnMmI';
const SOURCE_SHEET_ID = SHEET_ID;
const LOG_SHEET_ID = SHEET_ID;
const DATA_TAB = 'Data';
const LOG_TAB = 'Realisasi_Entries';
const GATEWAY = 'https://connector-gateway.lovable.dev/google_sheets/v4';

const LOG_HEADERS = [
  'Tanggal Realisasi', 'Tahun', 'Bulan', 'Program', 'Kegiatan', 'Sub Kegiatan',
  'Belanja', 'Sumber Dana', 'Nilai Realisasi', 'Kode RUP', 'No Kode Paket',
  'No Surat Pesanan', 'Keterangan', 'Bukti URL', 'Bukti Filename', 'Entry ID'
];

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// Kolom realisasi bulan ke-N (1..12) di sheet sumber.
// Header: A PROGRAM, B KEGIATAN, C KODE KEG, D SUB KEG, E KODE SUB,
//         F BELANJA, G KODE BEL, H SUMBER DANA,
//         I..T = ANGGARAN JAN..DES (kolom 9..20),
//         U..AF = REALISASI JAN..DES (kolom 21..32).
const REALISASI_COL_LETTERS = ['U','V','W','X','Y','Z','AA','AB','AC','AD','AE','AF'];

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

function norm(s: any): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function parseNum(s: any): number {
  if (s === null || s === undefined) return 0;
  const t = String(s).trim();
  if (!t || t === '-') return 0;
  // Format Indonesia: "1.234.567,89" -> 1234567.89
  return Number(t.replace(/\./g, '').replace(/,/g, '.')) || 0;
}

function formatID(n: number): string {
  // Tulis sebagai angka biasa (USER_ENTERED akan menerima titik desimal sebagai pemisah ribuan
  // di locale id-ID — lebih aman tulis raw number tanpa pemisah).
  return String(Math.round(n * 100) / 100);
}

async function ensureLogTab(lovableKey: string, sheetsKey: string) {
  const meta = await gw(`${GATEWAY}/spreadsheets/${LOG_SHEET_ID}`, {}, lovableKey, sheetsKey);
  const exists = (meta?.sheets || []).some((s: any) => s?.properties?.title === LOG_TAB);
  if (!exists) {
    await gw(`${GATEWAY}/spreadsheets/${LOG_SHEET_ID}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: LOG_TAB } } }],
      }),
    }, lovableKey, sheetsKey);
  }

  // Selalu pastikan header A1:P1 sesuai (auto-rename "Tanggal Entry" -> "Tanggal Realisasi")
  await gw(`${GATEWAY}/spreadsheets/${LOG_SHEET_ID}/values/${LOG_TAB}!A1:P1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [LOG_HEADERS] }),
  }, lovableKey, sheetsKey);
}

/**
 * Update kolom realisasi pada sheet sumber utama:
 *   - cari baris pertama yang cocok (Program+Kegiatan+SubKegiatan+Belanja+SumberDana)
 *   - TAMBAHKAN nilai entry ke cell realisasi bulan terkait
 *
 * Mengembalikan informasi hasil agar bisa dilaporkan ke client.
 */
async function updateSourceSheet(
  row: any,
  lovableKey: string,
  sheetsKey: string,
): Promise<{ matched: boolean; sheetTitle?: string; rowNumber?: number; before?: number; after?: number; }> {
  // 1. Pakai tab "Data" eksplisit
  const firstSheet = DATA_TAB;

  // 2. Ambil kolom A..H untuk mencari baris yang cocok
  const range = `${firstSheet}!A2:H`;
  const res = await gw(
    `${GATEWAY}/spreadsheets/${SOURCE_SHEET_ID}/values/${range}`,
    {}, lovableKey, sheetsKey,
  );
  const rows: string[][] = res?.values || [];

  const target = {
    program: norm(row.program),
    kegiatan: norm(row.kegiatan),
    sub: norm(row.sub_kegiatan),
    belanja: norm(row.belanja),
    sumber: norm(row.sumber_dana),
  };

  let matchIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (
      norm(r[0]) === target.program &&
      norm(r[1]) === target.kegiatan &&
      norm(r[3]) === target.sub &&
      norm(r[5]) === target.belanja &&
      norm(r[7]) === target.sumber
    ) {
      matchIdx = i;
      break;
    }
  }

  if (matchIdx === -1) {
    return { matched: false };
  }

  const sheetRowNum = matchIdx + 2; // +1 header, +1 (1-indexed)
  const colLetter = REALISASI_COL_LETTERS[Number(row.bulan) - 1];
  if (!colLetter) throw new Error(`Invalid bulan: ${row.bulan}`);

  const cellRange = `${firstSheet}!${colLetter}${sheetRowNum}`;

  // 3. Baca nilai existing di cell tersebut
  const cur = await gw(
    `${GATEWAY}/spreadsheets/${SOURCE_SHEET_ID}/values/${cellRange}`,
    {}, lovableKey, sheetsKey,
  );
  const existingRaw = cur?.values?.[0]?.[0] ?? '';
  const existing = parseNum(existingRaw);
  const add = Number(row.nilai_realisasi) || 0;
  const newVal = existing + add;

  // 4. Tulis kembali nilai baru
  await gw(
    `${GATEWAY}/spreadsheets/${SOURCE_SHEET_ID}/values/${cellRange}?valueInputOption=USER_ENTERED`,
    { method: 'PUT', body: JSON.stringify({ values: [[formatID(newVal)]] }) },
    lovableKey, sheetsKey,
  );

  return {
    matched: true,
    sheetTitle: firstSheet,
    rowNumber: sheetRowNum,
    before: existing,
    after: newVal,
  };
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

    // === 1. Append ke log sheet (riwayat) ===
    await ensureLogTab(lovableKey, sheetsKey);
    const values = [[
      row.tanggal_realisasi || '',
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
      `${GATEWAY}/spreadsheets/${LOG_SHEET_ID}/values/${LOG_TAB}!A:P:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values }) },
      lovableKey, sheetsKey,
    );

    // === 2. Tandai sudah sync di DB ===
    // Kolom U..AF di sheet "Data" akan di-recompute oleh fungsi sync-from-sheet
    // berdasarkan total entry di DB, supaya tidak terjadi double-count.
    await supabase.from('realisasi_entries')
      .update({ synced_to_sheet: true, synced_at: new Date().toISOString() })
      .eq('id', entry_id);

    // === 3. Trigger recompute kolom U..AF langsung (non-blocking di sisi client) ===
    let recomputeResult: any = null;
    try {
      const recRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-from-sheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: '{}',
      });
      recomputeResult = await recRes.json().catch(() => null);
    } catch (e) {
      console.warn('Recompute trigger failed:', e instanceof Error ? e.message : e);
    }

    return new Response(JSON.stringify({ ok: true, recompute: recomputeResult }), {
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
