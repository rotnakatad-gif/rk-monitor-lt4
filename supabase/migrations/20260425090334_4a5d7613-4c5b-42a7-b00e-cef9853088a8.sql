CREATE POLICY "Public can delete entries"
ON public.realisasi_entries
FOR DELETE
TO public
USING (true);