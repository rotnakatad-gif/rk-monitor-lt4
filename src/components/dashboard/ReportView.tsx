import { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BULAN, formatRupiah, type BudgetRow } from '@/lib/spreadsheet';

interface ReportViewProps {
  filtered: BudgetRow[];
  sums: { anggaran: number[]; realisasi: number[] };
}

const TRIWULAN_LABELS = ['Triwulan I (Jan-Mar)', 'Triwulan II (Apr-Jun)', 'Triwulan III (Jul-Sep)', 'Triwulan IV (Okt-Des)'];

const ReportView = memo(({ filtered, sums }: ReportViewProps) => {
  const totalAnggaran = sums.anggaran.reduce((a, b) => a + b, 0);
  const totalRealisasi = sums.realisasi.reduce((a, b) => a + b, 0);
  const penyerapan = totalAnggaran > 0 ? ((totalRealisasi / totalAnggaran) * 100) : 0;

  const triwulanData = useMemo(() => {
    return [0, 1, 2, 3].map(q => {
      const start = q * 3;
      const ang = sums.anggaran.slice(start, start + 3).reduce((a, b) => a + b, 0);
      const real = sums.realisasi.slice(start, start + 3).reduce((a, b) => a + b, 0);
      return { label: TRIWULAN_LABELS[q], anggaran: ang, realisasi: real, pct: ang > 0 ? ((real / ang) * 100) : 0 };
    });
  }, [sums]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Laporan</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tahunan">
          <TabsList className="mb-3">
            <TabsTrigger value="tahunan" className="text-xs">Tahunan</TabsTrigger>
            <TabsTrigger value="triwulan" className="text-xs">Triwulan</TabsTrigger>
            <TabsTrigger value="bulanan" className="text-xs">Bulanan</TabsTrigger>
          </TabsList>

          <TabsContent value="tahunan">
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Laporan Tahunan</h3>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Keterangan</TableHead>
                  <TableHead className="text-right text-xs">Jumlah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="text-xs">
                  <TableCell className="font-medium">Total Anggaran</TableCell>
                  <TableCell className="text-right font-medium text-primary">{formatRupiah(totalAnggaran)}</TableCell>
                </TableRow>
                <TableRow className="text-xs">
                  <TableCell className="font-medium">Total Realisasi</TableCell>
                  <TableCell className={`text-right font-medium ${totalRealisasi < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatRupiah(totalRealisasi)}</TableCell>
                </TableRow>
                <TableRow className="text-xs">
                  <TableCell className="font-medium">Sisa Anggaran</TableCell>
                  <TableCell className="text-right font-medium">{formatRupiah(totalAnggaran - totalRealisasi)}</TableCell>
                </TableRow>
                <TableRow className="text-xs border-t-2 font-bold">
                  <TableCell>Penyerapan</TableCell>
                  <TableCell className="text-right">{penyerapan.toFixed(1)}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="triwulan">
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Laporan Triwulan</h3>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Periode</TableHead>
                  <TableHead className="text-right text-xs">Anggaran</TableHead>
                  <TableHead className="text-right text-xs">Realisasi</TableHead>
                  <TableHead className="text-right text-xs">Selisih</TableHead>
                  <TableHead className="text-right text-xs">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {triwulanData.map((tw, i) => (
                  <TableRow key={i} className="text-xs">
                    <TableCell className="font-medium">{tw.label}</TableCell>
                    <TableCell className="text-right">{formatRupiah(tw.anggaran)}</TableCell>
                    <TableCell className={`text-right font-medium ${tw.realisasi < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatRupiah(tw.realisasi)}</TableCell>
                    <TableCell className="text-right">{formatRupiah(tw.anggaran - tw.realisasi)}</TableCell>
                    <TableCell className="text-right">{tw.pct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                <TableRow className="text-xs border-t-2 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right text-primary">{formatRupiah(totalAnggaran)}</TableCell>
                  <TableCell className={`text-right ${totalRealisasi < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatRupiah(totalRealisasi)}</TableCell>
                  <TableCell className="text-right">{formatRupiah(totalAnggaran - totalRealisasi)}</TableCell>
                  <TableCell className="text-right">{penyerapan.toFixed(1)}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="bulanan">
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Laporan Bulanan</h3>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Bulan</TableHead>
                  <TableHead className="text-right text-xs">Anggaran</TableHead>
                  <TableHead className="text-right text-xs">Realisasi</TableHead>
                  <TableHead className="text-right text-xs">Selisih</TableHead>
                  <TableHead className="text-right text-xs">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {BULAN.map((bulan, i) => {
                  const ang = sums.anggaran[i];
                  const real = sums.realisasi[i];
                  const pct = ang > 0 ? ((real / ang) * 100) : 0;
                  return (
                    <TableRow key={i} className="text-xs">
                      <TableCell className="font-medium">{bulan}</TableCell>
                      <TableCell className="text-right">{formatRupiah(ang)}</TableCell>
                      <TableCell className={`text-right font-medium ${real < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatRupiah(real)}</TableCell>
                      <TableCell className="text-right">{formatRupiah(ang - real)}</TableCell>
                      <TableCell className="text-right">{pct.toFixed(1)}%</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="text-xs border-t-2 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right text-primary">{formatRupiah(totalAnggaran)}</TableCell>
                  <TableCell className={`text-right ${totalRealisasi < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatRupiah(totalRealisasi)}</TableCell>
                  <TableCell className="text-right">{formatRupiah(totalAnggaran - totalRealisasi)}</TableCell>
                  <TableCell className="text-right">{penyerapan.toFixed(1)}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
});

ReportView.displayName = 'ReportView';
export default ReportView;
