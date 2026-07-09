-- UCAR 3.0 Registry: one-tap good/evil votes + community modifiers.
-- Votes: one per identity per case, switchable, clearable. Counts are
-- maintained transactionally by apply_case_vote so the feed numbers are
-- always consistent with the vote rows.

create table case_votes (
  case_id uuid not null references cases(id) on delete cascade,
  voter text not null,               -- auth uuid or anon device uuid
  vote smallint not null check (vote in (1, -1)),  -- 1 heaven/good, -1 hell/evil
  created_at timestamptz not null default now(),
  primary key (case_id, voter)
);
create index idx_case_votes_case on case_votes (case_id);

create or replace function apply_case_vote(
  p_case uuid, p_voter text, p_vote smallint  -- 0 clears
) returns table (heaven int, hell int, your_vote smallint)
language plpgsql security definer as $$
begin
  if p_vote = 0 then
    delete from case_votes where case_id = p_case and voter = p_voter;
  else
    insert into case_votes (case_id, voter, vote) values (p_case, p_voter, p_vote)
    on conflict (case_id, voter) do update set vote = excluded.vote,
      created_at = now();
  end if;
  update cases c set
    heaven_votes = (select count(*) from case_votes v
      where v.case_id = p_case and v.vote = 1),
    hell_votes = (select count(*) from case_votes v
      where v.case_id = p_case and v.vote = -1)
  where c.id = p_case;
  return query
    select c.heaven_votes, c.hell_votes,
      coalesce((select v.vote from case_votes v
        where v.case_id = p_case and v.voter = p_voter), 0)::smallint
    from cases c where c.id = p_case;
end $$;

-- Community contributions are MODIFIERS only: typed terms attached to a
-- slot of the triple (or the case). They are the Wikipedia layer AND the
-- search index: every accepted modifier becomes graph vocabulary.
create table modifiers (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  slot text not null check (slot in ('who','action','whom','case')),
  kind text not null check (kind in
    ('adjective','adverb','proper_noun','compound')),
  term text not null,                -- normalized lowercase
  support int not null default 1,    -- re-submissions strengthen, wiki-style
  submitter text,
  created_at timestamptz not null default now(),
  unique (case_id, slot, term)
);
create index idx_modifiers_case on modifiers (case_id);
create index idx_modifiers_term on modifiers (term);

-- Denormalized term array on cases for O(1) feed rendering and GIN search.
alter table cases add column modifier_terms text[] not null default '{}';
create index idx_cases_modterms on cases using gin (modifier_terms);

create or replace function sync_modifier_terms() returns trigger
language plpgsql as $$
declare v_case uuid;
begin
  v_case := coalesce(new.case_id, old.case_id);
  update cases set modifier_terms = coalesce(
    (select array_agg(distinct term) from modifiers where case_id = v_case),
    '{}') where id = v_case;
  return null;
end $$;
create trigger trg_sync_modifiers
after insert or update or delete on modifiers
for each row execute function sync_modifier_terms();

alter table case_votes enable row level security;
alter table modifiers enable row level security;
create policy votes_read on case_votes for select using (true);
create policy modifiers_read on modifiers for select using (true);
-- writes only via edge functions (service role)
