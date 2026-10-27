-- Badges Coach DM (visuels de Coach DM) : seances, jours de suite, visites + record et repas
create table if not exists public.app_visits(
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  primary key(user_id, day));
alter table public.app_visits enable row level security;
drop policy if exists app_visits_self_read on public.app_visits;
create policy app_visits_self_read on public.app_visits for select to authenticated using (user_id = auth.uid());

alter table public.badge_catalog add column if not exists image text;
delete from public.badge_catalog;
insert into public.badge_catalog(code,name_fr,name_en,name_nl,desc_fr,desc_en,desc_nl,icon,tier,goal,metric,premium,sort,image) values
('sessions_1','First Rep','First Rep','First Rep','Ta première séance est faite. Tout commence ici.','Your first session is done. Everything starts here.','Je eerste training zit erop. Hier begint alles.','bolt',1,1,'sessions',false,10,'sessions_1'),
('sessions_10','Ignition','Ignition','Ignition','10 séances terminées. Le moteur est lancé.','10 sessions done. The engine is running.','10 trainingen gedaan. De motor draait.','bolt',1,10,'sessions',false,11,'sessions_10'),
('sessions_25','Discipline','Discipline','Discipline','25 séances. Ce n''est plus de la motivation, c''est de la discipline.','25 sessions. It''s not motivation anymore, it''s discipline.','25 trainingen. Dit is geen motivatie meer, dit is discipline.','medal',2,25,'sessions',false,12,'sessions_25'),
('sessions_50','Iron Habit','Iron Habit','Iron Habit','50 séances. L''entraînement fait partie de ta vie.','50 sessions. Training is part of your life.','50 trainingen. Trainen hoort bij je leven.','medal',2,50,'sessions',false,13,'sessions_50'),
('sessions_100','Centurion','Centurion','Centurion','100 séances. Tu fais partie des rares.','100 sessions. You are one of the few.','100 trainingen. Je hoort bij de weinigen.','crown',3,100,'sessions',false,14,'sessions_100'),
('sessions_365','The 365 Club','The 365 Club','The 365 Club','365 séances. Une année entière de travail.','365 sessions. A whole year of work.','365 trainingen. Een heel jaar werk.','crown',3,365,'sessions',false,15,'sessions_365'),
('sessions_500','Elite Athlete','Elite Athlete','Elite Athlete','500 séances. Niveau élite.','500 sessions. Elite level.','500 trainingen. Eliteniveau.','crown',3,500,'sessions',false,16,'sessions_500'),
('streak_1','Daily Start','Daily Start','Daily Start','Premier jour actif. Reviens demain.','First active day. Come back tomorrow.','Eerste actieve dag. Kom morgen terug.','flame',1,1,'streak',false,20,'streak_1'),
('streak_3','3 jours de suite','3 days in a row','3 dagen op rij','3 jours actifs d''affilée.','3 active days in a row.','3 actieve dagen op rij.','flame',1,3,'streak',false,21,'streak_3'),
('streak_7','7 jours de suite','7 days in a row','7 dagen op rij','Une semaine complète sans lâcher.','A full week without letting go.','Een volle week zonder los te laten.','flame',1,7,'streak',false,22,'streak_7'),
('streak_15','15 jours de suite','15 days in a row','15 dagen op rij','15 jours actifs d''affilée.','15 active days in a row.','15 actieve dagen op rij.','flame',2,15,'streak',false,23,'streak_15'),
('streak_30','30 jours de suite','30 days in a row','30 dagen op rij','Un mois entier. L''habitude est là.','A whole month. The habit is there.','Een hele maand. De gewoonte zit erin.','flame',2,30,'streak',false,24,'streak_30'),
('streak_50','50 jours de suite','50 days in a row','50 dagen op rij','50 jours actifs d''affilée.','50 active days in a row.','50 actieve dagen op rij.','flame',2,50,'streak',false,25,'streak_50'),
('streak_75','75 jours de suite','75 days in a row','75 dagen op rij','75 jours actifs d''affilée.','75 active days in a row.','75 actieve dagen op rij.','flame',3,75,'streak',false,26,'streak_75'),
('streak_100','100 jours de suite','100 days in a row','100 dagen op rij','100 jours sans casser la série.','100 days without breaking the streak.','100 dagen zonder de reeks te breken.','flame',3,100,'streak',false,27,'streak_100'),
('streak_150','150 jours de suite','150 days in a row','150 dagen op rij','150 jours d''affilée. Légendaire.','150 days in a row. Legendary.','150 dagen op rij. Legendarisch.','flame',3,150,'streak',false,28,'streak_150'),
('visits_10','Novice','Novice','Novice','10 jours passés avec Coach DM.','10 days with Coach DM.','10 dagen met Coach DM.','bolt',1,10,'visits',false,30,'visits_10'),
('visits_50','Habitué','Regular','Vaste klant','50 jours passés avec Coach DM.','50 days with Coach DM.','50 dagen met Coach DM.','medal',2,50,'visits',false,31,'visits_50'),
('visits_100','Pilier','Pillar','Pijler','100 jours passés avec Coach DM.','100 days with Coach DM.','100 dagen met Coach DM.','crown',3,100,'visits',false,32,'visits_100'),
('visits_365','The 365 Club','The 365 Club','The 365 Club','365 jours passés avec Coach DM.','365 days with Coach DM.','365 dagen met Coach DM.','crown',3,365,'visits',false,33,'visits_365'),
('first_pr','Premier record','First record','Eerste record','Ton premier record personnel.','Your first personal record.','Je eerste persoonlijk record.','trophy',1,1,'prs',false,40,null),
('meals_30','30 repas notés','30 meals logged','30 maaltijden genoteerd','30 repas notés dans Manger.','30 meals logged in Eat.','30 maaltijden genoteerd in Eten.','bowl',1,30,'meals',false,41,null);

create or replace function public.badges_sync() returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare
  u uuid := auth.uid();
  n_ses int; n_pr int; n_meal int; n_vis int; best int := 0; st int := 0; d date; x date; k int := 0;
  newb jsonb := '[]'::jsonb; prog jsonb; r record;
begin
  if u is null then return jsonb_build_object('ok',false); end if;
  d := (now() at time zone 'Europe/Brussels')::date;
  insert into app_visits(user_id,day) values (u,d) on conflict do nothing;
  select count(*) into n_ses from workout_sessions where user_id=u and status='completed';
  select count(*) into n_pr from personal_records where user_id=u;
  select count(*) into n_meal from (select distinct logged_date, meal_type from food_logs where user_id=u) m;
  select count(*) into n_vis from (
    select day from app_visits where user_id=u
    union select (completed_at at time zone 'Europe/Brussels')::date from workout_sessions where user_id=u and completed_at is not null
    union select logged_date from food_logs where user_id=u) v;
  x := case when fn_day_active(u,d) then d else d-1 end;
  while k < 400 and fn_day_active(u,x) loop k := k+1; x := x-1; end loop;
  st := k;
  -- memoire : la meilleure serie de tout l'historique compte aussi (un ancien membre recoit ce qu'il a deja merite)
  select coalesce(max(n),0) into best from (
    select count(*) n from (
      select dd, dd - (row_number() over (order by dd))::int g from (
        select (completed_at at time zone 'Europe/Brussels')::date dd from workout_sessions where user_id=u and completed_at is not null
        union select logged_date from food_logs where user_id=u
        union select (created_at at time zone 'Europe/Brussels')::date from wod_scores where user_id=u
        union select day from rest_days where user_id=u) a) b group by g) c;
  best := greatest(best, st);
  prog := jsonb_build_object('sessions',n_ses,'prs',n_pr,'meals',n_meal,'streak',st,'streak_best',best,'visits',n_vis);
  for r in select code, goal, metric from badge_catalog loop
    if coalesce((prog->>(case when r.metric='streak' then 'streak_best' else r.metric end))::int,0) >= r.goal then
      insert into user_badges(user_id,badge_code,awarded_at) values (u,r.code,now())
      on conflict (user_id,badge_code) do nothing;
      if found then newb := newb || to_jsonb(r.code); end if;
    end if;
  end loop;
  return jsonb_build_object('ok',true,'progress',prog,'new',newb,
    'have',(select coalesce(jsonb_agg(jsonb_build_object('code',badge_code,'at',awarded_at)),'[]'::jsonb) from user_badges where user_id=u));
end $function$;
revoke all on function public.badges_sync() from public, anon;
grant execute on function public.badges_sync() to authenticated;
