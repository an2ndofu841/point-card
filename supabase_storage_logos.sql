-- Create storage bucket for Group Logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for logos
-- Allow public read access to logos
DROP POLICY IF EXISTS "Public Access Logos" ON storage.objects;
CREATE POLICY "Public Access Logos" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'logos' );

-- Allow authenticated users to upload logos
-- (Ideally should be admin only, but aligning with current app permissions)
DROP POLICY IF EXISTS "Authenticated Upload Logos" ON storage.objects;
CREATE POLICY "Authenticated Upload Logos" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'logos' AND auth.role() = 'authenticated' );

-- Allow authenticated users to update logos
DROP POLICY IF EXISTS "Authenticated Update Logos" ON storage.objects;
CREATE POLICY "Authenticated Update Logos"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'logos' AND auth.role() = 'authenticated' );

-- Allow authenticated users to delete logos
DROP POLICY IF EXISTS "Authenticated Delete Logos" ON storage.objects;
CREATE POLICY "Authenticated Delete Logos"
ON storage.objects FOR DELETE
USING ( bucket_id = 'logos' AND auth.role() = 'authenticated' );

