do $$
begin
  alter table dog_care_routines drop constraint if exists dog_care_routines_routine_key_check;
  alter table dog_care_routines drop constraint if exists dog_care_routines_silver_reward_check;
end $$;

update dog_care_routines
set silver_reward = least(10, greatest(5, silver_reward))
where silver_reward < 5 or silver_reward > 10;

alter table dog_care_routines
  add constraint dog_care_routines_silver_reward_check check (silver_reward >= 5 and silver_reward <= 10);
