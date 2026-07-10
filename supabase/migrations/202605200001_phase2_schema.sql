create extension if not exists pgcrypto;
create extension if not exists moddatetime schema extensions;
create extension if not exists vector;

create table if not exists public.novels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  global_setting text not null default '',
  worldbuilding text not null default '',
  library text not null default '',
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.novels
  add column if not exists worldbuilding text not null default '',
  add column if not exists library text not null default '';

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  memory_review_mode text not null default 'after_adopt' check (memory_review_mode in ('after_adopt', 'inbox')),
  memory_injection_enabled boolean not null default true,
  candidate_provider text not null default 'deepseek' check (candidate_provider in ('deepseek', 'openai')),
  openai_candidate_model text not null default 'gpt-4.1-mini',
  embedding_model text not null default 'text-embedding-3-small',
  embedding_dimensions integer not null default 1536,
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
  gender text not null default '',
  background text not null default '',
  personality text not null default '',
  goal text not null default '',
  secret text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.characters
  add column if not exists gender text not null default '',
  add column if not exists background text not null default '';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'characters'
      and column_name = 'role'
  ) then
    execute 'update public.characters set background = role where background = '''' and role <> ''''';
  end if;
end $$;

create table if not exists public.preference_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  novel_id uuid not null references public.novels(id) on delete cascade,
  kind text not null check (kind in ('like', 'avoid', 'style')),
  content text not null default '',
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

create table if not exists public.chapter_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  novel_id uuid not null references public.novels(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(chapter_id)
);

create table if not exists public.memory_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  novel_id uuid not null references public.novels(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  kind text not null check (kind in ('character', 'location', 'organization', 'item_or_ability', 'foreshadowing')),
  title text not null default '',
  summary text not null default '',
  detail text not null default '',
  tags text[] not null default '{}',
  source_excerpt text not null default '',
  importance integer not null default 3 check (importance between 1 and 5),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  novel_id uuid not null references public.novels(id) on delete cascade,
  kind text not null check (kind in ('character', 'location', 'organization', 'item_or_ability', 'foreshadowing')),
  title text not null default '',
  summary text not null default '',
  detail text not null default '',
  tags text[] not null default '{}',
  source_chapter_id uuid references public.chapters(id) on delete set null,
  source_excerpt text not null default '',
  importance integer not null default 3 check (importance between 1 and 5),
  status text not null default 'active' check (status in ('active', 'archived')),
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.match_memory_items(
  query_embedding vector(1536),
  query_novel_id uuid,
  match_count integer default 12
)
returns table (
  id uuid,
  novel_id uuid,
  kind text,
  title text,
  summary text,
  detail text,
  tags text[],
  source_chapter_id uuid,
  source_excerpt text,
  importance integer,
  status text,
  similarity double precision,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
as $$
  select
    memory_items.id,
    memory_items.novel_id,
    memory_items.kind,
    memory_items.title,
    memory_items.summary,
    memory_items.detail,
    memory_items.tags,
    memory_items.source_chapter_id,
    memory_items.source_excerpt,
    memory_items.importance,
    memory_items.status,
    1 - (memory_items.embedding <=> query_embedding) as similarity,
    memory_items.created_at,
    memory_items.updated_at
  from public.memory_items
  where memory_items.novel_id = query_novel_id
    and memory_items.status = 'active'
    and memory_items.embedding is not null
  order by memory_items.embedding <=> query_embedding
  limit match_count;
$$;

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

drop trigger if exists handle_updated_at on public.user_settings;
create trigger handle_updated_at
  before update on public.user_settings
  for each row execute procedure moddatetime(updated_at);

drop trigger if exists handle_updated_at on public.chapters;
create trigger handle_updated_at
  before update on public.chapters
  for each row execute procedure moddatetime(updated_at);

drop trigger if exists handle_updated_at on public.characters;
create trigger handle_updated_at
  before update on public.characters
  for each row execute procedure moddatetime(updated_at);

drop trigger if exists handle_updated_at on public.preference_notes;
create trigger handle_updated_at
  before update on public.preference_notes
  for each row execute procedure moddatetime(updated_at);

drop trigger if exists handle_updated_at on public.timeline_events;
create trigger handle_updated_at
  before update on public.timeline_events
  for each row execute procedure moddatetime(updated_at);

drop trigger if exists handle_updated_at on public.chapter_summaries;
create trigger handle_updated_at
  before update on public.chapter_summaries
  for each row execute procedure moddatetime(updated_at);

drop trigger if exists handle_updated_at on public.memory_candidates;
create trigger handle_updated_at
  before update on public.memory_candidates
  for each row execute procedure moddatetime(updated_at);

drop trigger if exists handle_updated_at on public.memory_items;
create trigger handle_updated_at
  before update on public.memory_items
  for each row execute procedure moddatetime(updated_at);

create index if not exists idx_novels_user_order
  on public.novels(user_id, sort_order);

create index if not exists idx_chapters_novel_order
  on public.chapters(novel_id, sort_order);

create index if not exists idx_characters_novel_order
  on public.characters(novel_id, sort_order);

create index if not exists idx_preference_notes_novel_order
  on public.preference_notes(novel_id, sort_order);

create index if not exists idx_timeline_events_novel_order
  on public.timeline_events(novel_id, sort_order);

create index if not exists idx_inspiration_messages_novel_created
  on public.inspiration_messages(novel_id, created_at);

create index if not exists idx_generation_runs_novel_created
  on public.generation_runs(novel_id, created_at desc);

create index if not exists idx_chapter_summaries_novel
  on public.chapter_summaries(novel_id, chapter_id);

create index if not exists idx_memory_candidates_novel_status
  on public.memory_candidates(novel_id, status, created_at desc);

create index if not exists idx_memory_items_novel_kind_status
  on public.memory_items(novel_id, kind, status);

create index if not exists idx_memory_items_embedding
  on public.memory_items using ivfflat (embedding vector_cosine_ops)
  with (lists = 100)
  where embedding is not null;

alter table public.user_settings enable row level security;
alter table public.novels enable row level security;
alter table public.chapters enable row level security;
alter table public.characters enable row level security;
alter table public.preference_notes enable row level security;
alter table public.timeline_events enable row level security;
alter table public.inspiration_messages enable row level security;
alter table public.chapter_summaries enable row level security;
alter table public.memory_candidates enable row level security;
alter table public.memory_items enable row level security;
alter table public.generation_runs enable row level security;

drop policy if exists "Users can read own settings" on public.user_settings;
create policy "Users can read own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own novels" on public.novels;
create policy "Users can read own novels"
  on public.novels for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own novels" on public.novels;
create policy "Users can insert own novels"
  on public.novels for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own novels" on public.novels;
create policy "Users can update own novels"
  on public.novels for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own novels" on public.novels;
create policy "Users can delete own novels"
  on public.novels for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own chapters" on public.chapters;
create policy "Users can read own chapters"
  on public.chapters for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own chapters" on public.chapters;
create policy "Users can insert own chapters"
  on public.chapters for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own chapters" on public.chapters;
create policy "Users can update own chapters"
  on public.chapters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own chapters" on public.chapters;
create policy "Users can delete own chapters"
  on public.chapters for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own characters" on public.characters;
create policy "Users can read own characters"
  on public.characters for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own characters" on public.characters;
create policy "Users can insert own characters"
  on public.characters for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own characters" on public.characters;
create policy "Users can update own characters"
  on public.characters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own characters" on public.characters;
create policy "Users can delete own characters"
  on public.characters for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own preference notes" on public.preference_notes;
create policy "Users can read own preference notes"
  on public.preference_notes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own preference notes" on public.preference_notes;
create policy "Users can insert own preference notes"
  on public.preference_notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own preference notes" on public.preference_notes;
create policy "Users can update own preference notes"
  on public.preference_notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own preference notes" on public.preference_notes;
create policy "Users can delete own preference notes"
  on public.preference_notes for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own timeline events" on public.timeline_events;
create policy "Users can read own timeline events"
  on public.timeline_events for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own timeline events" on public.timeline_events;
create policy "Users can insert own timeline events"
  on public.timeline_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own timeline events" on public.timeline_events;
create policy "Users can update own timeline events"
  on public.timeline_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own timeline events" on public.timeline_events;
create policy "Users can delete own timeline events"
  on public.timeline_events for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own inspiration messages" on public.inspiration_messages;
create policy "Users can read own inspiration messages"
  on public.inspiration_messages for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own inspiration messages" on public.inspiration_messages;
create policy "Users can insert own inspiration messages"
  on public.inspiration_messages for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own inspiration messages" on public.inspiration_messages;
create policy "Users can delete own inspiration messages"
  on public.inspiration_messages for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own chapter summaries" on public.chapter_summaries;
create policy "Users can read own chapter summaries"
  on public.chapter_summaries for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own chapter summaries" on public.chapter_summaries;
create policy "Users can insert own chapter summaries"
  on public.chapter_summaries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own chapter summaries" on public.chapter_summaries;
create policy "Users can update own chapter summaries"
  on public.chapter_summaries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own memory candidates" on public.memory_candidates;
create policy "Users can read own memory candidates"
  on public.memory_candidates for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own memory candidates" on public.memory_candidates;
create policy "Users can insert own memory candidates"
  on public.memory_candidates for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own memory candidates" on public.memory_candidates;
create policy "Users can update own memory candidates"
  on public.memory_candidates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own memory items" on public.memory_items;
create policy "Users can read own memory items"
  on public.memory_items for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own memory items" on public.memory_items;
create policy "Users can insert own memory items"
  on public.memory_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own memory items" on public.memory_items;
create policy "Users can update own memory items"
  on public.memory_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own generation runs" on public.generation_runs;
create policy "Users can read own generation runs"
  on public.generation_runs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own generation runs" on public.generation_runs;
create policy "Users can insert own generation runs"
  on public.generation_runs for insert
  with check (auth.uid() = user_id);
