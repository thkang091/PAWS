insert into training_skills(slug, name, category, difficulty, estimated_minutes, description, instructions, silver_reward, bond_xp_reward, focus_delta, discipline_delta, social_delta, energy_delta, intelligence_delta) values
('sit','Sit','basics',1,5,'Teach a reliable sit cue for calm starts.', '["Hold a treat near your dog''s nose.","Lift the treat slowly so their hips lower.","Say sit once as they settle.","Reward immediately and release."]',20,20,2,3,0,0,1),
('stay','Stay','basics',1,6,'Build patience with a short stay.', '["Ask for sit.","Open your palm and say stay.","Pause for one second.","Return and reward before releasing."]',22,22,3,4,0,0,1),
('come','Come','basics',1,6,'Practice cheerful recall in a low-distraction space.', '["Move a few steps away.","Say come in an upbeat voice.","Reward when your dog reaches you.","Repeat from different spots."]',24,24,2,2,2,1,1),
('down','Down','basics',1,5,'Teach a calm down position.', '["Start from sit.","Lower a treat between the paws.","Reward when elbows touch the floor.","Add the verbal cue down."]',20,20,2,3,0,0,1),
('paw-shake','Paw / Shake','basics',1,5,'Introduce a friendly paw target.', '["Offer your hand low.","Mark any paw movement.","Gently capture the paw if comfortable.","Reward and keep it short."]',18,18,1,1,2,0,1),
('wait','Wait','basics',1,5,'Practice impulse control at doors or bowls.', '["Ask your dog to pause.","Say wait before opening access.","Reward stillness.","Release with an okay cue."]',22,22,3,4,0,0,1),
('leave-it','Leave It','obedience',2,8,'Help your dog disengage from tempting items.', '["Place a low-value treat under your hand.","Say leave it once.","Reward looking away with a better treat.","Practice with safe objects only."]',30,30,4,5,0,0,2),
('heel','Heel','obedience',2,10,'Practice walking close with attention.', '["Start with treats at your side.","Reward one step in position.","Add two to three steps.","Keep sessions short and upbeat."]',32,32,3,4,1,2,2),
('reliable-recall','Reliable Recall','obedience',3,12,'Strengthen recall around mild distractions.', '["Use a long line in a safe area.","Call once with a happy tone.","Reward heavily when they arrive.","Increase distance gradually."]',38,40,4,4,3,2,2),
('roll-over','Roll Over','fun_tricks',2,8,'Teach a playful roll-over trick.', '["Start from down.","Lure the nose toward the shoulder.","Reward partial rolls.","Build to a full roll slowly."]',28,28,1,1,2,1,3),
('spin','Spin','fun_tricks',1,5,'Teach a quick spin cue.', '["Lure a small circle with a treat.","Reward after one turn.","Add the spin cue.","Practice both directions."]',20,20,1,1,1,1,2),
('fetch','Fetch','fun_tricks',2,10,'Build toy retrieve foundations.', '["Choose a favorite toy.","Reward interest in the toy.","Toss a short distance.","Trade for a treat when returned."]',30,30,2,2,2,2,2),
('speak','Speak','fun_tricks',2,7,'Capture a bark on cue respectfully.', '["Use a harmless trigger that prompts a bark.","Say speak once.","Reward one bark.","Add quiet practice separately."]',26,26,1,2,2,0,2),
('loose-leash-walking','Loose-Leash Walking','outdoor_skills',2,10,'Reward walking without leash tension.', '["Begin in a quiet area.","Reward when the leash is loose.","Stop when tension appears.","Continue when your dog returns near you."]',34,34,3,4,1,3,2),
('outdoor-recall','Outdoor Recall','outdoor_skills',3,12,'Practice recall outside with safety management.', '["Use a secure long line.","Start with low distractions.","Reward generously on arrival.","End before your dog gets tired."]',40,42,4,4,3,3,2),
('calm-greeting','Calm Greeting','social_skills',2,8,'Build polite greetings around people.', '["Start at a comfortable distance.","Reward four paws on the floor.","Approach only while calm.","Reset if excitement gets too high."]',32,34,3,4,4,0,2),
('focus-around-distractions','Focus Around Distractions','social_skills',3,10,'Practice attention when the world is interesting.', '["Choose a mild distraction.","Say your dog''s name once.","Reward eye contact.","Slowly increase difficulty."]',38,40,5,3,3,1,3)
on conflict (slug) do update set name = excluded.name, description = excluded.description, instructions = excluded.instructions, updated_at = timezone('utc', now());

insert into quest_templates(slug, title, description, quest_type, silver_reward, bond_xp_reward) values
('five-minute-training','Complete one 5-minute training session','Practice any active skill together for a short session.','training',20,20),
('daily-dog-moment','Upload today''s Dog Moment','Save one real photo memory from today.','dog_moment',15,10),
('go-on-a-walk','Go on a walk','Log a care event or complete an outdoor walk together.','care',15,15),
('practice-recall','Practice recall','Spend a few focused minutes on coming when called.','training',20,20),
('review-completed-skill','Review a completed skill','Keep a learned skill fresh with a short review.','training',15,15),
('focused-bonding-time','Spend focused bonding time together','Give your dog a calm, phone-free moment of attention.','bonding',15,20)
on conflict (slug) do update set title = excluded.title, description = excluded.description, updated_at = timezone('utc', now());

insert into subscription_plans(plan_type, name, description, price_display, is_paid, features) values
('free','Free','Start PAWS with the core daily training loop.',null,false,'["Starter training lessons","Daily Dog Moment","Basic streak tracking","Care calendar","Limited game entries"]'),
('monthly','PAWS Plus Monthly','Monthly premium PAWS plan. Billing is not enabled in this MVP.','$9.99/mo placeholder',true,'["Expanded training paths","More game entries","Advanced insights","Premium avatar items"]'),
('yearly','PAWS Plus Yearly','Yearly premium PAWS plan. Billing is not enabled in this MVP.','$79.99/yr placeholder',true,'["Expanded training paths","More game entries","Advanced insights","Premium avatar items"]')
on conflict (plan_type) do update set name = excluded.name, features = excluded.features, updated_at = timezone('utc', now());

insert into game_catalog(slug, name, description, silver_entry_cost) values
('fastest-sit','Fastest Sit','A reviewed challenge for a quick, clean sit cue.',25),
('longest-stay','Longest Stay','A reviewed challenge for a steady stay.',30),
('best-recall','Best Recall','A reviewed recall challenge.',35),
('trick-combo','Trick Combo','A reviewed sequence of favorite tricks.',40)
on conflict (slug) do update set name = excluded.name, description = excluded.description, updated_at = timezone('utc', now());

insert into reward_catalog(name, description, gold_cost, is_active, fulfillment_type) values
('Partner Treat Coupon','A future partner reward. Fulfillment is not active yet.',50,false,'external_coupon'),
('Training Class Discount','A future real-world reward. Fulfillment is not active yet.',120,false,'external_coupon')
on conflict do nothing;

insert into avatar_catalog(slug, name, silver_cost, asset_key) values
('green-bandana','Green Bandana',75,'green-bandana'),
('orange-bandana','Orange Bandana',75,'orange-bandana'),
('star-collar','Star Collar',120,'star-collar'),
('cozy-sweater','Cozy Sweater',160,'cozy-sweater')
on conflict (slug) do update set name = excluded.name, silver_cost = excluded.silver_cost, updated_at = timezone('utc', now());
