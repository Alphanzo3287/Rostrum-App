-- =====================================================================
-- The Rostrum · 0006_broadcast_secrets.sql
-- Per-debate broadcast secrets. The YouTube stream key must NOT live on the
-- world-readable debates row, so it goes here behind host-only RLS. The
-- livekit-control function reads it with the service role at go-live, so the
-- key never travels to any other client.
-- =====================================================================

create table debate_secrets (
  debate_id          uuid primary key references debates(id) on delete cascade,
  youtube_stream_key text,
  updated_at         timestamptz not null default now()
);

alter table debate_secrets enable row level security;

create policy secrets_host on debate_secrets for all
  using      (exists (select 1 from debates d where d.id = debate_id and d.host_id = auth.uid()))
  with check (exists (select 1 from debates d where d.id = debate_id and d.host_id = auth.uid()));

create or replace function set_broadcast_key(p_debate uuid, p_key text)
returns void language plpgsql security definer set search_path = public as $$
declare v_host uuid;
begin
  select host_id into v_host from debates where id = p_debate;
  if v_host is null then raise exception 'debate not found'; end if;
  if auth.uid() <> v_host then raise exception 'host only'; end if;
  insert into debate_secrets (debate_id, youtube_stream_key) values (p_debate, p_key)
  on conflict (debate_id) do update set youtube_stream_key = excluded.youtube_stream_key, updated_at = now();
end; $$;

grant execute on function set_broadcast_key(uuid, text) to authenticated;
