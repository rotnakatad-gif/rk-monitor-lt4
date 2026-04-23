import { useState, useEffect, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { fetchBudgetData, filterData, getUniqueValues, sumBulanan, type BudgetRow } from '@/lib/spreadsheet';
import { exportToCSV, downloadTemplate } from '@/lib/export';
import { Download, FileSpreadsheet, BarChart3, FileText } from 'lucide-react';
import FilterSection from '@/components/dashboard/FilterSection';
import SummaryCards from '@/components/dashboard/SummaryCards';
import BudgetCharts from '@/components/dashboard/BudgetCharts';
import DataTable from '@/components/dashboard/DataTable';
import MonthlyDetail from '@/components/dashboard/MonthlyDetail';
import ReportView from '@/components/dashboard/ReportView';

const Index = () => {
  const [data, setData] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{
    program: string; kegiatan: string; subKegiatan: string; belanja: string; sumberDana: string;
  }>({ program: '', kegiatan: '', subKegiatan: '', belanja: '', sumberDana: '' });

  useEffect(() => {
    const load = () => {
      fetchBudgetData().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
    };
    load();
    const interval = setInterval(load, 5 * 60 * 1000); // auto-refresh setiap 5 menit
    return () => clearInterval(interval);
  }, []);

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
