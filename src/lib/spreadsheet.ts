const SHEET_ID = '1tLWXV07F2aTZWy9iTbxOoSpvKfJrfYzVcAG36AjnMmI';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Data`;

export interface BudgetRow {
  program: string;
  kegiatan: string;
  subKegiatan: string;
  belanja: string;
  sumberDana: string;
  anggaranBulanan: number[];
  realisasiBulanan: (number | string)[];
}

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export { BULAN };

function parseNumber(val: string): number {
  if (!val || val === '-' || val.trim() === '') return 0;
  return Number(val.replace(/\./g, '').replace(/,/g, '.')) || 0;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map(s => s.replace(/^"|"$/g, '').trim());
}

export async function fetchBudgetData(): Promise<BudgetRow[]> {
  const res = await fetch(CSV_URL);
  const text = await res.text();
  const lines = text.split('\n').filter(l => l.trim());
  
  // Skip header (first line)
  const dataLines = lines.slice(1);
  
  return dataLines.map(line => {
    const cols = parseCSVLine(line);
    // A=0 PROGRAM, B=1 KEGIATAN, C=2 KODE KEGIATAN (skip), D=3 SUB KEGIATAN, 
    // E=4 KODE SUB (skip), F=5 BELANJA, G=6 KODE BELANJA (skip), H=7 SUMBER DANA
    // I-T (8-19) ANGGARAN JAN-DES, U-AF (20-31) REALISASI JAN-DES
    const anggaranBulanan = Array.from({ length: 12 }, (_, i) => parseNumber(cols[8 + i] || ''));
    const realisasiBulanan = Array.from({ length: 12 }, (_, i) => {
      const val = (cols[20 + i] || '').trim();
      if (val === '-' || val === '') return 0;
      return parseNumber(val);
    });

    return {
      program: cols[0] || '',
      kegiatan: cols[1] || '',
      subKegiatan: cols[3] || '',
      belanja: cols[5] || '',
      sumberDana: cols[7] || '',
      anggaranBulanan,
      realisasiBulanan: realisasiBulanan as (number | string)[],
    };
  }).filter(r => r.program);
}

export function getUniqueValues(data: BudgetRow[], field: keyof BudgetRow): string[] {
  const set = new Set<string>();
  data.forEach(r => {
    const val = r[field];
    if (typeof val === 'string' && val) set.add(val);
  });
  return Array.from(set).sort();
}

export function filterData(data: BudgetRow[], filters: {
  program?: string;
  kegiatan?: string;
  subKegiatan?: string;
  belanja?: string;
  sumberDana?: string;
}): BudgetRow[] {
  return data.filter(r => {
    if (filters.program && r.program !== filters.program) return false;
    if (filters.kegiatan && r.kegiatan !== filters.kegiatan) return false;
    if (filters.subKegiatan && r.subKegiatan !== filters.subKegiatan) return false;
    if (filters.belanja && r.belanja !== filters.belanja) return false;
    if (filters.sumberDana && r.sumberDana !== filters.sumberDana) return false;
    return true;
  });
}

export function sumBulanan(data: BudgetRow[]): { anggaran: number[]; realisasi: number[] } {
  const anggaran = Array(12).fill(0);
  const realisasi = Array(12).fill(0);
  data.forEach(r => {
    r.anggaranBulanan.forEach((v, i) => anggaran[i] += v);
    r.realisasiBulanan.forEach((v, i) => {
      if (typeof v === 'number') realisasi[i] += v;
    });
  });
  return { anggaran, realisasi };
}

export function formatRupiah(value: number): string {
  if (value === 0) return 'Rp 0';
  return 'Rp ' + value.toLocaleString('id-ID');
}
