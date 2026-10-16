"""Reviewed action captions and Level coverage; timestamps are source seconds."""

COURSES = {
    '2-1': ('Mark the Right Choice', [['C01'], ['C02'], ['C03'], ['C02', 'C04'], ['C05']]),
    '2-2': ('Pause Access to Rewards', [['C01'], ['C02'], ['C03'], ['C04'], ['C01', 'C04']]),
    '2-3': ('Learn Clear Feedback Words', [['C01'], ['C02'], ['C01', 'C02'], ['C03'], ['C04']]),
    '2-4': ('Build a Reward Pattern', [['C01'], ['C02'], ['C03'], ['C04', 'C05', 'C06'], ['C04', 'C05']]),
    '2-5': ('Practice a Calm Reset', [['C01', 'C02'], ['C03'], ['C03'], ['C04'], ['C05']]),
    '3-1': ('Enjoy Everyday Touch', [['01'], ['02'], ['03'], ['01', '03'], ['04']]),
    '3-2': ('Prepare for Nail Care', [['01'], ['02', '03'], ['04'], ['05'], ['06']]),
    '3-3': ('Prepare for Hygiene Checks', [['01'], ['02'], ['03', '04'], ['05'], ['01', '04']]),
    '3-4': ('Stay Calm for Bath and Towel', [['01', '02'], ['03'], ['04'], ['05'], ['04', '05']]),
    '3-5': ('Comfortable With Another Handler', [['01'], ['01'], ['04'], ['05'], ['01', '02']]),
}

MISSING = []

CAPTIONS = {
    '2-1': {
        'C01': ('Marker, then reward', [(0, 'Say your marker once before offering the treat.'), (2.8, 'Bring the reward to your dog.'), (4.8, 'Let your dog finish, then reset.')]),
        'C02': ('Mark a small glance', [(0, 'Watch for a small glance toward you.'), (1.5, 'Mark the choice once.'), (5.8, 'Deliver the reward after the marker.')]),
        'C03': ('Keep the reward hidden', [(0, 'Keep the food hidden while your dog looks toward you.'), (4, 'Mark the attention before bringing out the food.'), (5.8, 'Take the reward from the pouch and deliver it.')]),
        'C04': ('Another behavior example', [(0, 'Separate example: notice your dog leaving the object.'), (2.5, 'Use the same marker for this clear choice.'), (4.1, 'Follow the marker with a reward.')]),
        'C05': ('Reward within a routine', [(0, 'Reward your dog for staying on the waiting spot.'), (2.5, 'Move toward the handle while your dog stays.'), (5, 'Reward again on the spot.'), (7, 'Release and finish the short routine.')]),
    },
    '2-2': {
        'C01': ('Pause and resume play', [(0, 'Pause the toy movement and wait briefly.'), (2.5, 'Release to make the toy available again.'), (5.5, 'For your practice, keep the toy low and movements small.'), (9, 'Let your dog enjoy the toy.')]),
        'C02': ('Pause a treat offer', [(0, 'Finish the previous reward, then close your hand.'), (1.5, 'Wait briefly without pushing your hand toward your dog.'), (3.5, 'Notice your dog moving away from the closed hand.'), (4.6, 'Open your hand and offer the treat.')]),
        'C03': ('An easy alternative', [(0, 'Pause play and ask for the familiar release.'), (2, 'Ask once for an easy sit.'), (3.5, 'Let the sit make play available again.'), (5, 'Resume; use smaller, lower toy movements at home.')]),
        'C04': ('An indoor boundary example', [(0, 'Separate example: pause the door movement briefly.'), (3, 'Wait for your dog to settle back.'), (5, 'Open the door while your dog waits.'), (8.4, 'Release and let your dog leave.')]),
    },
    '2-3': {
        'C01': ('Yes predicts a reward', [(0, 'Say “Yes” once for the choice you want.'), (0.8, 'Open your hand and deliver the reward.'), (2.5, 'Finish the reward before the next repetition.')]),
        'C02': ('This way guides a turn', [(0, 'Use “This way” with a clear, easy direction.'), (1.5, 'Help the turn with your movement and visible toy.'), (3.5, 'Mark the new choice and reward with the toy.')]),
        'C03': ('Turn away from a distraction', [(0, 'Start far enough from the other dog to stay comfortable.'), (3, 'Use your familiar redirect and turn together.'), (6.5, 'Move away from the distraction.'), (8.5, 'Reward in the new position.')]),
        'C04': ('Use each word for its job', [(0, 'Mark a clear choice beside you.'), (3, 'Reward with a short toy game.'), (8, 'Reset and begin another easy turn.'), (13.5, 'Use “This way” to guide the new direction.'), (16.5, 'Mark the new choice and offer the toy.')]),
    },
    '2-4': {
        'C01': ('Repeat the same reward rule', [(0, 'Watch for attention toward you.'), (2.5, 'Mark and reward that choice.'), (5.5, 'Wait for the same easy behavior again.'), (8.5, 'Keep the rule the same and reward again.')]),
        'C02': ('Reward in place', [(0, 'Bring the reward to the waiting spot.'), (2.5, 'Keep the same position as you move toward the handle.'), (5, 'Give the next reward on the spot.'), (6.8, 'Release before moving away.')]),
        'C03': ('Food follows the behavior', [(0, 'Keep food out of view while you wait for attention.'), (4, 'Mark the choice first.'), (5.8, 'Bring the hidden reward out and deliver it.')]),
        'C04': ('Food reward example', [(0, 'Cue the familiar sit with your hand.'), (1.5, 'Wait for the sit to finish.'), (3.5, 'Reward the sit with food.')]),
        'C05': ('Another reward example', [(0, 'Separate repetition: ask for the same sit.'), (2.5, 'Offer brief petting if your dog enjoys it.'), (4.6, 'Let your dog move away when finished.')]),
        'C06': ('A toy reward example', [(0, 'Another dog: ask for the familiar sit.'), (3.3, 'Let a short toy game reward the sit.'), (7, 'Allow your dog to enjoy the toy and return.')]),
    },
    '2-5': {
        'C01': ('Pause an activity', [(0, 'Pause the moving toy for a brief wait.'), (2.5, 'Release before starting the toy again.'), (5.5, 'Practise with lower, smaller movements than this game.'), (9, 'Keep the play break short.')]),
        'C02': ('A quiet reward example', [(0, 'Separate example: stop the ball and wait for attention.'), (3, 'Reward attention while your dog stays in place.'), (6, 'Keep the next ball movement small.'), (9, 'Pause the ball again and ask for attention.'), (12, 'Reward the easy response.')]),
        'C03': ('Move to an approved activity', [(0, 'Get attention and invite your dog away from the shoes.'), (5, 'Let your dog move with you without pulling.'), (11, 'Put the shoes out of reach.'), (18, 'Offer an approved chew instead.'), (28, 'Let the chew become the calm alternative.')]),
        'C04': ('Make the retry easier', [(0, 'Pause when the movement becomes too difficult.'), (3, 'Reset with an easy, familiar position.'), (7.5, 'Try the movement again more slowly.'), (12, 'Reward the easier response.')]),
        'C05': ('Reset and finish', [(0, 'Pause and guide your dog back to the practice area.'), (5, 'Ask for an easy, familiar position.'), (10, 'Use a shorter wait this time.'), (15, 'Return and reward the easier repetition.'), (22, 'Release, then finish the session.')]),
    },
    '3-1': {
        '01': ('One gentle shoulder touch', [(0, 'Let your dog choose to stay beside you.'), (2, 'Touch the shoulder gently, then withdraw.'), (5, 'Pause before the next touch.'), (8.5, 'Reward and give your dog a break.')]),
        '02': ('Touch, pause, reward', [(0, 'Begin at a body area your dog already finds comfortable.'), (1, 'Touch the upper back briefly, then remove your hand.'), (3.5, 'Reward and pause.'), (5.5, 'Try a short neck-side touch, then reward.')]),
        '03': ('Chest and shoulder examples', [(0, 'Touch the chest lightly and briefly.'), (3, 'Withdraw, reward and pause.'), (8, 'Try one gentle shoulder touch.'), (11, 'Remove your hand and reward again.')]),
        '04': ('A familiar adult offers a brief touch', [(0, 'Let your dog choose to stay near the familiar adult.'), (0.5, 'Offer one brief, gentle back stroke.'), (1.3, 'Take the hand away and pause.')]),
    },
    '3-2': {
        '01': ('Begin with the lower leg', [(0, 'Start with your dog resting comfortably.'), (1, 'Touch lightly along the lower leg, then withdraw.'), (3.5, 'Reward and leave the leg free.')]),
        '02': ('Brief paw-top contact', [(0, 'Approach the top of the paw gently.'), (0.8, 'Touch briefly without gripping the paw.'), (3.6, 'Withdraw and reward.')]),
        '03': ('An offered-paw example', [(0, 'Separate example: let your dog offer the paw.'), (1, 'Support the offered paw lightly on your palm.'), (2.2, 'Release the paw and reward.')]),
        '04': ('One toe at a time', [(0, 'Touch one toe lightly without squeezing.'), (2.2, 'Release and reward.'), (4, 'Another brief toe-and-nail touch.'), (6, 'Withdraw and reward again.')]),
        '05': ('Introduce the tool', [(0, 'Let your dog notice the tool from a comfortable distance.'), (2.5, 'Reward for calmly noticing it.'), (5, 'Keep the tool away from the paw for the sound example.'), (8, 'Reward and pause before doing more.')]),
        '06': ('Touch without cutting', [(0, 'Use the easier option: touch the tool to one nail.'), (1.3, 'Remove the tool without cutting.'), (2.5, 'Reward and stop after this easy contact.')]),
    },
    '3-3': {
        '01': ('Outside of the ear only', [(0, 'Touch the outside of the ear flap briefly.'), (1.3, 'Withdraw your hand and reward.'), (2.4, 'Pause before another touch.')]),
        '02': ('Touch the cheek', [(0, 'Approach from the side of the cheek.'), (1, 'Touch the cheek beside the eye, never the eye itself.'), (2.5, 'Remove your finger and reward.'), (4.5, 'Allow a pause and a choice to move away.')]),
        '03': ('Start beside the muzzle', [(0, 'Offer a gentle hand approach.'), (1.5, 'Touch the outer lip briefly.'), (3.5, 'Withdraw before offering the reward.'), (5, 'Let your dog finish and pause.')]),
        '04': ('A brief lip-lift example', [(0, 'Separate example: approach the side of the muzzle.'), (1.5, 'Lift one lip edge gently; keep the mouth closed.'), (3.2, 'Release the lip and reward.'), (5.5, 'Pause and let your dog choose whether to return.')]),
        '05': ('External rear-side contact', [(0, 'Approach the rear side gently from beside your dog.'), (2, 'Use light external contact only.'), (5.5, 'Withdraw your hand and pause.'), (7.5, 'Reward before considering another touch.')]),
    },
    '3-4': {
        '01': ('Choose the dry mat', [(0, 'Invite your dog onto a dry, non-slip mat.'), (1.7, 'Reward with all four paws on the mat.'), (3.8, 'Release before moving away.')]),
        '02': ('A short mat wait', [(0, 'Another repetition: let your dog wait on the dry mat.'), (3, 'Make a small shift while your dog stays.'), (5.5, 'Return the reward to the mat.')]),
        '03': ('Water at a distance', [(0, 'Keep your dog at a comfortable distance from the water.'), (4, 'Introduce a brief, gentle water cue.'), (10, 'Turn the water off before returning.'), (14, 'Go back to your dog and reward.')]),
        '04': ('Introduce a damp cloth', [(0, 'Let your dog notice the damp cloth.'), (2, 'Use gentle contact on an easy body area.'), (5.5, 'Keep contact light and allow your dog to move away.'), (8.8, 'Lift the cloth away and pause.')]),
        '05': ('Brief towel contact', [(0, 'Offer the towel beside your dog.'), (1, 'Touch the side gently with the towel.'), (2.5, 'Remove it without rubbing.'), (3.7, 'Reward and pause.')]),
    },
    '3-5': {
        '01': ('Approach and receive a reward', [(0, 'Let your dog choose to approach the familiar adult.'), (2, 'Offer the reward low and within easy reach.'), (4.5, 'Pause without reaching to restrain your dog.'), (7.5, 'Let your dog move away freely.')]),
        '02': ('Gentle contact and a free exit', [(0, 'Let your dog choose to come close.'), (1.5, 'Offer gentle strokes along the back.'), (3.7, 'Withdraw your hand.'), (4.5, 'Let your dog walk away freely.')]),
        '04': ('One brief back stroke', [(0, 'Approach gently from beside your dog.'), (0.5, 'Touch the back lightly and briefly.'), (1.3, 'Remove your hand and pause.')]),
        '05': ('Touch the outside of the collar', [(0, 'Let your dog stay comfortably beside you.'), (0.7, 'Touch the outside of the collar without pulling.'), (4.7, 'Take your hand away and pause.')]),
    },
}

NOTES = {
    '2-1': 'Instructional marker captions, not an audio transcript or an exact marker pulse. Hidden-food example starts with a hand already in the pouch.',
    '2-2': 'Active flirt-pole footage demonstrates pause/resume order, not low-arousal play. Separate contexts are independent examples. C05 duplicates C04 and remains checkpoint-only.',
    '2-3': 'Visible toy and body movement assist the redirect. The source distance label is not a universal recommendation. Outdoor footage illustrates application, not proof of an established home routine.',
    '2-4': 'Different reward types are separate demonstrations; no claim of consecutive success or a measured reinforcement schedule.',
    '2-5': 'Play, attention, chew redirection and easier stay practice are distinct reset examples. The chew replaces access to shoes; no food reward is shown in that clip.',
    '3-1': 'Level 5 reuses the familiar-trainer back-stroke example with the user-approved shoulder-or-back wording. Combined examples are separate demonstrations.',
    '3-2': 'Level 5 uses the curriculum-approved easier path: tool contact without cutting. No nail trim is demonstrated. Original recording graphics remain.',
    '3-3': 'External cheek, lip and rear-side contact only. Combined checks are separate demonstrations, not internal ear/eye care.',
    '3-4': 'Dry-mat footage illustrates preparation. Damp cloth and towel are separate examples; Level 5 uses the curriculum-approved cloth/towel alternative, not a full bath.',
    '3-5': 'Level 3 uses the user-approved brief back-stroke alternative. Level 4 demonstrates outside collar contact and withdrawal with one handler, not a handler change or harness fitting. Level 5 combines separate approach/reward and touch/free-exit examples, not one uninterrupted attempt.',
}
