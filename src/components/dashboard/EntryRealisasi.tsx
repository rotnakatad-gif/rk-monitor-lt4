import { memo, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BULAN, getUniqueValues, type BudgetRow } from '@/lib/spreadsheet';

interface Props {
  data: BudgetRow[];
  onSaved?: () => void;
}

const initialForm = {
  program: '',
  kegiatan: '',
  subKegiatan: '',
  belanja: '',
  sumberDana: '',
  bulan: String(new Date().getMonth() + 1),
  tahun: String(new Date().getFullYear()),
  nilai: '',
  kodeRup: '',
  noKodePaket: '',
  noSuratPesanan: '',
  keterangan: '',
};

const EntryRealisasi = memo(({ data, onSaved }: Props) => {
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string) => {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      // cascade reset
      const order: (keyof typeof form)[] = ['program', 'kegiatan', 'subKegiatan', 'belanja', 'sumberDana'];
      const idx = order.indexOf(k);
      if (idx !== -1) for (let i = idx + 1; i < order.length; i++) next[order[i]] = '';
      return next;
    });
  };

  const programOptions = useMemo(() => getUniqueValues(data, 'program'), [data]);
  const filterP = useMemo(() => form.program ? data.filter(r => r.program === form.program) : [], [data, form.program]);
  const kegiatanOptions = useMemo(() => getUniqueValues(filterP, 'kegiatan'), [filterP]);
  const filterK = useMemo(() => form.kegiatan ? filterP.filter(r => r.kegiatan === form.kegiatan) : [], [filterP, form.kegiatan]);
  const subOptions = useMemo(() => getUniqueValues(filterK, 'subKegiatan'), [filterK]);
  const filterS = useMemo(() => form.subKegiatan ? filterK.filter(r => r.subKegiatan === form.subKegiatan) : [], [filterK, form.subKegiatan]);
  const belanjaOptions = useMemo(() => getUniqueValues(filterS, 'belanja'), [filterS]);
  const filterB = useMemo(() => form.belanja ? filterS.filter(r => r.belanja === form.belanja) : [], [filterS, form.belanja]);
  const sumberOptions = useMemo(() => getUniqueValues(filterB, 'sumberDana'), [filterB]);

  const reset = () => { setForm(initialForm); setFile(null); };

  const submit = useCallback(async () => {
    if (!form.program || !form.kegiatan || !form.subKegiatan || !form.belanja || !form.sumberDana) {
      toast.error('Lengkapi semua dropdown (program s/d sumber dana)');
      return;
    }
    const nilai = Number(form.nilai.replace(/\./g, '').replace(/,/g, '.'));
    if (!nilai || nilai <= 0) {
      toast.error('Nilai realisasi harus lebih dari 0');
      return;
    }
    setSaving(true);
    try {
      let bukti_path: string | null = null;
      let bukti_filename: string | null = null;
      let bukti_mimetype: string | null = null;

      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error('Ukuran file maksimal 10 MB');
          setSaving(false);
          return;
        }
        const safeName = file.name.replace(/[^\w.\-]+/g, '_');
        const path = `${form.tahun}/${form.bulan.padStart(2, '0')}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from('bukti-realisasi')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        bukti_path = path;
        bukti_filename = file.name;
        bukti_mimetype = file.type;
      }

      const { data: inserted, error } = await supabase.from('realisasi_entries').insert({
        program: form.program,
        kegiatan: form.kegiatan,
        sub_kegiatan: form.subKegiatan,
        belanja: form.belanja,
        sumber_dana: form.sumberDana,
        bulan: Number(form.bulan),
        tahun: Number(form.tahun),
        nilai_realisasi: nilai,
        kode_rup: form.kodeRup || null,
        no_kode_paket: form.noKodePaket || null,
        no_surat_pesanan: form.noSuratPesanan || null,
        keterangan: form.keterangan || null,
        bukti_path,
        bukti_filename,
        bukti_mimetype,
      }).select().single();

      if (error) throw error;

      // Try sync to spreadsheet (non-blocking)
      supabase.functions.invoke('sync-to-sheet', { body: { entry_id: inserted.id } })
        .then(({ error: e }) => {
          if (e) console.warn('Sync sheet gagal (entry tetap tersimpan di database):', e.message);
        });

      toast.success('Entry tersimpan');
      reset();
      onSaved?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [form, file, onSaved]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Entry Realisasi Anggaran</CardTitle>
        <p className="text-xs text-muted-foreground">
          Pilih item dari dropdown (sama dengan filter dashboard) lalu isi nilai realisasi. Boleh entry berkali-kali dalam 1 bulan.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Program *">
            <SelectField value={form.program} options={programOptions} placeholder="Pilih program" onChange={v => set('program', v)} />
          </Field>
          <Field label="Kegiatan *">
            <SelectField value={form.kegiatan} options={kegiatanOptions} placeholder="Pilih kegiatan" onChange={v => set('kegiatan', v)} disabled={!form.program} />
          </Field>
          <Field label="Sub Kegiatan *">
            <SelectField value={form.subKegiatan} options={subOptions} placeholder="Pilih sub kegiatan" onChange={v => set('subKegiatan', v)} disabled={!form.kegiatan} />
          </Field>
          <Field label="Belanja *">
            <SelectField value={form.belanja} options={belanjaOptions} placeholder="Pilih belanja" onChange={v => set('belanja', v)} disabled={!form.subKegiatan} />
          </Field>
          <Field label="Sumber Dana *">
            <SelectField value={form.sumberDana} options={sumberOptions} placeholder="Pilih sumber dana" onChange={v => set('sumberDana', v)} disabled={!form.belanja} />
          </Field>
          <Field label="Bulan *">
            <Select value={form.bulan} onValueChange={v => set('bulan', v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BULAN.map((b, i) => <SelectItem key={i} value={String(i + 1)} className="text-xs">{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tahun *">
            <Input className="h-9 text-xs" type="number" value={form.tahun} onChange={e => set('tahun', e.target.value)} />
          </Field>
          <Field label="Nilai Realisasi (Rp) *">
            <Input className="h-9 text-xs" inputMode="numeric" placeholder="contoh: 1500000"
              value={form.nilai} onChange={e => set('nilai', e.target.value)} />
          </Field>
          <Field label="Kode RUP">
            <Input className="h-9 text-xs" value={form.kodeRup} onChange={e => set('kodeRup', e.target.value)} />
          </Field>
          <Field label="No. Kode Paket">
            <Input className="h-9 text-xs" value={form.noKodePaket} onChange={e => set('noKodePaket', e.target.value)} />
          </Field>
          <Field label="No. Surat Pesanan">
            <Input className="h-9 text-xs" value={form.noSuratPesanan} onChange={e => set('noSuratPesanan', e.target.value)} />
          </Field>
        </div>

        <Field label="Keterangan">
          <Textarea className="text-xs" rows={2} value={form.keterangan} onChange={e => set('keterangan', e.target.value)} />
        </Field>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">Bukti (PDF / JPG / PNG, maks 10 MB)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept="application/pdf,image/*"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="text-xs"
            />
            {file && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{file.name}</span>}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={submit} disabled={saving} size="sm">
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
            Simpan Entry
          </Button>
          <Button onClick={reset} variant="outline" size="sm" disabled={saving}>Reset</Button>
        </div>
      </CardContent>
    </Card>
  );
});

EntryRealisasi.displayName = 'EntryRealisasi';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SelectField({ value, options, placeholder, onChange, disabled }: {
  value: string; options: string[]; placeholder: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-9 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default EntryRealisasi;
