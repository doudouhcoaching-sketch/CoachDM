-- Coach : 3 clients gratuits + consentement obligatoire du client (25 oct.)
grant execute on function public.fn_coach_limit(uuid) to authenticated;
-- 1) palier gratuit : 3 clients
create or replace function public.fn_coach_limit(p_coach uuid) returns integer
language sql stable security definer set search_path to 'public' as $function$
select coalesce( (select case when p.role = 'admin' then 2147483647
  else greatest( (case p.coach_plan when 'coach_plus' then 50 when 'coach' then 20 else 3 end)
     + (case when p.is_founder and p.founder_kind = 'coach' then 10 else 0 end), coalesce(p.coach_max_clients, 0) ) end
  from profiles p where p.id = p_coach), 3); $function$;

create or replace function public.become_coach() returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare v_role text;
begin
  select role::text into v_role from profiles where id = auth.uid();
  if v_role is null then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  if v_role in ('coach','admin') then return jsonb_build_object('ok', true, 'already', true, 'role', v_role); end if;
  update profiles set role = 'coach' where id = auth.uid();
  return jsonb_build_object('ok', true, 'role', 'coach', 'free_slots', 3);
end $function$;

-- 2) seul le CLIENT accepte une invitation (le coach peut seulement l'annuler)
create or replace function public.respond_invite(_relationship uuid, _accept boolean) returns coach_clients
language plpgsql security definer set search_path to 'public' as $function$
declare _row public.coach_clients;
begin
  select * into _row from public.coach_clients where id = _relationship;
  if _row.id is null then raise exception 'relationship_not_found'; end if;
  if auth.uid() not in (_row.coach_id, _row.client_id) then raise exception 'forbidden'; end if;
  if _accept and auth.uid() <> _row.client_id then raise exception 'only_client_can_accept'; end if;
  if _accept and _row.status <> 'active' and (select count(*) from coach_clients where coach_id=_row.coach_id and status='active') >= fn_coach_limit(_row.coach_id) then raise exception 'coach_full'; end if;
  update public.coach_clients set status = case when _accept then 'active' else 'ended' end,
    started_at = case when _accept then coalesce(started_at, now()) else started_at end,
    ended_at = case when _accept then null else now() end
  where id = _relationship returning * into _row;
  return _row;
end $function$;

-- 3) le coach ne peut pas activer une relation que le client n'a jamais acceptee
create or replace function public.coach_set_member_status(p_client uuid, p_status text) returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
begin
  if not is_coach() then raise exception 'forbidden'; end if;
  if p_status not in ('active','paused','ended') then return jsonb_build_object('ok',false,'reason','bad_status'); end if;
  if not is_admin() and not exists(select 1 from coach_clients where coach_id=auth.uid() and client_id=p_client) then return jsonb_build_object('ok',false,'reason','not_your_member'); end if;
  if p_status in ('active','paused') and not is_admin() and not exists(select 1 from coach_clients where coach_id=auth.uid() and client_id=p_client and started_at is not null and status in ('active','paused')) then
    return jsonb_build_object('ok',false,'reason','client_must_accept'); end if;
  if p_status='active' and not is_admin() and not exists(select 1 from coach_clients where coach_id=auth.uid() and client_id=p_client and status='active') then
    if (select count(*) from coach_clients where coach_id=auth.uid() and status='active') >= fn_coach_limit(auth.uid()) then return jsonb_build_object('ok',false,'reason','limit_reached'); end if;
  end if;
  update coach_clients set status=p_status::coach_client_status, ended_at=case when p_status='ended' then now() else null end, updated_at=now()
  where coach_id=auth.uid() and client_id=p_client;
  return jsonb_build_object('ok',true,'status',p_status);
end $function$;

-- 4) invitation d'un nouveau compte : le coach ne touche jamais a un compte existant
create or replace function public.coach_link_invited(p_client_id uuid, p_full_name text default null, p_phone text default null, p_goal text default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare v_new boolean; v_role text;
begin
  if not is_coach() then return jsonb_build_object('ok',false,'reason','forbidden'); end if;
  if p_client_id = auth.uid() then return jsonb_build_object('ok',false,'reason','self'); end if;
  if not is_admin() then
    if (select count(*) from coach_clients where coach_id=auth.uid() and status in ('active','pending')) >= fn_coach_limit(auth.uid()) then
      return jsonb_build_object('ok',false,'reason','limit_reached'); end if;
  end if;
  select role::text, (created_at > now() - interval '15 minutes') into v_role, v_new from profiles where id=p_client_id;
  -- compte cree a l'instant par l'invitation : on pre-remplit la fiche ; compte existant : on ne modifie rien
  if v_new and coalesce(v_role,'client') not in ('admin','coach') then
    update profiles set role='client', full_name=coalesce(nullif(trim(p_full_name),''), full_name),
      phone=coalesce(nullif(trim(p_phone),''), phone), primary_goal=coalesce(nullif(trim(p_goal),''), primary_goal)
    where id=p_client_id;
  end if;
  if exists(select 1 from coach_clients where coach_id=auth.uid() and client_id=p_client_id) then
    update coach_clients set status='pending', invited_at=now(), ended_at=null, updated_at=now()
    where coach_id=auth.uid() and client_id=p_client_id and status='ended';
  else
    insert into coach_clients(id,coach_id,client_id,status,invited_at,created_at,updated_at)
    values(gen_random_uuid(),auth.uid(),p_client_id,'pending',now(),now(),now());
  end if;
  return jsonb_build_object('ok',true,'client_id',p_client_id,'existing',not coalesce(v_new,false));
end $function$;

-- 5) ajout direct dans coach_clients (depuis l'app) : toujours "en attente", jamais actif sans le client
create or replace function public.trg_coach_clients_insert_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    new.status := 'pending'; new.started_at := null; new.ended_at := null;
    if (select count(*) from coach_clients where coach_id=new.coach_id and status in ('active','pending')) >= fn_coach_limit(new.coach_id) then
      raise exception 'limit_reached' using errcode='42501'; end if;
  end if;
  return new;
end $$;
drop trigger if exists coach_clients_insert_guard on public.coach_clients;
create trigger coach_clients_insert_guard before insert on public.coach_clients for each row execute function public.trg_coach_clients_insert_guard();

-- 6) mise a jour directe : un coach ne passe pas lui-meme une relation en "active"
create or replace function public.trg_coach_clients_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if new.coach_id is distinct from old.coach_id or new.client_id is distinct from old.client_id then
      raise exception 'forbidden_field' using errcode='42501'; end if;
    if new.status is distinct from old.status and new.status::text in ('active','paused','pending','admin_dm') then
      raise exception 'forbidden_status' using errcode='42501'; end if;
    if new.started_at is distinct from old.started_at then raise exception 'forbidden_field' using errcode='42501'; end if;
  end if;
  return new;
end $$;
