import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface FilterSectionProps {
  filters: { program: string; kegiatan: string; subKegiatan: string; belanja: string; sumberDana: string };
  programOptions: string[];
  kegiatanOptions: string[];
  subKegiatanOptions: string[];
  belanjaOptions: string[];
  sumberDanaOptions: string[];
  onFilter: (key: string, value: string) => void;
  onReset: () => void;
}

function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value || '__all__'} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs">
          <SelectValue placeholder={`Semua ${label}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Semua {label}</SelectItem>
          {options.map(opt => (
            <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const FilterSection = memo(({ filters, programOptions, kegiatanOptions, subKegiatanOptions, belanjaOptions, sumberDanaOptions, onFilter, onReset }: FilterSectionProps) => (
  <Card>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-base">Filter Data</CardTitle>
        <Button variant="outline" size="sm" onClick={onReset}>Reset</Button>
      </div>
    </CardHeader>
    <CardContent>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <FilterSelect label="Program" value={filters.program} options={programOptions} onChange={v => onFilter('program', v)} />
        <FilterSelect label="Kegiatan" value={filters.kegiatan} options={kegiatanOptions} onChange={v => onFilter('kegiatan', v)} />
        <FilterSelect label="Sub Kegiatan" value={filters.subKegiatan} options={subKegiatanOptions} onChange={v => onFilter('subKegiatan', v)} />
        <FilterSelect label="Belanja" value={filters.belanja} options={belanjaOptions} onChange={v => onFilter('belanja', v)} />
        <FilterSelect label="Sumber Dana" value={filters.sumberDana} options={sumberDanaOptions} onChange={v => onFilter('sumberDana', v)} />
      </div>
    </CardContent>
  </Card>
));

FilterSection.displayName = 'FilterSection';
export default FilterSection;
