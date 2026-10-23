create extension if not exists pgcrypto with schema extensions;

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) between 3 and 120),
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'ended')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.prizes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 100),
  description text not null default '',
  probability numeric(5, 2) not null check (probability >= 0 and probability <= 100),
  quantity integer check (quantity is null or quantity >= 0),
  awarded_count integer not null default 0 check (awarded_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (quantity is null or awarded_count <= quantity)
);

create table public.plays (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  participant_token uuid not null,
  prize_id uuid references public.prizes (id) on delete restrict,
  prize_title_snapshot text,
  prize_description_snapshot text,
  created_at timestamptz not null default now(),
  unique (campaign_id, participant_token),
  check ((prize_id is null and prize_title_snapshot is null) or (prize_id is not null and prize_title_snapshot is not null))
);

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  play_id uuid not null unique references public.plays (id) on delete restrict,
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  email text not null check (length(email) <= 254),
  status text not null default 'pending' check (status in ('pending', 'approved', 'redeemed', 'rejected')),
  created_at timestamptz not null default now()
);

create index campaigns_public_lookup on public.campaigns (slug, status, starts_at, ends_at);
create index prizes_campaign_lookup on public.prizes (campaign_id, is_active);
create index plays_campaign_created on public.plays (campaign_id, created_at desc);
create index redemptions_created on public.redemptions (created_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

alter table public.admin_users enable row level security;
alter table public.campaigns enable row level security;
alter table public.prizes enable row level security;
alter table public.plays enable row level security;
alter table public.redemptions enable row level security;

create policy "Admins can view their own admin access"
  on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Admins can manage campaigns"
  on public.campaigns for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can manage prizes"
  on public.prizes for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can view plays"
  on public.plays for select to authenticated
  using (public.is_admin());

create policy "Admins can view and update redemptions"
  on public.redemptions for select to authenticated
  using (public.is_admin());

create policy "Admins can update redemptions"
  on public.redemptions for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.play_scratchcard(
  p_campaign_slug text,
  p_participant_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_campaign public.campaigns%rowtype;
  v_prize record;
  v_existing_play public.plays%rowtype;
  v_selected_prize_id uuid;
  v_selected_prize_title text;
  v_selected_prize_description text;
  v_play_id uuid;
  v_random_bytes bytea;
  v_random_value numeric;
  v_point numeric;
  v_running_probability numeric := 0;
  v_total_probability numeric := 0;
begin
  if p_campaign_slug is null or p_participant_token is null then
    raise exception 'Invalid play request' using errcode = '22023';
  end if;

  select * into v_campaign
  from public.campaigns
  where slug = p_campaign_slug
  for update;

  if not found then
    raise exception 'Campaign is not available' using errcode = 'P0002';
  end if;

  select * into v_existing_play
  from public.plays
  where campaign_id = v_campaign.id
    and participant_token = p_participant_token;

  if found then
    return jsonb_build_object(
      'play_id', v_existing_play.id,
      'won', v_existing_play.prize_id is not null,
      'prize', case
        when v_existing_play.prize_id is null then null
        else jsonb_build_object(
          'title', v_existing_play.prize_title_snapshot,
          'description', v_existing_play.prize_description_snapshot
        )
      end
    );
  end if;

  if v_campaign.status <> 'active'
    or now() < v_campaign.starts_at
    or now() > v_campaign.ends_at
  then
    raise exception 'Campaign is not available' using errcode = 'P0002';
  end if;

  select coalesce(sum(probability), 0)
  into v_total_probability
  from public.prizes
  where campaign_id = v_campaign.id and is_active;

  if v_total_probability > 100 then
    raise exception 'Prize probabilities exceed 100 percent' using errcode = '22023';
  end if;

  v_random_bytes := extensions.gen_random_bytes(4);
  v_random_value :=
      get_byte(v_random_bytes, 0)::numeric * 16777216
    + get_byte(v_random_bytes, 1)::numeric * 65536
    + get_byte(v_random_bytes, 2)::numeric * 256
    + get_byte(v_random_bytes, 3)::numeric;
  v_point := v_random_value / 4294967296 * 100;

  for v_prize in
    select id, title, description, probability, quantity, awarded_count
    from public.prizes
    where campaign_id = v_campaign.id and is_active
    order by created_at, id
  loop
    v_running_probability := v_running_probability + v_prize.probability;

    if v_point < v_running_probability then
      if v_prize.quantity is null or v_prize.awarded_count < v_prize.quantity then
        v_selected_prize_id := v_prize.id;
        v_selected_prize_title := v_prize.title;
        v_selected_prize_description := v_prize.description;
      end if;
      exit;
    end if;
  end loop;

  if v_selected_prize_id is not null then
    update public.prizes
    set awarded_count = awarded_count + 1
    where id = v_selected_prize_id
      and (quantity is null or awarded_count < quantity);

    if not found then
      raise exception 'Prize is no longer available' using errcode = '40001';
    end if;
  end if;

  insert into public.plays (
    campaign_id,
    participant_token,
    prize_id,
    prize_title_snapshot,
    prize_description_snapshot
  )
  values (
    v_campaign.id,
    p_participant_token,
    v_selected_prize_id,
    v_selected_prize_title,
    v_selected_prize_description
  )
  returning id into v_play_id;

  return jsonb_build_object(
    'play_id', v_play_id,
    'won', v_selected_prize_id is not null,
    'prize', case
      when v_selected_prize_id is null then null
      else jsonb_build_object(
        'title', v_selected_prize_title,
        'description', v_selected_prize_description
      )
    end
  );
end;
$$;

create or replace function public.get_public_campaign(p_campaign_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'title', campaign.title,
    'description', campaign.description,
    'slug', campaign.slug,
    'prizes', coalesce((
      select jsonb_agg(
        jsonb_build_object('title', prize.title, 'description', prize.description)
        order by prize.created_at, prize.id
      )
      from public.prizes as prize
      where prize.campaign_id = campaign.id
        and prize.is_active
        and (prize.quantity is null or prize.awarded_count < prize.quantity)
    ), '[]'::jsonb)
  )
  from public.campaigns as campaign
  where campaign.slug = p_campaign_slug
    and campaign.status = 'active'
    and now() between campaign.starts_at and campaign.ends_at;
$$;

create or replace function public.submit_redemption(
  p_play_id uuid,
  p_full_name text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_redemption_id uuid;
begin
  if p_play_id is null
    or p_full_name is null
    or length(trim(p_full_name)) not between 2 and 120
    or p_email is null
    or length(trim(p_email)) > 254
    or trim(p_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  then
    raise exception 'Invalid redemption details' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.plays
    where id = p_play_id and prize_id is not null
  ) then
    raise exception 'Winning play not found' using errcode = 'P0002';
  end if;

  insert into public.redemptions (play_id, full_name, email)
  values (p_play_id, trim(p_full_name), lower(trim(p_email)))
  returning id into v_redemption_id;

  return jsonb_build_object('redemption_id', v_redemption_id, 'status', 'pending');
end;
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.play_scratchcard(text, uuid) from public;
revoke all on function public.get_public_campaign(text) from public;
revoke all on function public.submit_redemption(uuid, text, text) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.play_scratchcard(text, uuid) to anon, authenticated;
grant execute on function public.get_public_campaign(text) to anon, authenticated;
grant execute on function public.submit_redemption(uuid, text, text) to anon, authenticated;

revoke all on public.campaigns, public.prizes from anon;
grant select on public.campaigns, public.prizes to authenticated;
grant select, insert, update, delete on public.campaigns, public.prizes to authenticated;
grant select on public.admin_users, public.plays, public.redemptions to authenticated;
grant update (status) on public.redemptions to authenticated;
