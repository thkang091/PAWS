"""Section 4 footage reviewed against the live Level goals; source-second cues."""

COURSES = {
    '4-1': ('Respond to Your Name', [['C01'], ['C02'], ['C03'], ['C04'], ['C05']]),
    '4-2': ('Notice Visual Triggers Calmly', [['C01'], ['C02'], ['C03'], ['C04', 'C06'], ['C05']]),
    '4-3': ('Recover From Everyday Sounds', [['C01'], ['C02'], ['C03'], ['C04', '08'], ['C06']]),
    '4-4': ('Use Your Resting Space', [['01'], ['02', '03'], ['06', '02'], ['05', '04'], ['07']]),
    '4-5': ('Follow a Daily Routine', [['01'], ['02'], ['01', '04'], ['03'], ['04']]),
}

MISSING = []

CAPTIONS = {
    '4-1': {
        'C01': ('Say the name once and wait', [(0, 'Say your dog’s name once in a calm voice.'), (1.2, 'Reward the turn toward you.'), (3.5, 'Begin another easy repetition.'), (6, 'Wait without repeating the name.'), (10, 'Reward when your dog turns back.')]),
        'C02': ('Respond from a short distance', [(0, 'Begin a few steps apart indoors.'), (3, 'Say the name once and allow time to turn.'), (5.5, 'Let your dog come toward you.'), (7.5, 'Deliver the reward beside you.')]),
        'C03': ('Turn away from mild movement', [(0, 'With a quiet person nearby, say the name once.'), (1.8, 'Notice your dog turning back to you.'), (3, 'Reward the return of attention.')]),
        'C04': ('Respond across an open doorway', [(0, 'Keep each other in view across the doorway.'), (3.8, 'Say the name once and wait for the turn.'), (6.5, 'Let your dog move back toward you.'), (8.5, 'Reward the response.')]),
        'C05': ('Try a quiet outdoor setting', [(0, 'Choose a quiet, secure outdoor space.'), (2.2, 'Say the name once and watch for a turn.'), (3.5, 'Send the reward toward your dog.'), (6.5, 'Let your dog finish the reward and reset.')]),
    },
    '4-2': {
        'C01': ('Look at a still object', [(0, 'Let your dog notice the still object.'), (1.5, 'Reward attention returning to you.'), (4.5, 'Keep the object still for another easy look.'), (6.5, 'Reward beside you again.')]),
        'C02': ('One small object movement', [(0, 'Start at a distance your dog finds comfortable.'), (1.2, 'Move the switched-off object a little, then stop.'), (3.5, 'Reward beside you after the movement.'), (7.5, 'Pause before adding more movement.')]),
        'C03': ('Watch a person from a distance', [(0, 'Let your dog notice the person at a distance.'), (1.2, 'Reward the check-in beside you.'), (4, 'Allow a brief look as the person moves slowly.'), (6.2, 'Reward attention returning to you.'), (9, 'Keep the distance comfortable.')]),
        'C04': ('Notice a distant dog', [(0, 'Keep a generous distance from the other dog.'), (2.5, 'Notice your dog turning toward you.'), (4.2, 'Reward the check-in beside you.'), (7.5, 'Keep the next look brief and easy.')]),
        'C06': ('Move away after a check-in', [(0, 'Separate example: notice the distant trigger.'), (3.5, 'Reward attention returning to you.'), (6.5, 'Turn and move farther away together.'), (10, 'Continue toward the quieter area.')]),
        'C05': ('Use the pattern in the park', [(0, 'Let your dog notice a distant everyday activity.'), (2.2, 'Reward the turn back toward you.'), (6, 'Keep the next look brief.'), (8.5, 'Reward another check-in beside you.')]),
    },
    '4-3': {
        'C01': ('Introduce a soft recorded sound', [(0, 'Use a very quiet wind recording.'), (1.2, 'Offer a reward beside you.'), (4, 'Let your dog notice the sound without moving closer.'), (6.5, 'Reward and keep the practice brief.')]),
        'C02': ('A brief household recording', [(0, 'Play a quiet vacuum recording; leave the vacuum off.'), (2, 'Offer the reward beside you.'), (5.5, 'Stop the sound and pause.')]),
        'C03': ('One quiet doorbell recording', [(0, 'Play one very soft doorbell recording.'), (1.5, 'Let your dog notice it, then turn back.'), (3, 'Reward the return to you.'), (5, 'Pause before another sound.')]),
        'C04': ('A real sound from a distance', [(0, 'Keep your dog at a comfortable resting spot.'), (2, 'Make a brief key sound farther away.'), (4.5, 'Return to your dog.'), (5.8, 'Reward at the resting spot.')]),
        '08': ('Move away together', [(0, 'Separate example: keep a real sound brief and gentle.'), (2, 'Invite your dog to turn toward you.'), (3.2, 'Walk away together toward the resting area.'), (6.3, 'Reward after moving away.')]),
        'C06': ('Recover during an everyday moment', [(0, 'Notice an everyday sound from the resting spot.'), (2.5, 'Reward attention returning to you.'), (5.5, 'Allow your dog to stay close and settle.'), (9.5, 'Keep the moment easy and finish calmly.')]),
    },
    '4-4': {
        '01': ('Choose the resting mat', [(0, 'Invite your dog toward the resting mat.'), (2.5, 'Let all four paws move onto the mat.'), (4.5, 'Allow a comfortable position.'), (6.5, 'Deliver the reward on the mat.')]),
        '02': ('One step away and back', [(0, 'Start beside your dog’s resting spot.'), (1.8, 'Take one small step away.'), (3.5, 'Return and pause briefly.'), (5.5, 'Reward on the mat.')]),
        '03': ('A little more distance', [(0, 'Take a few calm steps away.'), (3, 'Keep the distance easy for your dog.'), (5, 'Return to the resting spot.'), (6.5, 'Reward your dog there.')]),
        '04': ('A short walk nearby', [(0, 'Walk a short route beside the resting space.'), (3, 'Let your dog stay while you move away.'), (6, 'Return calmly.'), (8, 'Reward on the mat.')]),
        '05': ('A small household action', [(0, 'Keep your dog at the familiar resting spot.'), (1.5, 'Move the drawer slowly, then stop.'), (5, 'Return to your dog.'), (7, 'Reward at the resting spot.')]),
        '06': ('Pause, then release', [(0, 'Invite your dog onto the mat with an empty hand.'), (3, 'Pause quietly beside the mat.'), (7, 'Keep the wait brief and comfortable.'), (11.5, 'Release before your dog leaves the mat.')]),
        '07': ('Choose the bed during a routine', [(0, 'Let your dog choose the familiar bed.'), (4, 'Allow time to settle while you stay nearby.'), (9, 'Continue the quiet household activity.'), (14.5, 'Return to reward the choice.'), (18, 'Deliver the reward at the bed.')]),
    },
    '4-5': {
        '01': ('Use one starting place', [(0, 'Invite your dog to the same starting spot.'), (2, 'Reward arrival at the spot.'), (4.5, 'Add a short, comfortable pause.'), (7.5, 'Release before moving away.')]),
        '02': ('Add one starting cue', [(0, 'Give the familiar starting cue once.'), (1.2, 'Let your dog arrive at the spot.'), (3, 'Reward arrival.'), (4.8, 'Release to finish this short repetition.')]),
        '03': ('Change your starting position', [(0, 'Approach the same spot from the other side.'), (1.5, 'Use the same cue and let your dog arrive.'), (3, 'Reward at the usual spot.'), (4.5, 'Release as usual.')]),
        '04': ('Leave for a walk together', [(0, 'Begin at the familiar starting spot.'), (2, 'Pause before opening the door.'), (3.7, 'Open the door while your dog waits.'), (5.8, 'Release, then head outside together.')]),
    },
}

NOTES = {
    '4-1': 'Name-cue captions are instructions, not an audio transcript. Level 4 uses an open doorway with visual contact. Outdoor footage illustrates orientation, not recall or proof of generalization.',
    '4-2': 'Distances depend on the dog. The nearby switched-off vacuum example shows an already comfortable puppy, not a required starting distance. Level 4 combines separate look-and-return and move-away demonstrations.',
    '4-3': 'Same muted 0.6x player as other lessons: sound types come from source records, and captions describe the practice rather than providing sound-exposure audio. Level 4 combines distant keys with a separate turn-and-walk-away example; no measured loudness or universal distance is claimed.',
    '4-4': 'Combined examples are separate demonstrations. Duration is brief and voluntary; the videos do not establish independence across all contexts.',
    '4-5': 'A door-departure routine illustrates the starting-place pattern. The platform is the original setup, not required equipment. Level 3 combines separate repetitions; Level 5 reuses the walk departure example, not evidence of an unrehearsed daily habit.',
}
