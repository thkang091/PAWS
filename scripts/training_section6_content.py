"""Section 6 action captions; times are source seconds, not slowed playback time."""

COURSES = {
    '6-1': ('Drop It on Cue', [['01'], ['02'], ['03'], ['02', '04'], ['04']]),
    '6-2': ('Choose Toys, Not Hands', [['01'], ['02'], ['03'], ['01', '02', '03'], ['01', '03']]),
    '6-3': ('Redirect Destructive Chewing', [['01'], ['02'], ['02', '03'], ['03'], ['01', '02', '03']]),
    '6-4': ('Reduce Demand Barking', [['01'], ['02', '03'], ['03'], ['01', '02', '03'], ['01', '03']]),
    '6-5': ('Manage Alert Barking', [['01'], ['01'], ['02', '03'], ['03'], ['04']]),
}

MISSING = []

CAPTIONS = {
    '6-1': {
        '01': ('Trade and return the toy', [(0, 'Begin with a safe, easy toy.'), (2.4, 'Offer a treat trade without pulling the toy away.'), (4.2, 'Let your dog finish the reward.'), (6.3, 'Offer the toy again.')]),
        '02': ('Cue before the trade', [(0, 'Say “Drop” once before offering the trade.'), (1.8, 'Offer the reward and allow the release.'), (3.5, 'Pause while your dog finishes the reward.'), (5.6, 'Return the toy for another short game.')]),
        '03': ('Trade between two toys', [(0, 'Begin a short game with the first toy.'), (2, 'Pause and cue the release.'), (3.5, 'Make the second toy available after the release.'), (6.8, 'Keep the exchange gentle and brief.'), (9.5, 'Let the next toy reward letting go.')]),
        '04': ('Drop during play', [(0, 'Pause the game and say “Drop” once.'), (1.5, 'Allow the release without taking the toy by force.'), (2.7, 'Offer the toy again.'), (4, 'Resume a short, gentle game.')]),
    },
    '6-2': {
        '01': ('Offer the toy before play', [(0, 'Offer an easy-to-grip toy away from your fingers.'), (2.5, 'Let your dog choose the toy.'), (4.5, 'Begin gentle play with the mouth on the toy.'), (7, 'Keep your hands away from the biting end.')]),
        '02': ('Practise stopping the movement', [(0, 'Practise with gentle, small toy movements.'), (2.8, 'Slow the movement and pause the toy.'), (3.6, 'If teeth touch skin, stop play calmly.')]),
        '03': ('Resume after a calm moment', [(0, 'Wait for a brief calm moment.'), (1.6, 'Offer the toy within easy reach.'), (2.6, 'Resume when your dog takes the toy.')]),
    },
    '6-3': {
        '01': ('Prepare a comfortable chew space', [(0, 'Prepare a familiar space and a suitable chew.'), (2.5, 'Let your dog enter willingly.'), (5.5, 'Offer the chew and stay nearby.'), (9, 'Let your dog settle into the chew activity.'), (12, 'Supervise and keep the setup comfortable.')]),
        '02': ('Redirect to an approved toy', [(0, 'For practice, choose a large, safe neutral item.'), (2.5, 'Keep access to the item managed.'), (5.8, 'Offer an approved toy as the alternative.'), (8.5, 'Let your dog engage with the toy.'), (11, 'Keep the short game gentle.')]),
        '03': ('Keep chewing during mild activity', [(0, 'Begin with your dog settled with the chew.'), (2.2, 'Make one small, calm movement nearby.'), (4.8, 'Allow your dog to continue chewing.'), (7, 'Stay nearby and keep supervising.')]),
    },
    '6-4': {
        '01': ('Reward a quiet pause', [(0, 'Look for a brief quiet moment.'), (1.5, 'Mark the quiet pause.'), (2.8, 'Offer the reward while your dog stays quiet.')]),
        '02': ('Practise pausing the activity', [(0, 'Begin a short, gentle toy activity.'), (2.8, 'Slow and pause the toy movement.'), (3.6, 'Use this calm pause if demand barking starts.')]),
        '03': ('Let quiet lead to play', [(0, 'Wait for a quiet, easy moment.'), (1.6, 'Offer the toy as the alternative.'), (2.6, 'Let gentle play reward the calm choice.')]),
    },
    '6-5': {
        '01': ('Notice, turn back, reward', [(0, 'Let your dog notice the mild cue.'), (1.2, 'Notice attention returning to you.'), (2.3, 'Reward before barking builds.')]),
        '02': ('Practise the resting-space route', [(0, 'Practise the route without a trigger first.'), (2.5, 'Invite your dog onto the familiar mat.'), (4.5, 'Allow a comfortable position.'), (6.5, 'Reward at the resting space.')]),
        '03': ('Move away from a soft cue', [(0, 'Keep the sound brief and gentle.'), (2, 'Invite your dog to turn toward you.'), (3.2, 'Move together toward the resting space.'), (6.3, 'Reward after moving away.')]),
        '04': ('An everyday alert at the resting spot', [(0, 'Notice the everyday sound from the resting spot.'), (2.5, 'Reward attention returning to you.'), (5.5, 'Let your dog remain close and settle.'), (9.5, 'Finish the moment calmly.')]),
    },
}

NOTES = {
    '6-1': 'Cue captions are instructions, not a speech transcript. Toy value is selected by the guardian, not proven by the footage. The Level 4 clips are separate demonstrations; the shared Drop It mechanics do not merge progress with 1-3.',
    '6-2': 'Pause mechanics are shown without a verified teeth-to-skin event. Do not provoke contact. Level 5 reuses an adult-led example for practice with another informed familiar adult; it does not show the same dog switching handlers.',
    '6-3': 'User-approved app-only revision: prepare a safe space, manage access and redirect to an approved toy, then maintain the activity during mild movement. No independent two-object test. The source decoration is a visual reference only; practise with a large safe neutral item. The crate is the original familiar setup, not mandatory equipment. Separate management examples are not one continuous routine.',
    '6-4': 'Quiet food reward, toy stopping and calm play are separate demonstrations. No fabricated barking-to-pause event or continuous reduction-of-food trial is claimed. Level 3 uses the easier alternative without barking.',
    '6-5': 'Level 2 uses the approved easier option of rewarding before barking. Level 3 includes route practice without a trigger followed by a separate cue example. Level 5 reuses the verified everyday neighbor-sound footage from 4-3 with the dog already at a resting spot. Playback remains muted.',
}
