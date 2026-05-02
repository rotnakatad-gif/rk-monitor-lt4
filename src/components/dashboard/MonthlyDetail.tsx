import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BULAN, formatRupiah } from '@/lib/spreadsheet';

interface MonthlyDetailProps {
  sums: { anggaran: number[]; realisasi: number[] };
}

const MonthlyDetail = memo(({ sums }: MonthlyDetailProps) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-base">Rincian per Bulan</CardTitle>
    </CardHeader>
    <CardContent className="p-0">
      <div className="overflow-auto">
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
              const selisih = ang - real;
              const pct = ang > 0 ? ((real / ang) * 100) : 0;
              return (
                <TableRow key={i} className="text-xs">
                  <TableCell className="font-medium">{bulan}</TableCell>
                  <TableCell className="text-right">{formatRupiah(ang)}</TableCell>
                  <TableCell className={`text-right font-medium ${real < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatRupiah(real)}</TableCell>
                  <TableCell className={`text-right ${selisih < 0 ? 'text-red-600' : ''}`}>{formatRupiah(selisih)}</TableCell>
                  <TableCell className="text-right">{pct.toFixed(2)}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
));

MonthlyDetail.displayName = 'MonthlyDetail';
export default MonthlyDetail;
