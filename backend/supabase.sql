-- PREPARATION ONLY. Apply to a new Supabase project after user-approved setup.
-- Never run as a migration against existing RoadLedger records without review.
-- Client writes are RPC-only; owner always comes from the verified JWT's auth.uid().
create table public.roadledger_sync_heads (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  cursor bigint not null default 0
);
create table public.roadledger_sync_records (
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_key text not null,
  version bigint not null check (version > 0),
  value jsonb not null, -- JSON null is a retained deletion tombstone
  primary key(owner_id, record_key)
);
create table public.roadledger_sync_changes (
  owner_id uuid not null references auth.users(id) on delete cascade,
  cursor bigint not null,
  record_key text not null,
  version bigint not null,
  value jsonb not null,
  primary key(owner_id, cursor)
);
create table public.roadledger_sync_operations (
  owner_id uuid not null references auth.users(id) on delete cascade,
  operation_id text not null,
  request jsonb not null,
  response jsonb not null,
  primary key(owner_id, operation_id)
);
alter table public.roadledger_sync_heads enable row level security;
alter table public.roadledger_sync_records enable row level security;
alter table public.roadledger_sync_changes enable row level security;
alter table public.roadledger_sync_operations enable row level security;
create policy owner_heads on public.roadledger_sync_heads for select to authenticated using(owner_id=(select auth.uid()));
create policy owner_records on public.roadledger_sync_records for select to authenticated using(owner_id=(select auth.uid()));
create policy owner_changes on public.roadledger_sync_changes for select to authenticated using(owner_id=(select auth.uid()));
create policy owner_operations on public.roadledger_sync_operations for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.roadledger_sync_heads, public.roadledger_sync_records, public.roadledger_sync_changes, public.roadledger_sync_operations from anon, authenticated;
grant select on public.roadledger_sync_heads, public.roadledger_sync_records, public.roadledger_sync_changes, public.roadledger_sync_operations to authenticated;

create function public.roadledger_push(p_key text, p_value jsonb, p_base_version bigint, p_operation_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  actor uuid := auth.uid(); current_record public.roadledger_sync_records%rowtype;
  requested jsonb; prior public.roadledger_sync_operations%rowtype;
  result jsonb; next_cursor bigint; new_version bigint; key_parts jsonb;
begin
  if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  key_parts := p_key::jsonb;
  if p_key is null or length(p_key)>4096 or jsonb_typeof(key_parts) is distinct from 'array' or jsonb_array_length(key_parts) <> 2
    or jsonb_typeof(key_parts->0) is distinct from 'string' or jsonb_typeof(key_parts->1) is distinct from 'string' or length(key_parts->>1)=0
    or (key_parts->>0) not in ('loads','equipment','settings','mileage','expenses','maintenance','fleet','documents','ifta','extraMetadata','tires','routeSpecs','routeStops')
    or p_base_version < 0 or p_base_version is null or p_value is null or (p_value ? 'data') is not true
    or p_operation_id is null or length(p_operation_id) not between 1 and 100
    or octet_length(p_value::text)>262144 then raise exception 'invalid operation'; end if;
  if p_key <> '['||to_json(key_parts->>0)::text||','||to_json(key_parts->>1)::text||']' then raise exception 'noncanonical record key'; end if;
  -- p_value is an envelope {data: value}; this preserves JSON-null deletion tombstones through PostgREST.
  -- One owner-level lock orders revision checks, commits, and change-feed cursors.
  insert into public.roadledger_sync_heads(owner_id) values(actor) on conflict do nothing;
  select cursor into next_cursor from public.roadledger_sync_heads where owner_id=actor for update;
  requested:=jsonb_build_object('key',p_key,'value',p_value->'data','base',p_base_version);
  select * into prior from public.roadledger_sync_operations where owner_id=actor and operation_id=p_operation_id;
  if found then
    if prior.request <> requested then raise exception 'operation ID reused'; end if;
    return prior.response;
  end if;
  select * into current_record from public.roadledger_sync_records where owner_id=actor and record_key=p_key;
  if coalesce(current_record.version,0) <> p_base_version then
    return jsonb_build_object('conflict',true,'record',jsonb_build_object('version',coalesce(current_record.version,0),'value',coalesce(current_record.value,'null'::jsonb)));
  end if;
  new_version:=coalesce(current_record.version,0)+1;
  insert into public.roadledger_sync_records(owner_id,record_key,version,value) values(actor,p_key,new_version,p_value->'data')
    on conflict(owner_id,record_key) do update set version=excluded.version,value=excluded.value;
  next_cursor:=next_cursor+1;
  update public.roadledger_sync_heads set cursor=next_cursor where owner_id=actor;
  insert into public.roadledger_sync_changes values(actor,next_cursor,p_key,new_version,p_value->'data');
  result:=jsonb_build_object('conflict',false,'record',jsonb_build_object('version',new_version,'value',p_value->'data'));
  insert into public.roadledger_sync_operations values(actor,p_operation_id,requested,result);
  return result;
end $$;

create function public.roadledger_pull(p_since bigint)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare actor uuid:=auth.uid(); high_water bigint; last_cursor bigint; batch jsonb;
begin
  if actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  select coalesce(cursor,0) into high_water from public.roadledger_sync_heads where owner_id=actor;
  high_water:=coalesce(high_water,0);
  if p_since is null or p_since<0 or p_since>high_water then raise exception 'invalid cursor or cloud reset'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('key',record_key,'version',version,'value',value,'cursor',cursor) order by cursor),'[]'::jsonb),max(cursor)
    into batch,last_cursor from (select * from public.roadledger_sync_changes where owner_id=actor and cursor>p_since and cursor<=high_water order by cursor limit 500) changes;
  return jsonb_build_object('changes',batch,'cursor',coalesce(last_cursor,p_since),'hasMore',coalesce(last_cursor,p_since)<high_water);
end $$;
revoke execute on function public.roadledger_push(text,jsonb,bigint,text) from public, anon;
revoke execute on function public.roadledger_pull(bigint) from public, anon;
grant execute on function public.roadledger_push(text,jsonb,bigint,text) to authenticated;
grant execute on function public.roadledger_pull(bigint) to authenticated;
