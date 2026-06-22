alter table training_sessions
  add column if not exists started_at timestamptz,
  add column if not exists duration_seconds integer,
  add column if not exists difficulty_feedback text check (difficulty_feedback is null or difficulty_feedback in ('very_easy', 'easy', 'appropriate', 'hard', 'very_hard')),
  add column if not exists owner_note text,
  add column if not exists dog_struggled boolean not null default false,
  add column if not exists too_easy boolean not null default false;

create or replace function update_training_session_feedback(
  target_session_id uuid,
  duration_seconds_value integer,
  difficulty_feedback_value text,
  owner_note_value text,
  dog_struggled_value boolean,
  too_easy_value boolean
)
returns training_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row training_sessions;
begin
  select * into session_row from training_sessions where id = target_session_id and owner_id = auth.uid();
  if session_row.id is null then raise exception 'Training session not found'; end if;
  update training_sessions
  set duration_seconds = duration_seconds_value,
      difficulty_feedback = difficulty_feedback_value,
      owner_note = owner_note_value,
      dog_struggled = dog_struggled_value,
      too_easy = too_easy_value
  where id = target_session_id
  returning * into session_row;
  return session_row;
end;
$$;
