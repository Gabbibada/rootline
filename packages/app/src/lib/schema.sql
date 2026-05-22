-- ══════════════════════════════════════════════════════════════════════════════
-- Rootline — Supabase Schema
-- Run once in: https://supabase.com/dashboard/project/gqnwoilptknabjjnzczf/sql/new
-- ══════════════════════════════════════════════════════════════════════════════


-- ── Extensions ────────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";


-- ── Tables ────────────────────────────────────────────────────────────────────

create table if not exists trees (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists members (
  id         uuid primary key,
  tree_id    uuid not null references trees(id)    on delete cascade,
  user_id    uuid          references auth.users(id) on delete set null,
  name       text not null,
  nickname   text,
  gender     text check (gender in ('M', 'F', 'NB')),
  birthday   text,          -- 'YYYY-MM-DD' string (matches engine convention)
  photo      text,          -- public storage URL
  location   text,
  story      text,
  deceased   boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists relationships (
  id         uuid primary key,
  tree_id    uuid not null references trees(id)   on delete cascade,
  from_id    uuid not null references members(id) on delete cascade,
  to_id      uuid not null references members(id) on delete cascade,
  type       text not null check (type in ('parent', 'spouse')),
  subtype    text not null default 'biological',
  created_at timestamptz default now()
);


-- ── Realtime ──────────────────────────────────────────────────────────────────

-- Full replica identity so UPDATE payloads include the old row
alter table members       replica identity full;
alter table relationships replica identity full;

alter publication supabase_realtime add table members;
alter publication supabase_realtime add table relationships;


-- ── Row Level Security ────────────────────────────────────────────────────────

alter table trees         enable row level security;
alter table members       enable row level security;
alter table relationships enable row level security;

-- trees: owner gets full access
create policy "Owner full access on trees"
  on trees for all
  to authenticated
  using     (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- trees: claimed members can read their tree (needed for invite/claim flow)
create policy "Claimed members can read tree"
  on trees for select
  to authenticated
  using (id in (select tree_id from members where user_id = auth.uid()));

-- members: read if you own the tree OR have a claimed member in it
create policy "Tree members can read members"
  on members for select
  to authenticated
  using (
    tree_id in (select id   from trees   where owner_id = auth.uid())
    or
    tree_id in (select tree_id from members where user_id = auth.uid())
  );

create policy "Tree members can insert members"
  on members for insert
  to authenticated
  with check (
    tree_id in (select id   from trees   where owner_id = auth.uid())
    or
    tree_id in (select tree_id from members where user_id = auth.uid())
  );

create policy "Tree members can update members"
  on members for update
  to authenticated
  using (
    tree_id in (select id   from trees   where owner_id = auth.uid())
    or
    tree_id in (select tree_id from members where user_id = auth.uid())
  );

create policy "Tree members can delete members"
  on members for delete
  to authenticated
  using (
    tree_id in (select id   from trees   where owner_id = auth.uid())
    or
    tree_id in (select tree_id from members where user_id = auth.uid())
  );

-- relationships: same tree-membership check
create policy "Tree members can read relationships"
  on relationships for select
  to authenticated
  using (
    tree_id in (select id   from trees   where owner_id = auth.uid())
    or
    tree_id in (select tree_id from members where user_id = auth.uid())
  );

create policy "Tree members can insert relationships"
  on relationships for insert
  to authenticated
  with check (
    tree_id in (select id   from trees   where owner_id = auth.uid())
    or
    tree_id in (select tree_id from members where user_id = auth.uid())
  );

create policy "Tree members can delete relationships"
  on relationships for delete
  to authenticated
  using (
    tree_id in (select id   from trees   where owner_id = auth.uid())
    or
    tree_id in (select tree_id from members where user_id = auth.uid())
  );


-- ── get_tree_graph RPC ────────────────────────────────────────────────────────
-- Returns a FamilyGraph JSON object shaped exactly for @rootline/engine:
--   { people: { [id]: Person }, relationships: Relationship[] }

create or replace function get_tree_graph(tree_id uuid)
returns json
language sql
security definer
stable
as $$
  select json_build_object(
    'people',
    coalesce(
      (
        select json_object_agg(
          m.id,
          json_build_object(
            'id',       m.id,
            'name',     m.name,
            'nickname', m.nickname,
            'gender',   m.gender,
            'birthday', m.birthday,
            'photo',    m.photo,
            'location', m.location,
            'story',    m.story,
            'treeId',   m.tree_id,
            'deceased', m.deceased
          )
        )
        from members m
        where m.tree_id = get_tree_graph.tree_id
      ),
      '{}'::json
    ),
    'relationships',
    coalesce(
      (
        select json_agg(
          json_build_object(
            'id',      r.id,
            'from',    r.from_id,
            'to',      r.to_id,
            'type',    r.type,
            'subtype', r.subtype,
            'treeId',  r.tree_id
          )
        )
        from relationships r
        where r.tree_id = get_tree_graph.tree_id
      ),
      '[]'::json
    )
  );
$$;


-- ── Migration: birthplace + death_date ───────────────────────────────────────
-- Run this block in Supabase SQL Editor to add the new columns.
-- Safe to run multiple times (IF NOT EXISTS guards).

alter table members
  add column if not exists birthplace text,
  add column if not exists death_date text;   -- 'YYYY-MM-DD' string

-- Rebuild the RPC so it includes the new fields in the returned JSON.
create or replace function get_tree_graph(tree_id uuid)
returns json
language sql
security definer
stable
as $$
  select json_build_object(
    'people',
    coalesce(
      (
        select json_object_agg(
          m.id,
          json_build_object(
            'id',         m.id,
            'name',       m.name,
            'nickname',   m.nickname,
            'gender',     m.gender,
            'birthday',   m.birthday,
            'birthplace', m.birthplace,
            'deathDate',  m.death_date,
            'photo',      m.photo,
            'location',   m.location,
            'story',      m.story,
            'treeId',     m.tree_id,
            'deceased',   m.deceased
          )
        )
        from members m
        where m.tree_id = get_tree_graph.tree_id
      ),
      '{}'::json
    ),
    'relationships',
    coalesce(
      (
        select json_agg(
          json_build_object(
            'id',      r.id,
            'from',    r.from_id,
            'to',      r.to_id,
            'type',    r.type,
            'subtype', r.subtype,
            'treeId',  r.tree_id
          )
        )
        from relationships r
        where r.tree_id = get_tree_graph.tree_id
      ),
      '[]'::json
    )
  );
$$;


-- ── Migration: occupation ─────────────────────────────────────────────────────
-- Run in Supabase SQL Editor (safe to re-run).

alter table members
  add column if not exists occupation text;

-- Rebuild the RPC to include occupation in the returned JSON.
create or replace function get_tree_graph(tree_id uuid)
returns json
language sql
security definer
stable
as $$
  select json_build_object(
    'people',
    coalesce(
      (
        select json_object_agg(
          m.id,
          json_build_object(
            'id',         m.id,
            'name',       m.name,
            'nickname',   m.nickname,
            'gender',     m.gender,
            'birthday',   m.birthday,
            'birthplace', m.birthplace,
            'deathDate',  m.death_date,
            'photo',      m.photo,
            'location',   m.location,
            'occupation', m.occupation,
            'story',      m.story,
            'treeId',     m.tree_id,
            'deceased',   m.deceased
          )
        )
        from members m
        where m.tree_id = get_tree_graph.tree_id
      ),
      '{}'::json
    ),
    'relationships',
    coalesce(
      (
        select json_agg(
          json_build_object(
            'id',      r.id,
            'from',    r.from_id,
            'to',      r.to_id,
            'type',    r.type,
            'subtype', r.subtype,
            'treeId',  r.tree_id
          )
        )
        from relationships r
        where r.tree_id = get_tree_graph.tree_id
      ),
      '[]'::json
    )
  );
$$;


-- ── Storage: photos bucket ────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos');

create policy "Photos are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'photos');

create policy "Authenticated users can update photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'photos');
