import { memo, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileDown, RefreshCw, ExternalLink, Search, Pencil, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BULAN, formatRupiah } from '@/lib/spreadsheet';
import { toast } from 'sonner';

interface EntryRow {
  id: string;
  program: string;
  kegiatan: string;
  sub_kegiatan: string;
  belanja: string;
  sumber_dana: string;
  bulan: number;
  tahun: number;
  nilai_realisasi: number;
  kode_rup: string | null;
  no_kode_paket: string | null;
  no_surat_pesanan: string | null;
  keterangan: string | null;
  bukti_path: string | null;
  bukti_filename: string | null;
  bukti_mimetype: string | null;
  synced_to_sheet: boolean;
  created_at: string;
}

type EditDraft = {
  bulan: number;
  tahun: number;
  nilai_realisasi: number;
  kode_rup: string;
  no_kode_paket: string;
  no_surat_pesanan: string;
  keterangan: string;
};

interface Props { reloadKey?: number }

const EvidenceLibrary = memo(({ reloadKey = 0 }: Props) => {
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bulan, setBulan] = useState<string>('__all__');
  const [tahun, setTahun] = useState<string>('__all__');
  const [hasBukti, setHasBukti] = useState<string>('__all__');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('realisasi_entries')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setRows(data as EntryRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [reloadKey]);

  const tahunOptions = useMemo(() => {
    const set = new Set<number>();
    rows.forEach(r => set.add(r.tahun));
    return Array.from(set).sort((a, b) => b - a);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (bulan !== '__all__' && String(r.bulan) !== bulan) return false;
      if (tahun !== '__all__' && String(r.tahun) !== tahun) return false;
      if (hasBukti === 'yes' && !r.bukti_path) return false;
      if (hasBukti === 'no' && r.bukti_path) return false;
      if (!q) return true;
      const hay = [
        r.program, r.kegiatan, r.sub_kegiatan, r.belanja, r.sumber_dana,
        r.kode_rup, r.no_kode_paket, r.no_surat_pesanan, r.keterangan, r.bukti_filename
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, bulan, tahun, hasBukti]);

  const buktiUrl = (path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from('bukti-realisasi').getPublicUrl(path);
    return data.publicUrl;
  };

  const startEdit = (r: EntryRow) => {
    setEditingId(r.id);
    setDraft({
      bulan: r.bulan,
      tahun: r.tahun,
      nilai_realisasi: Number(r.nilai_realisasi),
      kode_rup: r.kode_rup ?? '',
      no_kode_paket: r.no_kode_paket ?? '',
      no_surat_pesanan: r.no_surat_pesanan ?? '',
      keterangan: r.keterangan ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = async (id: string) => {
    if (!draft) return;
    setSaving(true);
    const { error } = await supabase
      .from('realisasi_entries')
      .update({
        bulan: draft.bulan,
        tahun: draft.tahun,
        nilai_realisasi: draft.nilai_realisasi,
        kode_rup: draft.kode_rup || null,
        no_kode_paket: draft.no_kode_paket || null,
        no_surat_pesanan: draft.no_surat_pesanan || null,
        keterangan: draft.keterangan || null,
        synced_to_sheet: false,
        synced_at: null,
      })
      .eq('id', id);
    if (error) {
      toast.error('Gagal menyimpan perubahan: ' + error.message);
      setSaving(false);
      return;
    }
    // Trigger ulang sync ke spreadsheet (best-effort, jangan blok UI jika gagal)
    try {
      await supabase.functions.invoke('sync-to-sheet', { body: { entryId: id } });
    } catch (e) {
      console.warn('Sync gagal, entry tetap tersimpan di database', e);
    }
    toast.success('Perubahan tersimpan');
    setSaving(false);
    setEditingId(null);
    setDraft(null);
    load();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Wadah Bukti Realisasi</CardTitle>
            <p className="text-xs text-muted-foreground">{filtered.length} entry · klik ikon pensil untuk edit · hapus hanya via spreadsheet</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1 h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari kode RUP, paket, surat..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 pl-7 text-xs"
            />
          </div>
          <Select value={bulan} onValueChange={setBulan}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Semua bulan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Semua bulan</SelectItem>
              {BULAN.map((b, i) => <SelectItem key={i} value={String(i + 1)} className="text-xs">{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tahun} onValueChange={setTahun}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Semua tahun" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Semua tahun</SelectItem>
              {tahunOptions.map(t => <SelectItem key={t} value={String(t)} className="text-xs">{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={hasBukti} onValueChange={setHasBukti}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Semua entry</SelectItem>
              <SelectItem value="yes">Ada bukti</SelectItem>
              <SelectItem value="no">Tanpa bukti</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[500px] overflow-auto rounded border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Tgl</TableHead>
                <TableHead className="text-xs">Periode</TableHead>
                <TableHead className="text-xs">Program / Kegiatan</TableHead>
                <TableHead className="text-xs">Kode RUP</TableHead>
                <TableHead className="text-xs">No. Paket</TableHead>
                <TableHead className="text-xs">No. SP</TableHead>
                <TableHead className="text-right text-xs">Nilai</TableHead>
                <TableHead className="text-xs">Bukti</TableHead>
                <TableHead className="text-xs">Sync</TableHead>
                <TableHead className="text-xs text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={10} className="text-center text-xs text-muted-foreground py-6">Memuat...</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-xs text-muted-foreground py-6">Belum ada entry</TableCell></TableRow>
              )}
              {filtered.map(r => {
                const url = buktiUrl(r.bukti_path);
                const isEditing = editingId === r.id;
                return (
                  <TableRow key={r.id} className="text-xs align-top">
                    <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {isEditing && draft ? (
                        <div className="flex gap-1">
                          <Select value={String(draft.bulan)} onValueChange={v => setDraft({ ...draft, bulan: Number(v) })}>
                            <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {BULAN.map((b, i) => <SelectItem key={i} value={String(i + 1)} className="text-xs">{b}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            value={draft.tahun}
                            onChange={e => setDraft({ ...draft, tahun: Number(e.target.value) })}
                            className="h-7 w-[70px] text-xs"
                          />
                        </div>
                      ) : (
                        <>{BULAN[r.bulan - 1]} {r.tahun}</>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="font-medium truncate" title={r.program}>{r.program}</div>
                      <div className="text-muted-foreground truncate" title={`${r.kegiatan} • ${r.sub_kegiatan}`}>{r.sub_kegiatan}</div>
                      {isEditing && draft && (
                        <Input
                          placeholder="Keterangan"
                          value={draft.keterangan}
                          onChange={e => setDraft({ ...draft, keterangan: e.target.value })}
                          className="h-7 mt-1 text-xs"
                        />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {isEditing && draft ? (
                        <Input value={draft.kode_rup} onChange={e => setDraft({ ...draft, kode_rup: e.target.value })} className="h-7 w-[120px] text-xs" />
                      ) : (r.kode_rup || '-')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {isEditing && draft ? (
                        <Input value={draft.no_kode_paket} onChange={e => setDraft({ ...draft, no_kode_paket: e.target.value })} className="h-7 w-[120px] text-xs" />
                      ) : (r.no_kode_paket || '-')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {isEditing && draft ? (
                        <Input value={draft.no_surat_pesanan} onChange={e => setDraft({ ...draft, no_surat_pesanan: e.target.value })} className="h-7 w-[120px] text-xs" />
                      ) : (r.no_surat_pesanan || '-')}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap font-medium text-green-600">
                      {isEditing && draft ? (
                        <Input
                          type="number"
                          value={draft.nilai_realisasi}
                          onChange={e => setDraft({ ...draft, nilai_realisasi: Number(e.target.value) })}
                          className="h-7 w-[130px] text-xs text-right"
                        />
                      ) : formatRupiah(Number(r.nilai_realisasi))}
                    </TableCell>
                    <TableCell>
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <FileDown className="h-3 w-3" />
                          <span className="max-w-[120px] truncate">{r.bukti_filename}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {r.synced_to_sheet
                        ? <Badge variant="secondary" className="text-[10px]">Synced</Badge>
                        : <Badge variant="outline" className="text-[10px]">Lokal</Badge>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="default" className="h-7 px-2" onClick={() => saveEdit(r.id)} disabled={saving}>
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={cancelEdit} disabled={saving}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => startEdit(r)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});

EvidenceLibrary.displayName = 'EvidenceLibrary';
export default EvidenceLibrary;
