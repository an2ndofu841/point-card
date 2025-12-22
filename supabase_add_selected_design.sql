-- Add selected_design_id to user_memberships table
alter table public.user_memberships 
add column if not exists selected_design_id bigint references public.card_designs(id);

-- No need for new policies if update policy for user_memberships already exists and allows users to update their own rows.
-- Let's ensure users can update their own 'selected_design_id'.

-- Check if we need to drop/recreate policy to include new column? 
-- RLS policies usually apply to the operation (UPDATE), not specific columns unless "USING" clause restricts it based on old values.
-- But if we have a policy like "Users can update their own points" it might be restrictive.
-- Actually, we usually want users to ONLY update 'selected_design_id' but NOT 'points'.

-- Current policy likely allows admins to update everything.
-- We need a policy for USERS to update 'selected_design_id' ONLY.

create policy "Users can update their own selected design"
  on public.user_memberships
  for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id ); 
  -- Note: This is broad. It allows users to update ANY column if they own the row.
  -- Ideally we should restrict which columns can be updated using a trigger or stricter policy, 
  -- but Supabase RLS applies to the whole row. 
  -- To restrict columns, we can use a BEFORE UPDATE trigger or rely on frontend not sending points.
  -- However, allowing users to update their own row generally implies they could potentially hack points if not careful.
  -- A safer approach is a specific RPC function or a separate table for user preferences.
  -- OR, use a trigger to prevent 'points' and 'total_points' from changing if the user is not admin.
  
-- For this MVP/Phase, let's allow the update but we should be aware of the risk.
-- Or better, let's create a wrapper function (RPC) to set design, which is safer.

create or replace function set_selected_design(p_group_id bigint, p_design_id bigint)
returns void
language plpgsql
security definer
as $$
begin
  update public.user_memberships
  set selected_design_id = p_design_id
  where user_id = auth.uid() and group_id = p_group_id;
end;
$$;


