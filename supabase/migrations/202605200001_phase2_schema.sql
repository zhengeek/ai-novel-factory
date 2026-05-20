create extension if not exists pgcrypto;
create extension if not exists moddatetime schema extensions;

create table if not exists public.novels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  global_setting text not null default '',
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  novel_id uuid not null references public.novels(id) on delete cascade,
  title text not null default '未命名章节',
  outline text not null default '',
  content text not null default '',
  status text not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  novel_id uuid not null references public.novels(id) on delete cascade,
  name text not null default '未命名角色',
  role text not null default '',
  personality text not null default '',
  goal text not null default '',
  secret text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  novel_id uuid not null references public.novels(id) on delete cascade,
  marker text not null default '',
  title text not null default '未命名事件',
  description text not null default '',
  impact text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspiration_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  novel_id uuid not null references public.novels(id) on delete cascade,
  author text not null check (author in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.generation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  novel_id uuid not null references public.novels(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  model text not null,
  status text not null check (status in ('success', 'error')),
  input_summary text not null default '',
  output_preview text not null default '',
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  prompt_cache_hit_tokens integer not null default 0,
  prompt_cache_miss_tokens integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

drop trigger if exists handle_updated_at on public.novels;
create trigger handle_updated_at
  before update on public.novels
  for each row execute procedure moddatetime(updated_at);

drop trigger if exists handle_updated_at on public.chapters;
create trigger handle_updated_at
  before update on public.chapters
  for each row execute procedure moddatetime(updated_at);

drop trigger if exists handle_updated_at on public.characters;
create trigger handle_updated_at
  before update on public.characters
  for each row execute procedure moddatetime(updated_at);

drop trigger if exists handle_updated_at on public.timeline_events;
create trigger handle_updated_at
  before update on public.timeline_events
  for each row execute procedure moddatetime(updated_at);

create index if not exists idx_novels_user_order
  on public.novels(user_id, sort_order);

create index if not exists idx_chapters_novel_order
  on public.chapters(novel_id, sort_order);

create index if not exists idx_characters_novel_order
  on public.characters(novel_id, sort_order);

create index if not exists idx_timeline_events_novel_order
  on public.timeline_events(novel_id, sort_order);

create index if not exists idx_inspiration_messages_novel_created
  on public.inspiration_messages(novel_id, created_at);

create index if not exists idx_generation_runs_novel_created
  on public.generation_runs(novel_id, created_at desc);

alter table public.novels enable row level security;
alter table public.chapters enable row level security;
alter table public.characters enable row level security;
alter table public.timeline_events enable row level security;
alter table public.inspiration_messages enable row level security;
alter table public.generation_runs enable row level security;

create policy "Users can read own novels"
  on public.novels for select
  using (auth.uid() = user_id);

create policy "Users can insert own novels"
  on public.novels for insert
  with check (auth.uid() = user_id);

create policy "Users can update own novels"
  on public.novels for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own novels"
  on public.novels for delete
  using (auth.uid() = user_id);

create policy "Users can read own chapters"
  on public.chapters for select
  using (auth.uid() = user_id);

create policy "Users can insert own chapters"
  on public.chapters for insert
  with check (auth.uid() = user_id);

create policy "Users can update own chapters"
  on public.chapters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own chapters"
  on public.chapters for delete
  using (auth.uid() = user_id);

create policy "Users can read own characters"
  on public.characters for select
  using (auth.uid() = user_id);

create policy "Users can insert own characters"
  on public.characters for insert
  with check (auth.uid() = user_id);

create policy "Users can update own characters"
  on public.characters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own characters"
  on public.characters for delete
  using (auth.uid() = user_id);

create policy "Users can read own timeline events"
  on public.timeline_events for select
  using (auth.uid() = user_id);

create policy "Users can insert own timeline events"
  on public.timeline_events for insert
  with check (auth.uid() = user_id);

create policy "Users can update own timeline events"
  on public.timeline_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own timeline events"
  on public.timeline_events for delete
  using (auth.uid() = user_id);

create policy "Users can read own inspiration messages"
  on public.inspiration_messages for select
  using (auth.uid() = user_id);

create policy "Users can insert own inspiration messages"
  on public.inspiration_messages for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own inspiration messages"
  on public.inspiration_messages for delete
  using (auth.uid() = user_id);

create policy "Users can read own generation runs"
  on public.generation_runs for select
  using (auth.uid() = user_id);

create policy "Users can insert own generation runs"
  on public.generation_runs for insert
  with check (auth.uid() = user_id);
