import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatRupiah } from '@/lib/spreadsheet';

interface SummaryCardsProps {
  totalAnggaran: number;
  totalRealisasi: number;
  penyerapan: number;
}

const SummaryCards = memo(({ totalAnggaran, totalRealisasi, penyerapan }: SummaryCardsProps) => (
  <div className="grid gap-3 sm:grid-cols-3">
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">Total Anggaran</p>
        <p className="text-lg font-bold text-primary">{formatRupiah(totalAnggaran)}</p>
      </CardContent>
    </Card>
    <Card className="border-l-4 border-l-green-500">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">Total Realisasi</p>
        <p className="text-lg font-bold text-green-600">{formatRupiah(totalRealisasi)}</p>
      </CardContent>
    </Card>
    <Card className="border-l-4" style={{ borderLeftColor: penyerapan >= 80 ? 'hsl(140, 60%, 45%)' : penyerapan >= 50 ? 'hsl(40, 80%, 50%)' : 'hsl(0, 70%, 55%)' }}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">Penyerapan</p>
        <p className="text-lg font-bold">{penyerapan.toFixed(2)}%</p>
        <div className="mt-1 h-2 w-full rounded-full bg-muted">
          <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${Math.min(penyerapan, 100)}%` }} />
        </div>
      </CardContent>
    </Card>
  </div>
));

SummaryCards.displayName = 'SummaryCards';
export default SummaryCards;
