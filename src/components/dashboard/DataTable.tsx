import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatRupiah, type BudgetRow } from '@/lib/spreadsheet';

interface DataTableProps {
  filtered: BudgetRow[];
  totalAnggaran: number;
  totalRealisasi: number;
  penyerapan: number;
}

function TruncCell({ children, className = '' }: { children: string; className?: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <TableCell className={`max-w-[120px] truncate md:max-w-[200px] ${className}`}>
            {children}
          </TableCell>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-normal text-xs">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const DataTable = memo(({ filtered, totalAnggaran, totalRealisasi, penyerapan }: DataTableProps) => {
  const totalSisa = totalAnggaran - totalRealisasi;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Detail Data ({filtered.length} baris)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="sticky left-0 z-10 bg-muted/90 text-xs whitespace-nowrap">Program</TableHead>
                <TableHead className="text-xs whitespace-nowrap">Kegiatan</TableHead>
                <TableHead className="text-xs whitespace-nowrap">Sub Kegiatan</TableHead>
                <TableHead className="text-xs whitespace-nowrap">Belanja</TableHead>
                <TableHead className="text-xs whitespace-nowrap">Sumber Dana</TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">Anggaran</TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">Realisasi</TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">Sisa</TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row, i) => {
                const totalAng = row.anggaranBulanan.reduce((a, b) => a + b, 0);
                const totalReal = row.realisasiBulanan.reduce<number>((a, b) => a + (typeof b === 'number' ? b : 0), 0);
                const sisa = totalAng - totalReal;
                const pct = totalAng > 0 ? ((totalReal / totalAng) * 100) : 0;
                return (
                  <TableRow key={i} className="text-xs hover:bg-accent/30">
                    <TruncCell className="sticky left-0 z-10 bg-card font-medium max-w-[120px] md:max-w-[200px]">{row.program}</TruncCell>
                    <TruncCell>{row.kegiatan}</TruncCell>
                    <TruncCell>{row.subKegiatan}</TruncCell>
                    <TruncCell>{row.belanja}</TruncCell>
                    <TruncCell>{row.sumberDana}</TruncCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">{formatRupiah(totalAng)}</TableCell>
                    <TableCell className={`text-right font-medium whitespace-nowrap ${totalReal < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatRupiah(totalReal)}</TableCell>
                    <TableCell className={`text-right whitespace-nowrap ${sisa < 0 ? 'text-red-600' : ''}`}>{formatRupiah(sisa)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{pct.toFixed(2)}%</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="border-t-2 bg-muted/50 font-bold">
                <TableCell colSpan={5} className="sticky left-0 z-10 bg-muted/90">TOTAL</TableCell>
                <TableCell className="text-right text-primary whitespace-nowrap">{formatRupiah(totalAnggaran)}</TableCell>
                <TableCell className={`text-right whitespace-nowrap ${totalRealisasi < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatRupiah(totalRealisasi)}</TableCell>
                <TableCell className={`text-right whitespace-nowrap ${totalSisa < 0 ? 'text-red-600' : ''}`}>{formatRupiah(totalSisa)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{penyerapan.toFixed(2)}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});

DataTable.displayName = 'DataTable';
export default DataTable;
