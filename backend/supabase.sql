-- LOCAL DEVELOPMENT MIGRATION. Review/test before any separately authorized cloud rollout.
-- Additive and rerunnable: existing records/history are never deleted or rewritten.
begin;
create schema if not exists roadledger_private;
revoke all on schema roadledger_private from public, anon, authenticated;
create table if not exists public.roadledger_sync_heads (
 owner_id uuid primary key references auth.users(id) on delete cascade, cursor bigint not null default 0
);
create table if not exists public.roadledger_sync_records (
 owner_id uuid not null references auth.users(id) on delete cascade, record_key text not null,
 version bigint not null check(version>0), value jsonb not null, primary key(owner_id,record_key)
);
create table if not exists public.roadledger_sync_changes (
 owner_id uuid not null references auth.users(id) on delete cascade, cursor bigint not null,
 record_key text not null, version bigint not null, value jsonb not null, primary key(owner_id,cursor)
);
create table if not exists public.roadledger_sync_operations (
 owner_id uuid not null references auth.users(id) on delete cascade, operation_id text not null,
 request jsonb not null, response jsonb not null, primary key(owner_id,operation_id)
);
alter table public.roadledger_sync_heads add column if not exists quota_bytes bigint;
alter table public.roadledger_sync_heads add column if not exists rate_started timestamptz;
alter table public.roadledger_sync_heads add column if not exists rate_count integer not null default 0;
alter table public.roadledger_sync_heads enable row level security;
alter table public.roadledger_sync_records enable row level security;
alter table public.roadledger_sync_changes enable row level security;
alter table public.roadledger_sync_operations enable row level security;
drop policy if exists owner_heads on public.roadledger_sync_heads;
drop policy if exists owner_records on public.roadledger_sync_records;
drop policy if exists owner_changes on public.roadledger_sync_changes;
drop policy if exists owner_operations on public.roadledger_sync_operations;
create policy owner_heads on public.roadledger_sync_heads for select to authenticated using(owner_id=(select auth.uid()));
create policy owner_records on public.roadledger_sync_records for select to authenticated using(owner_id=(select auth.uid()));
create policy owner_changes on public.roadledger_sync_changes for select to authenticated using(owner_id=(select auth.uid()));
create policy owner_operations on public.roadledger_sync_operations for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.roadledger_sync_heads,public.roadledger_sync_records,public.roadledger_sync_changes,public.roadledger_sync_operations from public,anon,authenticated;
grant select on public.roadledger_sync_heads,public.roadledger_sync_records,public.roadledger_sync_changes,public.roadledger_sync_operations to authenticated;

create or replace function roadledger_private.valid_number(v jsonb, minimum numeric default 0, maximum numeric default 9007199254740991, whole boolean default false, required boolean default false)
returns boolean language plpgsql immutable set search_path='' as $$
declare n numeric;
begin
 if v is null or v='null'::jsonb or v='""'::jsonb then return not required; end if;
 if pg_catalog.jsonb_typeof(v) not in ('number','string') then return false; end if;
 if not (v#>>'{}') ~ '^[[:space:]]*[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?[[:space:]]*$' then return false; end if;
 n:=(v#>>'{}')::numeric;
 return n>=minimum and n<=maximum and (not whole or n=pg_catalog.trunc(n));
exception when others then return false;
end $$;
create or replace function roadledger_private.valid_date(v jsonb, required boolean default false)
returns boolean language plpgsql immutable set search_path='' as $$
declare s text;
begin
 if v is null or v='null'::jsonb or v='""'::jsonb then return not required; end if;
 if pg_catalog.jsonb_typeof(v)<>'string' then return false; end if;
 s:=v#>>'{}';return s~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and pg_catalog.to_char(pg_catalog.to_date(s,'YYYY-MM-DD'),'YYYY-MM-DD')=s;
exception when others then return false;
end $$;
create or replace function roadledger_private.safe_json(v jsonb, depth integer default 0)
returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb;
begin
 if depth>20 then return false; end if;
 if pg_catalog.jsonb_typeof(v)='number' then return pg_catalog.abs((v#>>'{}')::numeric)<=9007199254740991; end if;
 if pg_catalog.jsonb_typeof(v)='array' then
  for item in select value from pg_catalog.jsonb_array_elements(v) loop if not roadledger_private.safe_json(item,depth+1) then return false; end if; end loop;
 elsif pg_catalog.jsonb_typeof(v)='object' then
  for item in select value from pg_catalog.jsonb_each(v) loop if not roadledger_private.safe_json(item,depth+1) then return false; end if; end loop;
 end if;
 return true;
end $$;
create or replace function roadledger_private.valid_record(k text,v jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare parts jsonb; collection text; record_id text; field text; item jsonb;
begin
 if k is null or pg_catalog.octet_length(k)>4096 or v is null then return false; end if;
 parts:=k::jsonb;
 if pg_catalog.jsonb_typeof(parts)<>'array' or pg_catalog.jsonb_array_length(parts)<>2 then return false; end if;
 if pg_catalog.jsonb_typeof(parts->0)<>'string' or pg_catalog.jsonb_typeof(parts->1)<>'string' then return false; end if;
 collection:=parts->>0;record_id:=parts->>1;
 if record_id='' or collection not in ('loads','equipment','settings','mileage','expenses','maintenance','fleet','documents','ifta','extraMetadata','tires','routeSpecs','routeStops') then return false; end if;
 if k<>'['||pg_catalog.to_json(collection)::text||','||pg_catalog.to_json(record_id)::text||']' then return false; end if;
 if collection in ('equipment','settings','extraMetadata','routeStops') and record_id<>'default' then return false; end if;
 if pg_catalog.octet_length(v::text)>65536 or not roadledger_private.safe_json(v) then return false; end if;
 if v='null'::jsonb then return true; end if; -- retained deletion, never a physical delete
 if collection='routeStops' then
  if pg_catalog.jsonb_typeof(v)<>'array' or pg_catalog.jsonb_array_length(v)>20 then return false; end if;
  for item in select value from pg_catalog.jsonb_array_elements(v) loop if pg_catalog.jsonb_typeof(item)<>'string' or pg_catalog.btrim(item#>>'{}')='' then return false; end if; end loop;
  return true;
 end if;
 if pg_catalog.jsonb_typeof(v)<>'object' then return false; end if;
 if collection in ('loads','mileage','expenses','maintenance','fleet','documents','ifta') then
  if pg_catalog.jsonb_typeof(v->'id') not in ('string','number') or (v->>'id') is distinct from record_id then return false; end if;
 end if;
 if collection in ('loads','mileage','expenses','maintenance','fleet','documents','ifta','settings') then
  for item in select value from pg_catalog.jsonb_each(v) loop if pg_catalog.jsonb_typeof(item) in ('object','array') then return false; end if; end loop;
 end if;
 foreach field in array array['date','due','expiry'] loop if not roadledger_private.valid_date(v->field,collection='mileage' and field='date') then return false; end if; end loop;
 foreach field in array array['pay','miles','tonu','detention','layover','expenses','amount','gallons','cost','odo','dueOdo','start','end','total','loaded'] loop if not roadledger_private.valid_number(v->field) then return false; end if; end loop;
 foreach field in array array['rate','tonuRate','detentionRate','layoverRate','taxRate'] loop if not roadledger_private.valid_number(v->field,0,100) then return false; end if; end loop;
 foreach field in array array['fuelLow','fuelHigh','fuelEmpty'] loop if not roadledger_private.valid_number(v->field,0.000001,100) then return false; end if; end loop;
 if v->>'fuelLow' is not null and v->>'fuelLow'<>'' and v->>'fuelHigh' is not null and v->>'fuelHigh'<>'' and (v->>'fuelLow')::numeric>(v->>'fuelHigh')::numeric then return false; end if;
 if collection='expenses' then
  if not roadledger_private.valid_number(v->'amount',0.000001,9007199254740991,false,true) then return false; end if;
  if v?'payer' and (v->>'payer' is null or v->>'payer' not in ('business','driver','reimbursed')) then return false; end if;
  if v?'loadExpenseId' and v->'loadExpenseId'<>'null'::jsonb and pg_catalog.jsonb_typeof(v->'loadExpenseId')<>'string' then return false; end if;
 elsif collection='mileage' then
  if not roadledger_private.valid_number(v->'start',0,9007199254740991,false,true) or not roadledger_private.valid_number(v->'end',0,9007199254740991,false,true) then return false; end if;
  if (v->>'end')::numeric<(v->>'start')::numeric then return false; end if;
  if v->>'loaded' is not null and v->>'loaded'<>'' and (v->>'loaded')::numeric>pg_catalog.round(((v->>'end')::numeric-(v->>'start')::numeric)*10)/10 then return false; end if;
 elsif collection='fleet' then
  if pg_catalog.jsonb_typeof(v->'name') is distinct from 'string' or pg_catalog.btrim(v->>'name')='' or pg_catalog.lower(v->>'type') not in ('truck','trailer') or v->>'type' is null then return false; end if;
 elsif collection='ifta' then
  if v->>'state' is null or not (v->>'state')~'^[A-Z]{2}$' or not roadledger_private.valid_number(v->'miles',0,9007199254740991,false,true) then return false; end if;
 elsif collection='tires' then
  if pg_catalog.jsonb_typeof(v->'size') is distinct from 'string' or pg_catalog.btrim(v->>'size')='' or not roadledger_private.valid_number(v->'count',1,100,true,true) then return false; end if;
 elsif collection='routeSpecs' then
  foreach field in array array['routeHeight','routeWidth','routeWeight'] loop if not roadledger_private.valid_number(v->field,0.000001) then return false; end if; end loop;
  if not roadledger_private.valid_number(v->'routeAxles',1,30,true) then return false; end if;
 end if;
 return true;
exception when others then return false;
end $$;
revoke all on all functions in schema roadledger_private from public,anon,authenticated;

create or replace function public.roadledger_push(p_key text,p_value jsonb,p_base_version bigint,p_operation_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); current_record public.roadledger_sync_records%rowtype;
 prior public.roadledger_sync_operations%rowtype; head public.roadledger_sync_heads%rowtype;
 requested jsonb; result jsonb; next_cursor bigint; new_version bigint; data jsonb; growth bigint;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(select 1 from auth.users where id=actor and (email_confirmed_at is not null or phone_confirmed_at is not null)) then raise sqlstate '28000' using message='Verified permanent authenticated account required'; end if;
 if p_value is null or pg_catalog.jsonb_typeof(p_value)<>'object' or not(p_value?'data') or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_value))<>1 then raise sqlstate 'PT422' using message='Invalid record envelope'; end if;
 data:=p_value->'data';
 if p_base_version is null or p_base_version<0 or p_base_version>=9007199254740991 or p_operation_id is null or pg_catalog.length(p_operation_id) not between 1 and 100 then raise sqlstate 'PT422' using message='Invalid operation'; end if;
 requested:=pg_catalog.jsonb_build_object('key',p_key,'value',data,'base',p_base_version);
 insert into public.roadledger_sync_heads(owner_id) values(actor) on conflict do nothing;
 select * into head from public.roadledger_sync_heads where owner_id=actor for update;
 select * into prior from public.roadledger_sync_operations where owner_id=actor and operation_id=p_operation_id;
 if found then
  if prior.request<>requested then raise sqlstate 'PT409' using message='Operation ID reused'; end if;
  return prior.response; -- old accepted operations remain replayable even after limits change
 end if;
 if not roadledger_private.valid_record(p_key,data) then raise sqlstate 'PT422' using message='Invalid record schema, identity, or payload size; original data retained'; end if;
 if head.rate_started is null or head.rate_started<pg_catalog.clock_timestamp()-interval '1 minute' then head.rate_started:=pg_catalog.clock_timestamp();head.rate_count:=0; end if;
 if head.rate_count>=120 then raise sqlstate 'PT429' using message='Per-account write rate reached; retry later'; end if;
 update public.roadledger_sync_heads set rate_started=head.rate_started,rate_count=head.rate_count+1 where owner_id=actor;
 select * into current_record from public.roadledger_sync_records where owner_id=actor and record_key=p_key;
 if coalesce(current_record.version,0)<>p_base_version then return pg_catalog.jsonb_build_object('conflict',true,'record',pg_catalog.jsonb_build_object('version',coalesce(current_record.version,0),'value',coalesce(current_record.value,'null'::jsonb))); end if;
 if head.cursor>=9007199254740991 then raise sqlstate 'PT409' using message='Cursor capacity reached; recovery required'; end if;
 new_version:=coalesce(current_record.version,0)+1;next_cursor:=head.cursor+1;
 result:=pg_catalog.jsonb_build_object('conflict',false,'record',pg_catalog.jsonb_build_object('version',new_version,'value',data));
 if head.quota_bytes is null then
  select coalesce((select pg_catalog.sum(pg_catalog.octet_length(record_key)+pg_catalog.octet_length(value::text)) from public.roadledger_sync_records where owner_id=actor),0)
   +coalesce((select pg_catalog.sum(pg_catalog.octet_length(record_key)+pg_catalog.octet_length(value::text)) from public.roadledger_sync_changes where owner_id=actor),0)
   +coalesce((select pg_catalog.sum(pg_catalog.octet_length(request::text)+pg_catalog.octet_length(response::text)) from public.roadledger_sync_operations where owner_id=actor),0) into head.quota_bytes;
 end if;
 growth:=pg_catalog.octet_length(p_key)+pg_catalog.octet_length(data::text)-case when current_record.version is null then 0 else pg_catalog.octet_length(current_record.record_key)+pg_catalog.octet_length(current_record.value::text) end
  +pg_catalog.octet_length(p_key)+pg_catalog.octet_length(data::text)+pg_catalog.octet_length(requested::text)+pg_catalog.octet_length(result::text);
 if head.quota_bytes+growth>104857600 then raise sqlstate 'PT429' using message='Account logical-storage quota reached; export/review retained history'; end if;
 insert into public.roadledger_sync_records(owner_id,record_key,version,value) values(actor,p_key,new_version,data) on conflict(owner_id,record_key) do update set version=excluded.version,value=excluded.value;
 update public.roadledger_sync_heads set cursor=next_cursor,quota_bytes=head.quota_bytes+growth where owner_id=actor;
 insert into public.roadledger_sync_changes values(actor,next_cursor,p_key,new_version,data);
 insert into public.roadledger_sync_operations values(actor,p_operation_id,requested,result);
 return result;
end $$;

create or replace function public.roadledger_pull(p_since bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); high_water bigint; last_cursor bigint; batch jsonb:='[]'::jsonb;
 item record; event jsonb; used integer:=128; count integer:=0; event_bytes integer;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(select 1 from auth.users where id=actor and (email_confirmed_at is not null or phone_confirmed_at is not null)) then raise sqlstate '28000' using message='Verified permanent authenticated account required'; end if;
 select coalesce(cursor,0) into high_water from public.roadledger_sync_heads where owner_id=actor;high_water:=coalesce(high_water,0);
 if p_since is null or p_since<0 or p_since>high_water then raise sqlstate 'PT409' using message='Invalid cursor or cloud reset; recovery required'; end if;
 last_cursor:=p_since;
 for item in select * from public.roadledger_sync_changes where owner_id=actor and cursor>p_since and cursor<=high_water order by cursor limit 101 loop
  if item.cursor<>last_cursor+1 then raise sqlstate 'PT409' using message='Change history has a gap; recovery required'; end if;
  event:=pg_catalog.jsonb_build_object('key',item.record_key,'version',item.version,'value',item.value,'cursor',item.cursor);event_bytes:=pg_catalog.octet_length(event::text)+2;
  if count>=100 or used+event_bytes>524288 then
   if count=0 then raise sqlstate 'PT413' using message='Existing event exceeds safe response size; recovery required'; end if;exit;
  end if;
  batch:=batch||pg_catalog.jsonb_build_array(event);used:=used+event_bytes;count:=count+1;last_cursor:=item.cursor;
 end loop;
 return pg_catalog.jsonb_build_object('changes',batch,'cursor',last_cursor,'hasMore',last_cursor<high_water);
end $$;
revoke execute on function public.roadledger_push(text,jsonb,bigint,text) from public,anon;
revoke execute on function public.roadledger_pull(bigint) from public,anon;
grant execute on function public.roadledger_push(text,jsonb,bigint,text) to authenticated;
grant execute on function public.roadledger_pull(bigint) to authenticated;
commit;
