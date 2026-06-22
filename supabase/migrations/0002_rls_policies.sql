alter table profiles enable row level security;
alter table dogs enable row level security;
alter table dog_goals enable row level security;
alter table dog_existing_skills enable row level security;
alter table dog_target_skills enable row level security;
alter table dog_behavioral_concerns enable row level security;
alter table training_skills enable row level security;
alter table dog_training_progress enable row level security;
alter table training_sessions enable row level security;
alter table quest_templates enable row level security;
alter table daily_quests enable row level security;
alter table quest_completions enable row level security;
alter table wallet_transactions enable row level security;
alter table bond_xp_transactions enable row level security;
alter table dog_status enable row level security;
alter table dog_moments enable row level security;
alter table care_events enable row level security;
alter table subscription_plans enable row level security;
alter table user_plan_selections enable row level security;
alter table game_catalog enable row level security;
alter table game_instances enable row level security;
alter table game_entries enable row level security;
alter table game_results enable row level security;
alter table reward_catalog enable row level security;
alter table reward_redemptions enable row level security;
alter table avatar_catalog enable row level security;
alter table user_avatar_items enable row level security;

create or replace function owns_dog(target_dog_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from dogs where id = target_dog_id and owner_id = auth.uid());
$$;

create policy "profiles own select" on profiles for select using (id = auth.uid());
create policy "profiles own update" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "dogs own all" on dogs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dog goals own all" on dog_goals for all using (owns_dog(dog_id)) with check (owns_dog(dog_id));
create policy "dog existing skills own all" on dog_existing_skills for all using (owns_dog(dog_id)) with check (owns_dog(dog_id));
create policy "dog target skills own all" on dog_target_skills for all using (owns_dog(dog_id)) with check (owns_dog(dog_id));
create policy "dog concerns own all" on dog_behavioral_concerns for all using (owns_dog(dog_id)) with check (owns_dog(dog_id));
create policy "training progress own read" on dog_training_progress for select using (owns_dog(dog_id));
create policy "training sessions own read" on training_sessions for select using (owner_id = auth.uid());
create policy "daily quests own read" on daily_quests for select using (owns_dog(dog_id));
create policy "quest completions own read" on quest_completions for select using (owner_id = auth.uid());
create policy "wallet own read" on wallet_transactions for select using (owner_id = auth.uid());
create policy "xp own read" on bond_xp_transactions for select using (owner_id = auth.uid());
create policy "dog status own read" on dog_status for select using (owns_dog(dog_id));
create policy "dog moments own all" on dog_moments for all using (owner_id = auth.uid()) with check (owner_id = auth.uid() and owns_dog(dog_id));
create policy "care events own all" on care_events for all using (owner_id = auth.uid()) with check (owner_id = auth.uid() and owns_dog(dog_id));
create policy "plan selections own all" on user_plan_selections for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "game entries own read" on game_entries for select using (owner_id = auth.uid());
create policy "game results own read" on game_results for select using (exists(select 1 from game_entries ge where ge.id = game_entry_id and ge.owner_id = auth.uid()));
create policy "reward redemptions own read" on reward_redemptions for select using (owner_id = auth.uid());
create policy "avatar items own all" on user_avatar_items for all using (owner_id = auth.uid()) with check (owner_id = auth.uid() and owns_dog(dog_id));

create policy "training catalog read" on training_skills for select using (is_active = true);
create policy "quest templates read" on quest_templates for select using (is_active = true);
create policy "plans read" on subscription_plans for select using (is_active = true);
create policy "game catalog read" on game_catalog for select using (is_active = true);
create policy "game instances read" on game_instances for select using (is_active = true);
create policy "reward catalog read" on reward_catalog for select using (true);
create policy "avatar catalog read" on avatar_catalog for select using (is_active = true);
