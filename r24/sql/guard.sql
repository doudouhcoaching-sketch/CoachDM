-- Securite 2.4 : un membre ne peut plus s'attribuer lui-meme des droits en ecrivant
-- directement dans sa fiche (fondateur, formule coach, limite d'eleves, email verifie,
-- client Stripe, coach) ni dans sa relation coach. Les fonctions serveur (SECURITY DEFINER),
-- les webhooks (service_role) et l'admin continuent de pouvoir le faire.
create or replace function public.trg_profiles_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if new.role is distinct from old.role
       or new.is_founder is distinct from old.is_founder
       or new.founder_kind is distinct from old.founder_kind
       or new.founder_since is distinct from old.founder_since
       or new.coach_plan is distinct from old.coach_plan
       or new.coach_max_clients is distinct from old.coach_max_clients
       or new.email_verified is distinct from old.email_verified
       or new.stripe_customer_id is distinct from old.stripe_customer_id
       or new.coach_id is distinct from old.coach_id then
      raise exception 'forbidden_field' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.trg_profiles_guard();

create or replace function public.trg_coach_clients_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if new.coach_id is distinct from old.coach_id or new.client_id is distinct from old.client_id then
      raise exception 'forbidden_field' using errcode='42501';
    end if;
    -- le client peut quitter son coach, jamais (re)activer lui-meme la relation
    if auth.uid() = old.client_id and auth.uid() is distinct from old.coach_id
       and new.status is distinct from old.status and new.status::text in ('active','paused','pending','admin_dm') then
      raise exception 'forbidden_status' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists coach_clients_guard on public.coach_clients;
create trigger coach_clients_guard before update on public.coach_clients for each row execute function public.trg_coach_clients_guard();
