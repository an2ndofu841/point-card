-- ==========================================
-- Soft delete for groups
-- ==========================================
alter table public.groups
  add column if not exists deleted_at timestamptz;
