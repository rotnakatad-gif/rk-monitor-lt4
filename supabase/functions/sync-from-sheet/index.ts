// Sinkronisasi 2 arah:
// 1. Baca sheet Realisasi_Entries (log) -> rekonsiliasi DB (insert baru, hapus yang hilang)
// 2. Hitung ulang kolom REALISASI (U..AF) di sheet "Data" berdasarkan total entry per
//    (program+kegiatan+sub+belanja+sumber, bulan) dari DB hasil rekonsiliasi.
//
// Dipanggil periodik dari frontend (polling) sehingga perubahan apa pun di spreadsheet
// (delete baris, edit nilai, dll) langsung tercermin di app + sheet Data.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SOURCE_SHEET_ID = '1B2UPHU3uRAa6ixwEjYxNbCiUkBIg_31Dkh6W3g9_Nvc';
const LOG_SHEET_ID = '1tLWXV07F2aTZWy9iTbxOoSpvKfJrfYzVcAG36AjnMmI';
const LOG_TAB = 'Realisasi_Entries';
const GATEWAY = 'https://connector-gateway.lovable.dev/google_sheets/v4';

// Header log sheet (lihat sync-to-sheet):
// A Tanggal Entry, B Tahun, C Bulan, D Program, E Kegiatan, F Sub Kegiatan,
// G Belanja, H Sumber Dana, I Nilai Realisasi, J Kode RUP, K No Kode Paket,
// L No Surat Pesanan, M Keterangan, N Bukti URL, O Bukti Filename, P Entry ID
const COL = {
  tanggal: 0, tahun: 1, bulan: 2, program: 3, kegiatan: 4, sub: 5,
  belanja: 6, sumber: 7, nilai: 8, kode_rup: 9, no_paket: 10,
  no_sp: 11, keterangan: 12, bukti_url: 13, bukti_filename: 14, entry_id: 15,
};

const BULAN = ['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'];
const REALISASI_COL_LETTERS = ['U','V','W','X','Y','Z','AA','AB','AC','AD','AE','AF'];

function norm(s: any): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function parseNum(s: any): number {
  if (s === null || s === undefined) return 0;
  const t = String(s).trim();
  if (!t || t === '-') return 0;
  return Number(t.replace(/\./g, '').replace(/,/g, '.')) || 0;
}
function bulanToInt(s: any): number {
  const n = Number(s);
  if (Number.isFinite(n) && n >= 1 && n <= 12) return n;
  const i = BULAN.indexOf(norm(s));
  return i >= 0 ? i + 1 : 0;
}
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

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
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const sheetsKey = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    if (!lovableKey || !sheetsKey) throw new Error('Sheets connector belum tersambung');

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // === 1. Baca sheet log ===
    const logRes = await gw(
      `${GATEWAY}/spreadsheets/${LOG_SHEET_ID}/values/${LOG_TAB}!A2:P`,
      {}, lovableKey, sheetsKey,
    );
    const logRows: string[][] = logRes?.values || [];

    type SheetEntry = {
      entry_id: string; program: string; kegiatan: string; sub_kegiatan: string;
      belanja: string; sumber_dana: string; bulan: number; tahun: number;
      nilai_realisasi: number; kode_rup: string; no_kode_paket: string;
      no_surat_pesanan: string; keterangan: string;
    };
    const sheetEntries: SheetEntry[] = [];
    const sheetIds = new Set<string>();
    for (const r of logRows) {
      const id = (r[COL.entry_id] || '').trim();
      if (!id || !isUuid(id)) continue; // skip baris tanpa Entry ID valid
      const bulan = bulanToInt(r[COL.bulan]);
      if (!bulan) continue;
      sheetIds.add(id);
      sheetEntries.push({
        entry_id: id,
        program: r[COL.program] || '',
        kegiatan: r[COL.kegiatan] || '',
        sub_kegiatan: r[COL.sub] || '',
        belanja: r[COL.belanja] || '',
        sumber_dana: r[COL.sumber] || '',
        bulan,
        tahun: Number(r[COL.tahun]) || new Date().getFullYear(),
        nilai_realisasi: parseNum(r[COL.nilai]),
        kode_rup: r[COL.kode_rup] || '',
        no_kode_paket: r[COL.no_paket] || '',
        no_surat_pesanan: r[COL.no_sp] || '',
        keterangan: r[COL.keterangan] || '',
      });
    }

    // === 2. Ambil semua entry DB ===
    const { data: dbEntries, error: dbErr } = await sb
      .from('realisasi_entries')
      .select('id, nilai_realisasi, bulan, tahun, program, kegiatan, sub_kegiatan, belanja, sumber_dana, kode_rup, no_kode_paket, no_surat_pesanan, keterangan, synced_to_sheet, bukti_path');
    if (dbErr) throw new Error(`DB read: ${dbErr.message}`);

    const dbMap = new Map<string, any>();
    for (const e of (dbEntries || [])) dbMap.set(e.id as string, e);

    // === 3. Hapus DB yang tidak ada di sheet (HANYA yang sudah pernah disync & tidak punya bukti) ===
    // Aman: kita hanya hapus entry yang sudah `synced_to_sheet=true` (artinya pernah ada di sheet).
    // Yang baru dibuat dari app tapi belum sync tidak akan terhapus.
    const toDelete: string[] = [];
    for (const [id, row] of dbMap.entries()) {
      if (!sheetIds.has(id) && row.synced_to_sheet) toDelete.push(id);
    }
    if (toDelete.length) {
      // Hapus file bukti dulu
      const paths = (dbEntries || [])
        .filter((e: any) => toDelete.includes(e.id) && e.bukti_path)
        .map((e: any) => e.bukti_path);
      if (paths.length) {
        await sb.storage.from('bukti-realisasi').remove(paths);
      }
      await sb.from('realisasi_entries').delete().in('id', toDelete);
    }

    // === 4. Upsert semua entry dari sheet ke DB ===
    // (insert baru kalau belum ada, update kalau nilai berubah)
    const toUpsert = sheetEntries.map(e => ({
      id: e.entry_id,
      program: e.program, kegiatan: e.kegiatan, sub_kegiatan: e.sub_kegiatan,
      belanja: e.belanja, sumber_dana: e.sumber_dana,
      bulan: e.bulan, tahun: e.tahun,
      nilai_realisasi: e.nilai_realisasi,
      kode_rup: e.kode_rup || null,
      no_kode_paket: e.no_kode_paket || null,
      no_surat_pesanan: e.no_surat_pesanan || null,
      keterangan: e.keterangan || null,
      synced_to_sheet: true,
    }));
    if (toUpsert.length) {
      const { error: upErr } = await sb.from('realisasi_entries').upsert(toUpsert, { onConflict: 'id' });
      if (upErr) throw new Error(`Upsert: ${upErr.message}`);
    }

    // === 5. Recompute kolom U..AF di sheet Data ===
    // Ambil ulang seluruh entry dari DB (sumber kebenaran)
    const { data: allEntries } = await sb
      .from('realisasi_entries')
      .select('program, kegiatan, sub_kegiatan, belanja, sumber_dana, bulan, nilai_realisasi');

    // Akumulasi: map[key][bulan-1] = total
    const totals = new Map<string, number[]>();
    for (const e of (allEntries || [])) {
      const key = [e.program, e.kegiatan, e.sub_kegiatan, e.belanja, e.sumber_dana].map(norm).join('|');
      if (!totals.has(key)) totals.set(key, Array(12).fill(0));
      const m = Number(e.bulan) - 1;
      if (m < 0 || m > 11) continue;
      totals.get(key)![m] += Number(e.nilai_realisasi) || 0;
    }

    // Baca baris sheet Data (A..H) untuk cari index baris per key
    const meta = await gw(`${GATEWAY}/spreadsheets/${SOURCE_SHEET_ID}`, {}, lovableKey, sheetsKey);
    const dataTab = meta?.sheets?.[0]?.properties?.title;
    if (!dataTab) throw new Error('Source sheet kosong');

    const head = await gw(
      `${GATEWAY}/spreadsheets/${SOURCE_SHEET_ID}/values/${dataTab}!A2:H`,
      {}, lovableKey, sheetsKey,
    );
    const rows: string[][] = head?.values || [];

    // Baca existing realisasi U2:AF<n> untuk diff
    const lastRow = rows.length + 1;
    const existing = await gw(
      `${GATEWAY}/spreadsheets/${SOURCE_SHEET_ID}/values/${dataTab}!U2:AF${lastRow}`,
      {}, lovableKey, sheetsKey,
    );
    const existRows: string[][] = existing?.values || [];

    // Index baris key -> sheetRowNum
    const keyToRow = new Map<string, number>();
    rows.forEach((r, i) => {
      const key = [r[0], r[1], r[3], r[5], r[7]].map(norm).join('|');
      // simpan baris pertama saja (jika ada duplikat)
      if (!keyToRow.has(key)) keyToRow.set(key, i + 2);
    });

    // Susun nilai baru per baris (default = existing, override jika ada di totals)
    const newValues: (string | number)[][] = rows.map((_, i) => {
      const cur = existRows[i] || [];
      return Array.from({ length: 12 }, (_, m) => {
        const v = parseNum(cur[m] ?? '');
        return v;
      });
    });

    let touched = 0;
    for (const [key, monthly] of totals.entries()) {
      const rowNum = keyToRow.get(key);
      if (!rowNum) continue;
      const idx = rowNum - 2;
      newValues[idx] = monthly.slice();
      touched++;
    }

    // Untuk baris yang tidak ada entry sama sekali -> set 0 di semua bulan
    // (supaya jika user hapus entry terakhir untuk key tsb, sheet ikut bersih)
    rows.forEach((r, i) => {
      const key = [r[0], r[1], r[3], r[5], r[7]].map(norm).join('|');
      if (!totals.has(key)) {
        newValues[i] = Array(12).fill(0);
      }
    });

    // Tulis batch ke U2:AF<lastRow>
    if (rows.length) {
      await gw(
        `${GATEWAY}/spreadsheets/${SOURCE_SHEET_ID}/values/${dataTab}!U2:AF${lastRow}?valueInputOption=USER_ENTERED`,
        { method: 'PUT', body: JSON.stringify({ values: newValues.map(row => row.map(v => String(v))) }) },
        lovableKey, sheetsKey,
      );
    }

    return new Response(JSON.stringify({
      ok: true,
      sheet_rows: sheetEntries.length,
      db_deleted: toDelete.length,
      db_upserted: toUpsert.length,
      data_rows_touched: touched,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown';
    console.error('sync-from-sheet:', msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
