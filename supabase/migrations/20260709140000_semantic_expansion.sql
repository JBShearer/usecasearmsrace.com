-- UCAR 3.1: the semantic expansion engine.
-- Fixed for actual schema

create extension if not exists pg_trgm;

create table if not exists term_expansions (
  term text not null,
  alt text not null,
  weight real not null,
  source text not null,
  primary key (term, alt, source)
);
create index if not exists idx_expansions_term on term_expansions (term);

create table if not exists search_signals (
  id uuid primary key default gen_random_uuid(),
  terms text[] not null,
  case_id uuid references cases(id) on delete cascade,
  event text not null check (event in ('open','vote','file')),
  voter text,
  created_at timestamptz not null default now()
);
create index if not exists idx_signals_terms on search_signals using gin (terms);
create index if not exists idx_signals_time on search_signals (created_at);

-- Trigram indexes for fuzzy matching
create index if not exists idx_entities_trgm
  on entities using gin (canonical_name gin_trgm_ops);
create index if not exists idx_actions_trgm
  on actions using gin (canonical_verb gin_trgm_ops);
create index if not exists idx_modifiers_trgm
  on modifiers using gin (term gin_trgm_ops);

-- Fuzzy snap function
create or replace function fuzzy_snap(tokens text[])
returns table (token text, snapped text, sim real)
language sql stable as $$
  with vocab as (
    select lower(canonical_name) v from entities
    union select lower(canonical_verb) from actions
    union select term from modifiers
  ), t as (select unnest(tokens) tok)
  select distinct on (t.tok) t.tok, vocab.v,
    similarity(t.tok, vocab.v)::real
  from t join vocab on similarity(t.tok, vocab.v) >= 0.38
  order by t.tok, similarity(t.tok, vocab.v) desc;
$$;

-- Rebuild the prepack
create or replace function refresh_expansions() returns int
language plpgsql as $$
declare n int;
begin
  truncate term_expansions;

  -- entity aliases (both directions)
  insert into term_expansions
  select lower(e.canonical_name), lower(a.alias), 1.0, 'alias'
  from entities e, unnest(coalesce(e.aliases, '{}')) a(alias)
  where a.alias is not null and a.alias <> ''
  on conflict do nothing;

  insert into term_expansions
  select lower(a.alias), lower(e.canonical_name), 1.0, 'alias'
  from entities e, unnest(coalesce(e.aliases, '{}')) a(alias)
  where a.alias is not null and a.alias <> ''
  on conflict do nothing;

  -- action synonyms (both directions)
  insert into term_expansions
  select lower(ac.canonical_verb), lower(syn.s), 1.0, 'alias'
  from actions ac, unnest(coalesce(ac.synonyms, '{}')) syn(s)
  where syn.s is not null and syn.s <> ''
  on conflict do nothing;

  insert into term_expansions
  select lower(syn.s), lower(ac.canonical_verb), 1.0, 'alias'
  from actions ac, unnest(coalesce(ac.synonyms, '{}')) syn(s)
  where syn.s is not null and syn.s <> ''
  on conflict do nothing;

  -- entity hierarchy (Utah -> State)
  insert into term_expansions
  select lower(child.canonical_name), lower(parent.canonical_name),
    0.7, 'hierarchy'
  from entities child join entities parent on child.parent_id = parent.id
  where child.parent_id is not null
  on conflict do nothing;

  insert into term_expansions
  select lower(parent.canonical_name), lower(child.canonical_name),
    0.55, 'hierarchy'
  from entities child join entities parent on child.parent_id = parent.id
  where child.parent_id is not null
  on conflict do nothing;

  -- modifier co-occurrence
  insert into term_expansions
  select a.term, b.term,
    least(0.5, 0.12 * count(*))::real, 'cooccur'
  from modifiers a join modifiers b
    on a.case_id = b.case_id and a.term <> b.term
  group by a.term, b.term having count(*) >= 2
  on conflict do nothing;

  -- graph edges (src_key / dst_key in actual schema)
  insert into term_expansions
  select lower(src_key), lower(dst_key),
    least(0.6, 0.1 * weight)::real, 'edge'
  from graph_edges where weight >= 2 and src_key <> dst_key
  on conflict do nothing;

  -- learned from usage (last 60 days)
  insert into term_expansions
  select qt.term, mt.term,
    least(0.4, 0.08 * count(*))::real, 'usage'
  from search_signals s
    cross join lateral unnest(s.terms) qt(term)
    join cases c on c.id = s.case_id
    cross join lateral unnest(c.modifier_terms) mt(term)
  where s.created_at > now() - interval '60 days'
    and qt.term <> mt.term
  group by qt.term, mt.term having count(*) >= 2
  on conflict do nothing;

  select count(*) into n from term_expansions;
  return n;
end $$;

alter table term_expansions enable row level security;
alter table search_signals enable row level security;
drop policy if exists expansions_read on term_expansions;
create policy expansions_read on term_expansions for select using (true);

select refresh_expansions();
