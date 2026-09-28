update training_skill_relationships
set to_skill_id = (select id from training_skills where skill_code = '6-3')
where id = 'e3415d12-407e-40b3-982e-efeba5f8fd43';
