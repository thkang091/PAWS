insert into public.shop_items (item_key, name, detail, category, shelf, price_gold, was_price_gold, sort_order) values
('kibble', 'Everyday kibble', '2 kg · chicken', 'food', 'shop', 320, 400, 0),
('ball', 'Bouncy ball', 'Squeaky rubber', 'toys', 'shop', 90, 100, 1),
('bed', 'Cosy pet bed', 'Washable', 'furniture', 'shop', 720, 900, 2),
('bone', 'Plush bone', 'Soft chew', 'toys', 'shop', 140, null, 3),
('bandana', 'PAWS bandana', 'One size', 'clothes', 'shop', 110, 130, 4),
('recovery', 'Recovery drink', 'Off their food', 'food', 'pharmacy', 180, 200, 5),
('flea', 'Flea & tick chews', '3 months', 'food', 'pharmacy', 640, 800, 6),
('spray', 'Wound care spray', 'Antimicrobial', 'food', 'pharmacy', 200, 250, 7);

insert into public.coupons (title, description, gold_coin_cost, redemption_instructions) values
('10% Off Premium Kibble', 'Discount on any bag of premium dry dog food over 5 kg.', 5, 'Show this coupon at checkout, in-store or online.'),
('Free Wet Food Sample Pack', 'Try 4 flavors of grain-free wet food, no purchase required.', 8, 'Show this coupon at checkout, in-store or online.'),
('Buy 2 Get 1 Free on Raw Patties', 'Valid on any frozen raw patty 3-pack from participating stores.', 12, 'Show this coupon at checkout, in-store or online.'),
('20% Off Subscription Box', 'First month discount on any monthly dog food subscription.', 15, 'Show this coupon at checkout, in-store or online.'),
('Free Delivery on a Food Order', 'Free shipping on your next online dog food order, any size.', 6, 'Show this coupon at checkout, in-store or online.'),
('Free Training Treat Bag', 'Complimentary 150 g bag of soft training treats.', 4, 'Show this coupon at checkout, in-store or online.'),
('15% Off Dental Chews', 'Discount on any dental chew pack for dogs over 5 kg.', 6, 'Show this coupon at checkout, in-store or online.'),
('Buy 1 Get 1 on Freeze-Dried Treats', 'BOGO deal on all freeze-dried meat treat varieties.', 10, 'Show this coupon at checkout, in-store or online.'),
('Puppy Starter Treat Bundle', 'Curated bundle of 3 beginner-friendly treat bags.', 14, 'Show this coupon at checkout, in-store or online.'),
('25% Off Jerky Strips', 'Single-ingredient chicken or beef jerky, no fillers.', 7, 'Show this coupon at checkout, in-store or online.'),
('Free Rope Tug Toy', 'Heavy-duty braided rope toy suitable for medium and large dogs.', 5, 'Show this coupon at checkout, in-store or online.'),
('10% Off Puzzle Feeder', 'Level 2 snuffle mat or slow-feeder bowl, your choice.', 9, 'Show this coupon at checkout, in-store or online.'),
('Interactive Ball Launcher', 'Automatic fetch launcher, 3 size settings, 1 free ball included.', 20, 'Show this coupon at checkout, in-store or online.'),
('Squeaky Plush 3-Pack', 'Set of 3 soft squeaky toys in assorted animal shapes.', 8, 'Show this coupon at checkout, in-store or online.'),
('Chew-Resistant Tug Ring', 'Durable rubber tug ring rated for aggressive chewers.', 11, 'Show this coupon at checkout, in-store or online.'),
('Free Bath & Blowout Session', 'One complimentary bath and blowout at participating salons.', 15, 'Present this coupon to staff at a participating grooming salon.'),
('20% Off Full Groom', 'Discount on bath, haircut, nail trim, and ear clean.', 18, 'Present this coupon to staff at a participating grooming salon.'),
('Nail Trim on the House', 'Free nail trim on your next grooming visit, no minimum spend.', 6, 'Present this coupon to staff at a participating grooming salon.'),
('Deshedding Treatment Discount', '30% off de-shedding treatment for medium or large breeds.', 12, 'Present this coupon to staff at a participating grooming salon.'),
('Spa Add-On Pack', 'Teeth brushing, blueberry facial, and paw balm massage.', 10, 'Present this coupon to staff at a participating grooming salon.');

insert into public.avatar_catalog (slug, name, silver_cost, asset_key, slot_type) values
('classic_bandana', 'Classic Bandana', 60, 'bandana_classic', 'neck'),
('bow_tie', 'Bow Tie', 80, 'bowtie_navy', 'neck'),
('rain_jacket', 'Rain Jacket', 150, 'outfit_rainjacket', 'outfit'),
('winter_sweater', 'Winter Sweater', 150, 'outfit_sweater', 'outfit'),
('meadow_backdrop', 'Meadow Backdrop', 100, 'bg_meadow', 'background'),
('sunset_backdrop', 'Sunset Backdrop', 120, 'bg_sunset', 'background'),
('gold_tag_frame', 'Gold Tag Frame', 200, 'frame_gold', 'dog_tag_frame'),
('silver_tag_frame', 'Silver Tag Frame', 100, 'frame_silver', 'dog_tag_frame');

insert into public.game_catalog (slug, name, description, silver_entry_cost, difficulty, gold_coin_pass_reward, bonus_xp) values
('fastest_sit', 'Fastest Sit', 'Time how quickly your dog sits on cue.', 10, 'easy', 2, 10),
('longest_stay', 'Longest Stay', 'Hold a stay for as long as your dog can manage.', 10, 'medium', 5, 15),
('recall_race', 'Recall Race', 'Time a recall from across the room.', 10, 'medium', 5, 15),
('trick_combo', 'Trick Combo', 'Chain tricks together for bonus rewards.', 20, 'hard', 10, 25);
