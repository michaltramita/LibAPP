-- Sales voice sessions and messages RLS setup

alter table public.sales_voice_sessions
  add column if not exists user_id uuid references auth.users (id);

alter table public.sales_voice_messages
  add column if not exists user_id uuid references auth.users (id);

alter table public.sales_voice_sessions enable row level security;
alter table public.sales_voice_messages enable row level security;

drop policy if exists "sales_sessions_select_own" on public.sales_voice_sessions;
drop policy if exists "sales_sessions_insert_own" on public.sales_voice_sessions;
drop policy if exists "sales_sessions_update_own" on public.sales_voice_sessions;

create policy "sales_sessions_select_own"
  on public.sales_voice_sessions
  for select
  using (user_id = auth.uid());

create policy "sales_sessions_insert_own"
  on public.sales_voice_sessions
  for insert
  with check (user_id = auth.uid());

create policy "sales_sessions_update_own"
  on public.sales_voice_sessions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "sales_messages_select_own" on public.sales_voice_messages;
drop policy if exists "sales_messages_insert_own" on public.sales_voice_messages;

create policy "sales_messages_select_own"
  on public.sales_voice_messages
  for select
  using (user_id = auth.uid());

create policy "sales_messages_insert_own"
  on public.sales_voice_messages
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.sales_voice_sessions sessions
      where sessions.id = sales_voice_messages.session_id
        and sessions.user_id = auth.uid()
    )
  );
