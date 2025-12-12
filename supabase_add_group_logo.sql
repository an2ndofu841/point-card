-- Add logo_url to groups table
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name = 'groups' and column_name = 'logo_url') then
    alter table public.groups 
    add column logo_url text;
  end if;
end $$;

-- Create logos bucket
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Set up access policies for the logos bucket
create policy "Logo images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'logos' );

-- Allow authenticated users (Admins) to upload logos
create policy "Authenticated users can upload logos."
  on storage.objects for insert
  with check ( bucket_id = 'logos' and auth.role() = 'authenticated' );

-- Allow authenticated users (Admins) to update logos
create policy "Authenticated users can update logos."
  on storage.objects for update
  using ( bucket_id = 'logos' and auth.role() = 'authenticated' )
  with check ( bucket_id = 'logos' and auth.role() = 'authenticated' );

