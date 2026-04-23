
CREATE TABLE public.realisasi_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program TEXT NOT NULL,
  kegiatan TEXT NOT NULL,
  sub_kegiatan TEXT NOT NULL,
  belanja TEXT NOT NULL,
  sumber_dana TEXT NOT NULL,
  bulan SMALLINT NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  tahun SMALLINT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  nilai_realisasi NUMERIC(18,2) NOT NULL DEFAULT 0,
  kode_rup TEXT,
  no_kode_paket TEXT,
  no_surat_pesanan TEXT,
  keterangan TEXT,
  bukti_path TEXT,
  bukti_filename TEXT,
  bukti_mimetype TEXT,
  synced_to_sheet BOOLEAN NOT NULL DEFAULT FALSE,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_realisasi_bulan ON public.realisasi_entries(tahun, bulan);
CREATE INDEX idx_realisasi_program ON public.realisasi_entries(program, kegiatan, sub_kegiatan);
CREATE INDEX idx_realisasi_kode_rup ON public.realisasi_entries(kode_rup);
CREATE INDEX idx_realisasi_kode_paket ON public.realisasi_entries(no_kode_paket);
CREATE INDEX idx_realisasi_surat ON public.realisasi_entries(no_surat_pesanan);

ALTER TABLE public.realisasi_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read entries"
  ON public.realisasi_entries FOR SELECT
  USING (true);

CREATE POLICY "Public can insert entries"
  ON public.realisasi_entries FOR INSERT
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_realisasi_updated
  BEFORE UPDATE ON public.realisasi_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('bukti-realisasi', 'bukti-realisasi', true);

CREATE POLICY "Public read bukti"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bukti-realisasi');

CREATE POLICY "Public upload bukti"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bukti-realisasi');
