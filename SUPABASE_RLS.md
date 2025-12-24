# Supabase RLS policies for sales simulator

Apply these policies to align with user-scoped access for sales sessions and messages.

```sql
-- Sessions table
alter table sales_voice_sessions enable row level security;

create policy "select_own_sales_sessions"
  on sales_voice_sessions
  for select
  using (auth.uid() = user_id);

create policy "insert_own_sales_sessions"
  on sales_voice_sessions
  for insert
  with check (auth.uid() = user_id);

create policy "update_own_sales_sessions"
  on sales_voice_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Messages table (ties ownership to the parent session)
alter table sales_voice_messages enable row level security;

create policy "select_messages_for_own_sessions"
  on sales_voice_messages
  for select
  using (
    exists (
      select 1
      from sales_voice_sessions
      where sales_voice_sessions.id = sales_voice_messages.session_id
        and sales_voice_sessions.user_id = auth.uid()
    )
  );

create policy "insert_messages_for_own_sessions"
  on sales_voice_messages
  for insert
  with check (
    exists (
      select 1
      from sales_voice_sessions
      where sales_voice_sessions.id = sales_voice_messages.session_id
        and sales_voice_sessions.user_id = auth.uid()
    )
  );

create policy "update_messages_for_own_sessions"
  on sales_voice_messages
  for update
  using (
    exists (
      select 1
      from sales_voice_sessions
      where sales_voice_sessions.id = sales_voice_messages.session_id
        and sales_voice_sessions.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from sales_voice_sessions
      where sales_voice_sessions.id = sales_voice_messages.session_id
        and sales_voice_sessions.user_id = auth.uid()
    )
  );
```
