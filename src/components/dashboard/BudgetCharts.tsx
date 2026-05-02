import { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, LineChart, Line, Area, AreaChart, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { BULAN, formatRupiah, type BudgetRow } from '@/lib/spreadsheet';

interface BudgetChartsProps {
  sums: { anggaran: number[]; realisasi: number[] };
  filtered: BudgetRow[];
}

const COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16'];

const BudgetCharts = memo(({ sums, filtered }: BudgetChartsProps) => {
  const chartData = useMemo(() => BULAN.map((bulan, i) => ({
    bulan: bulan.slice(0, 3),
    Anggaran: sums.anggaran[i],
    Realisasi: sums.realisasi[i],
    Sisa: sums.anggaran[i] - sums.realisasi[i],
  })), [sums]);

  const cumulativeData = useMemo(() => {
    let cumAng = 0, cumReal = 0;
    return BULAN.map((bulan, i) => {
      cumAng += sums.anggaran[i];
      cumReal += sums.realisasi[i];
      return { bulan: bulan.slice(0, 3), Anggaran: cumAng, Realisasi: cumReal, Sisa: cumAng - cumReal };
    });
  }, [sums]);

  const percentData = useMemo(() => BULAN.map((bulan, i) => ({
    bulan: bulan.slice(0, 3),
    Penyerapan: sums.anggaran[i] > 0 ? ((sums.realisasi[i] / sums.anggaran[i]) * 100) : 0,
  })), [sums]);

  const programDist = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(r => {
      const total = r.anggaranBulanan.reduce((a, b) => a + b, 0);
      map.set(r.program, (map.get(r.program) || 0) + total);
    });
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const sumberDanaDist = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(r => {
      const total = r.anggaranBulanan.reduce((a, b) => a + b, 0);
      map.set(r.sumberDana, (map.get(r.sumberDana) || 0) + total);
    });
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const totalAll = programDist.reduce((a, b) => a + b.value, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Grafik Anggaran vs Realisasi</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="perbulan">
            <TabsList className="mb-3">
              <TabsTrigger value="perbulan" className="text-xs">Per Bulan</TabsTrigger>
              <TabsTrigger value="kumulatif" className="text-xs">Kumulatif</TabsTrigger>
              <TabsTrigger value="persentase" className="text-xs">Persentase</TabsTrigger>
            </TabsList>
            <TabsContent value="perbulan">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 30%, 90%)" />
                    <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1e9 ? `${(v/1e9).toFixed(1)}M` : v >= 1e6 ? `${(v/1e6).toFixed(0)}Jt` : v >= 1e3 ? `${(v/1e3).toFixed(0)}Rb` : `${v}`} />
                    <Tooltip formatter={(value: number) => formatRupiah(value)} />
                    <Legend />
                    <Bar dataKey="Anggaran" fill="hsl(210, 80%, 55%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Realisasi" fill="hsl(140, 60%, 45%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>
            <TabsContent value="kumulatif">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cumulativeData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 30%, 90%)" />
                    <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1e9 ? `${(v/1e9).toFixed(1)}M` : v >= 1e6 ? `${(v/1e6).toFixed(0)}Jt` : v >= 1e3 ? `${(v/1e3).toFixed(0)}Rb` : `${v}`} />
                    <Tooltip formatter={(value: number) => formatRupiah(value)} />
                    <Legend />
                    <Area type="monotone" dataKey="Anggaran" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
                    <Area type="monotone" dataKey="Realisasi" stroke="#3b82f6" fill="#3b82f633" strokeWidth={2} />
                    <Area type="monotone" dataKey="Sisa" stroke="#f59e0b" fill="#f59e0b33" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>
            <TabsContent value="persentase">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={percentData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 30%, 90%)" />
                    <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                    <Bar dataKey="Penyerapan" fill="hsl(210, 80%, 55%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribusi Anggaran per Program</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={programDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80}
                    label={({ name, value }) => `${name.length > 12 ? name.slice(0, 12) + '..' : name} ${totalAll > 0 ? ((value / totalAll) * 100).toFixed(0) : 0}%`}
                    labelLine={{ strokeWidth: 1 }} fontSize={10}>
                    {programDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatRupiah(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribusi Anggaran per Sumber Dana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sumberDanaDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80}
                    label={({ name, value }) => `${name.length > 15 ? name.slice(0, 15) + '..' : name} ${totalAll > 0 ? ((value / totalAll) * 100).toFixed(0) : 0}%`}
                    labelLine={{ strokeWidth: 1 }} fontSize={10}>
                    {sumberDanaDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatRupiah(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

BudgetCharts.displayName = 'BudgetCharts';
export default BudgetCharts;
