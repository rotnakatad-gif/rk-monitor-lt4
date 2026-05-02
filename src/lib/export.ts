import { BudgetRow, BULAN, formatRupiah } from './spreadsheet';

export function exportToCSV(data: BudgetRow[], filename: string = 'data_anggaran.csv') {
  const headers = ['Program', 'Kegiatan', 'Sub Kegiatan', 'Belanja', 'Sumber Dana',
    ...BULAN.map(b => `Anggaran ${b}`), ...BULAN.map(b => `Realisasi ${b}`),
    'Total Anggaran', 'Total Realisasi', 'Penyerapan %'];
  
  const rows = data.map(r => {
    const totalAng = r.anggaranBulanan.reduce((a, b) => a + b, 0);
    const totalReal = r.realisasiBulanan.reduce<number>((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    const pct = totalAng > 0 ? ((totalReal / totalAng) * 100).toFixed(2) : '0';
    return [r.program, r.kegiatan, r.subKegiatan, r.belanja, r.sumberDana,
      ...r.anggaranBulanan, ...r.realisasiBulanan.map(v => typeof v === 'number' ? v : 0),
      totalAng, totalReal, pct];
  });

  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function downloadTemplate() {
  const headers = ['PROGRAM', 'KEGIATAN', 'KODE KEGIATAN', 'SUB KEGIATAN', 'KODE SUB',
    'BELANJA', 'KODE BELANJA', 'SUMBER DANA',
    ...BULAN.map(b => `ANG_${b.toUpperCase()}`),
    ...BULAN.map(b => `REAL_${b.toUpperCase()}`)];
  
  const csv = [headers.map(h => `"${h}"`).join(',')].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'template_anggaran.csv'; a.click();
  URL.revokeObjectURL(url);
}
