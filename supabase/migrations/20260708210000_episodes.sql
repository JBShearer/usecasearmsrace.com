-- UCAR 3.0: episodes managed from the admin area.
create table episodes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  video_url text,            -- embeddable url for the featured player
  link_url text,             -- where the chip links (YouTube, etc.)
  featured boolean not null default false,
  published boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table episodes enable row level security;
create policy episodes_read on episodes for select using (published);
-- writes only via the episodes edge function with ADMIN_KEY
