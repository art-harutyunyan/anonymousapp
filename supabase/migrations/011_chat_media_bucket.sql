-- =====================================================================
-- Anonymous Match — Chat Media Storage Bucket Migration 011
-- =====================================================================

-- Chat media bucket: images up to 10 MB, videos up to 50 MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  false,   -- NOT public; served via signed URLs to preserve anonymity
  52428800, -- 50 MB max
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS: only authenticated users who are participants in a match may
-- upload media under that match's folder (chat-media/<match_id>/<user_id>/*)
CREATE POLICY "chat-media: participant can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE id = (storage.foldername(name))[1]::UUID
        AND (user_a = auth.uid() OR user_b = auth.uid())
        AND is_active = TRUE
    )
  );

CREATE POLICY "chat-media: participant can read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE id = (storage.foldername(name))[1]::UUID
        AND (user_a = auth.uid() OR user_b = auth.uid())
    )
  );

CREATE POLICY "chat-media: uploader can delete own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
