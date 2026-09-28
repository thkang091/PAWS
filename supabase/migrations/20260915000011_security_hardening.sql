alter function set_updated_at() set search_path = public;
alter function generate_dog_tag() set search_path = public;

revoke execute on function create_dog_profile(text, dog_gender, date, numeric, text, date, date, obedience_level, energy_level, text[], uuid[], uuid[], text[], text) from anon;
revoke execute on function start_training_session(uuid, uuid, date, text) from anon;
revoke execute on function report_training_result(uuid, text, uuid) from anon;
revoke execute on function end_training_session(uuid, text) from anon;
revoke execute on function resolve_skill_session(uuid, uuid) from anon;
revoke execute on function get_training_energy(uuid, date) from anon;
revoke execute on function set_session_card_position(uuid, text) from anon;
