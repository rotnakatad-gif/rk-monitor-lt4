import { useState, useEffect, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { fetchBudgetData, filterData, getUniqueValues, sumBulanan, type BudgetRow } from '@/lib/spreadsheet';
import { exportToCSV, downloadTemplate } from '@/lib/export';
import { Download, FileSpreadsheet, BarChart3, FileText, PlusCircle, FolderOpen } from 'lucide-react';
import FilterSection from '@/components/dashboard/FilterSection';
import SummaryCards from '@/components/dashboard/SummaryCards';
import BudgetCharts from '@/components/dashboard/BudgetCharts';
import DataTable from '@/components/dashboard/DataTable';
import MonthlyDetail from '@/components/dashboard/MonthlyDetail';
import ReportView from '@/components/dashboard/ReportView';
import EntryRealisasi from '@/components/dashboard/EntryRealisasi';
import EvidenceLibrary from '@/components/dashboard/EvidenceLibrary';
import { supabase } from '@/integrations/supabase/client';

type EntryRow = {
  program: string; kegiatan: string; sub_kegiatan: string;
  belanja: string; sumber_dana: string;
  bulan: number; nilai_realisasi: number;
};

const norm = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

function mergeEntries(base: BudgetRow[], entries: EntryRow[]): BudgetRow[] {
  if (!entries.length) return base;
  // Index baris berdasarkan kunci komposit
  const idx = new Map<string, BudgetRow>();
  const cloned = base.map(r => {
    const copy: BudgetRow = { ...r, realisasiBulanan: [...r.realisasiBulanan] };
    const key = [r.program, r.kegiatan, r.subKegiatan, r.belanja, r.sumberDana].map(norm).join('|');
    idx.set(key, copy);
    return copy;
  });
  for (const e of entries) {
    const key = [e.program, e.kegiatan, e.sub_kegiatan, e.belanja, e.sumber_dana].map(norm).join('|');
    const row = idx.get(key);
    if (!row) continue;
    const m = Number(e.bulan) - 1;
    if (m < 0 || m > 11) continue;
    const cur = typeof row.realisasiBulanan[m] === 'number' ? (row.realisasiBulanan[m] as number) : 0;
    row.realisasiBulanan[m] = cur + Number(e.nilai_realisasi || 0);
  }
  return cloned;
}

const Index = () => {
  const [sheetData, setSheetData] = useState<BudgetRow[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [evidenceReload, setEvidenceReload] = useState(0);
  const [filters, setFilters] = useState<{
    program: string; kegiatan: string; subKegiatan: string; belanja: string; sumberDana: string;
  }>({ program: '', kegiatan: '', subKegiatan: '', belanja: '', sumberDana: '' });

  const loadEntries = useCallback(async () => {
    const { data: rows } = await supabase
      .from('realisasi_entries')
      .select('program,kegiatan,sub_kegiatan,belanja,sumber_dana,bulan,nilai_realisasi');
    setEntries((rows || []) as EntryRow[]);
  }, []);

  const reconcileFromSheet = useCallback(async () => {
    // Rekonsiliasi 2-arah: sheet Realisasi_Entries -> DB -> recompute kolom U..AF di sheet Data
    try { await supabase.functions.invoke('sync-from-sheet'); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const loadSheet = () => {
      fetchBudgetData().then(d => { setSheetData(d); setLoading(false); }).catch(() => setLoading(false));
    };
    const fullRefresh = async () => {
      await reconcileFromSheet();   // sinkronisasi dulu
      loadSheet();                  // lalu baca sheet Data terbaru
      loadEntries();                // dan entries dari DB
    };
    fullRefresh();
    // Polling 30 detik: rekonsiliasi sheet <-> DB lalu refresh dashboard
    const interval = setInterval(fullRefresh, 30 * 1000);
    // Refresh otomatis ketika tab dibuka kembali
    const onFocus = () => { fullRefresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    // Realtime: dengarkan entry baru -> langsung refresh dashboard
    const channel = supabase
      .channel('realisasi-entries-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'realisasi_entries' }, () => loadEntries())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [loadEntries]);

  const data = useMemo(() => mergeEntries(sheetData, entries), [sheetData, entries]);

  const setFilter = useCallback((key: string, value: string) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value === '__all__' ? '' : value };
      const order = ['program', 'kegiatan', 'subKegiatan', 'belanja', 'sumberDana'];
      const idx = order.indexOf(key);
      for (let i = idx + 1; i < order.length; i++) next[order[i] as keyof typeof next] = '';
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ program: '', kegiatan: '', subKegiatan: '', belanja: '', sumberDana: '' });
  }, []);

  const programOptions = useMemo(() => getUniqueValues(data, 'program'), [data]);
  const filteredByProgram = useMemo(() => filters.program ? data.filter(r => r.program === filters.program) : data, [data, filters.program]);
  const kegiatanOptions = useMemo(() => getUniqueValues(filteredByProgram, 'kegiatan'), [filteredByProgram]);
  const filteredByKegiatan = useMemo(() => filters.kegiatan ? filteredByProgram.filter(r => r.kegiatan === filters.kegiatan) : filteredByProgram, [filteredByProgram, filters.kegiatan]);
  const subKegiatanOptions = useMemo(() => getUniqueValues(filteredByKegiatan, 'subKegiatan'), [filteredByKegiatan]);
  const filteredBySub = useMemo(() => filters.subKegiatan ? filteredByKegiatan.filter(r => r.subKegiatan === filters.subKegiatan) : filteredByKegiatan, [filteredByKegiatan, filters.subKegiatan]);
  const belanjaOptions = useMemo(() => getUniqueValues(filteredBySub, 'belanja'), [filteredBySub]);
  const filteredByBelanja = useMemo(() => filters.belanja ? filteredBySub.filter(r => r.belanja === filters.belanja) : filteredBySub, [filteredBySub, filters.belanja]);
  const sumberDanaOptions = useMemo(() => getUniqueValues(filteredByBelanja, 'sumberDana'), [filteredByBelanja]);

  const filtered = useMemo(() => filterData(data, filters), [data, filters]);
  const sums = useMemo(() => sumBulanan(filtered), [filtered]);
  const totalAnggaran = useMemo(() => sums.anggaran.reduce((a, b) => a + b, 0), [sums]);
  const totalRealisasi = useMemo(() => sums.realisasi.reduce((a, b) => a + b, 0), [sums]);
  const penyerapan = totalAnggaran > 0 ? ((totalRealisasi / totalAnggaran) * 100) : 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-3 text-muted-foreground">Memuat data anggaran...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary md:text-2xl">Dashboard LT4</h1>
            <p className="text-sm text-muted-foreground">Monitoring RK</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportToCSV(filtered)} className="text-xs">
              <Download className="mr-1 h-3 w-3" /> Export Data
            </Button>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="text-xs">
              <FileSpreadsheet className="mr-1 h-3 w-3" /> Template
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4">
        <Tabs defaultValue="data" className="space-y-4">
          <TabsList>
            <TabsTrigger value="data" className="text-xs">
              <BarChart3 className="mr-1 h-3 w-3" /> Data
            </TabsTrigger>
            <TabsTrigger value="entry" className="text-xs">
              <PlusCircle className="mr-1 h-3 w-3" /> Entry Realisasi
            </TabsTrigger>
            <TabsTrigger value="bukti" className="text-xs">
              <FolderOpen className="mr-1 h-3 w-3" /> Bukti
            </TabsTrigger>
            <TabsTrigger value="laporan" className="text-xs">
              <FileText className="mr-1 h-3 w-3" /> Laporan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="data" className="space-y-4">
            <FilterSection
              filters={filters}
              programOptions={programOptions}
              kegiatanOptions={kegiatanOptions}
              subKegiatanOptions={subKegiatanOptions}
              belanjaOptions={belanjaOptions}
              sumberDanaOptions={sumberDanaOptions}
              onFilter={setFilter}
              onReset={resetFilters}
            />
            <SummaryCards totalAnggaran={totalAnggaran} totalRealisasi={totalRealisasi} penyerapan={penyerapan} />
            <BudgetCharts sums={sums} filtered={filtered} />
            <DataTable filtered={filtered} totalAnggaran={totalAnggaran} totalRealisasi={totalRealisasi} penyerapan={penyerapan} />
            <MonthlyDetail sums={sums} />
          </TabsContent>

          <TabsContent value="entry" className="space-y-4">
            <EntryRealisasi data={data} onSaved={() => { setEvidenceReload(k => k + 1); loadEntries(); }} />
          </TabsContent>

          <TabsContent value="bukti" className="space-y-4">
            <EvidenceLibrary reloadKey={evidenceReload} />
          </TabsContent>

          <TabsContent value="laporan" className="space-y-4">
            <SummaryCards totalAnggaran={totalAnggaran} totalRealisasi={totalRealisasi} penyerapan={penyerapan} />
            <ReportView filtered={filtered} sums={sums} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
