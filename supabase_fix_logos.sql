-- Fix Group Logos Setup
-- Run this SQL to ensure the database and storage are ready for group logos

-- 1. Ensure logo_url column exists in groups table
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'logo_url') THEN
    ALTER TABLE public.groups ADD COLUMN logo_url TEXT;
  END IF;
END $$;

-- 2. Create 'logos' storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set Storage Policies for 'logos' bucket
-- Allows public to view logos, and authenticated users (admins) to upload/manage them.

-- Remove old policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access Logos" ON storage.objects;
DROP POLICY IF EXISTS "Logo images are publicly accessible." ON storage.objects;

DROP POLICY IF EXISTS "Authenticated Upload Logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload logos." ON storage.objects;

DROP POLICY IF EXISTS "Authenticated Update Logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos." ON storage.objects;

DROP POLICY IF EXISTS "Authenticated Delete Logos" ON storage.objects;

-- Create new policies
-- Public Read
CREATE POLICY "Public Access Logos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'logos' );

-- Authenticated Write (Upload)
CREATE POLICY "Authenticated Upload Logos"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'logos' AND auth.role() = 'authenticated' );

-- Authenticated Update
CREATE POLICY "Authenticated Update Logos"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'logos' AND auth.role() = 'authenticated' );

-- Authenticated Delete
CREATE POLICY "Authenticated Delete Logos"
ON storage.objects FOR DELETE
USING ( bucket_id = 'logos' AND auth.role() = 'authenticated' );

