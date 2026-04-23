CREATE POLICY "Public can update entries"
ON public.realisasi_entries
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);