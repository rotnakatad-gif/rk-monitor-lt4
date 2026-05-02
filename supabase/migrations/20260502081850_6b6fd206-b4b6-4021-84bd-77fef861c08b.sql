ALTER TABLE public.realisasi_entries
ADD COLUMN IF NOT EXISTS tanggal_realisasi date;

UPDATE public.realisasi_entries
SET tanggal_realisasi = make_date(tahun::int, bulan::int, 1)
WHERE tanggal_realisasi IS NULL;