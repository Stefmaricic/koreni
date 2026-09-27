-- Feedback: any signed-in user can submit a bug report / suggestion; only
-- the app owner (identified by email, not by a hardcoded id, since it must
-- survive the owner's account being recreated) can read submissions.

create table feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  user_email text,
  message text not null check (char_length(btrim(message)) > 0),
  page_path text,
  created_at timestamptz not null default now()
);

create index feedback_created_at_idx on feedback (created_at desc);

alter table feedback enable row level security;

create policy "feedback_insert_own" on feedback
  for insert with check (user_id = auth.uid());

-- Change this email if you register your real Koreni account under a
-- different address than the one this was set up for.
create policy "feedback_select_owner" on feedback
  for select using (auth.email() = 'mstefan44@gmail.com');
