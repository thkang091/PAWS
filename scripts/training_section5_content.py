"""Section 5 action captions, timed in source seconds before 0.6x playback.

These are practice instructions, not transcripts or proof of every criterion.
The supplied closest-example clips support the existing curriculum and easier
paths; its goals and progress remain unchanged.
"""

COURSES = {
    '5-1': ('Use an Indoor Potty Area', [['02'], ['05'], ['02'], ['03'], ['02']]),
    '5-2': ('Recover Calmly After Accidents', [['07'], ['03'], ['04'], ['06'], ['08', '09', '10']]),
    '5-3': ('Use an Outdoor Potty Area', [['01'], ['02'], ['03'], ['04'], ['01']]),
}

MISSING = []

CAPTIONS = {
    '5-1': {
        '05': ('Wait, then reward', [
            (0, 'Wait quietly while your dog uses the pad.'),
            (4.7, 'Let your dog finish before responding.'),
            (6.5, 'Praise and reward after completion.'),
        ]),
        '01': ('Explore the potty area', [
            (0, 'Let your dog explore the indoor potty area.'),
            (2.5, 'Allow your dog to step away freely.'),
            (6, 'Let your dog return without being placed on the pad.'),
            (9, 'Reward the brief pause in the area.'),
        ]),
        '02': ('Follow the familiar route', [
            (0, 'Use one short potty cue before the familiar route.'),
            (1.8, 'Walk calmly toward the same potty area.'),
            (3.5, 'Let your dog enter and pause.'),
            (5.4, 'Reward arrival when practising the route only.'),
        ]),
        '03': ('Change the starting point', [
            (0, 'Begin from another familiar starting point.'),
            (1.6, 'Follow the route to the same potty area.'),
            (3.6, 'Reward the calm arrival in the area.'),
        ]),
        '04': ('Reward timing example', [
            (0, 'Offer the potty area when your dog is likely to need it.'),
            (4, 'Wait quietly for natural elimination.'),
            (8, 'Let your dog finish before praising or rewarding.'),
            (12, 'This example shows where to deliver the reward.'),
            (17, 'Reward promptly in the potty area after completion.'),
            (21, 'If nothing happens, finish calmly and try later.'),
        ]),
    },
    '5-2': {
        '07': ('Notice the accident', [
            (0, 'Notice the accident. Stay calm; avoid scolding.'),
        ]),
        '08': ('Clean the spot', [
            (0, 'Clean the spot with your dog safely away.'),
        ]),
        '09': ('Record what happened', [
            (0, 'Another example: note the time and what happened.'),
        ]),
        '10': ('Prepare the next opportunity', [
            (0, 'Another example: guide your dog to the potty area.'),
            (3.5, 'Give your dog a calm chance to use the area.'),
            (5.4, 'During route practice, reward arrival.'),
        ]),
        '01': ('Practise a calm response', [
            (0, 'If an accident happens, pause and take a breath.'),
            (2.8, 'Keep your voice and movements calm.'),
            (5.7, 'Avoid scolding, chasing or startling your dog.'),
        ]),
        '02': ('Move to a neutral spot', [
            (0, 'Practise moving to a familiar resting spot.'),
            (2.3, 'Invite your dog over without pulling.'),
            (4.7, 'Allow your dog to settle comfortably.'),
            (7, 'Reward the calm arrival away from the cleanup area.'),
        ]),
        '03': ('Clean with your dog safely away', [
            (0, 'Keep your dog away from the cleanup area.'),
            (2, 'Wipe the spot calmly and thoroughly.'),
            (5.5, 'Use a pet-safe cleaner as directed on its label.'),
            (9, 'After cleaning, put the cloth and supplies out of reach.'),
        ]),
        '04': ('Keep a simple potty log', [
            (0, 'Write a brief, factual note about the accident.'),
            (2.4, 'Record the time and location.'),
            (4.8, 'Add the recent routine and any signs you noticed.'),
            (7.3, 'Use the note to plan the next potty opportunity.'),
        ]),
        '05': ('Plan the next opportunity', [
            (0, 'Choose one practical change for next time.'),
            (3.3, 'Try closer supervision or an earlier potty opportunity.'),
            (7.4, 'Give your dog another calm chance to use the area.'),
        ]),
        '06': ('Practise the next indoor route', [
            (0, 'Use the familiar route for the next opportunity.'),
            (1.8, 'Walk calmly toward the indoor potty area.'),
            (3.5, 'Let your dog enter without being placed there.'),
            (5.4, 'For route practice, reward the calm arrival.'),
        ]),
    },
    '5-3': {
        '01': ('Visit the outdoor potty area', [
            (0, 'Take the leash and follow the familiar outdoor route.'),
            (4, 'Walk to a suitable nearby potty area.'),
            (6.5, 'Use one potty cue on arrival, then wait quietly.'),
            (9, 'Reward after your dog has finished.'),
            (12, 'Clean up any waste before continuing the walk.'),
            (14, 'Leave the area calmly together.'),
        ]),
        '02': ('Wait, then reward', [
            (0, 'Stay nearby and wait quietly.'),
            (2.5, 'Let your dog finish without interruption.'),
            (4.5, 'Praise and reward after completion.'),
            (7.5, 'Clean up any waste before leaving the area.'),
        ]),
        '03': ('Allow quiet sniffing', [
            (0, 'Use your potty cue once on arrival.'),
            (3.5, 'Give your dog time to sniff without repeating the cue.'),
            (7.5, 'Keep the leash comfortable and avoid pulling.'),
            (12, 'If no elimination happens, finish calmly and try later.'),
        ]),
        '04': ('Practise moving away from distractions', [
            (0, 'Practise at a comfortable distance from distractions.'),
            (4, 'Invite your dog to turn back toward you.'),
            (7, 'Move together toward a quieter space.'),
            (10.5, 'Reward attention returning to you.'),
            (13.2, 'Use a quieter potty spot if the distraction is too much.'),
        ]),
    },
}

NOTES = {
    '5-1': 'L2 shows indoor pad use followed by a reward after the puppy steps onto adjacent bedding; it demonstrates completion-before-reward, not reward placement on the pad. L1 is arrival practice; L3 adds a cue instruction to the same route. L4 shows another starting point, not a verified room change. L5 reuses the route as an easier reference; reduced guidance is a practice condition, not proven footage. Never label arrival rewards as post-elimination rewards.',
    '5-2': 'L1 shows an accident on the carpet; staying calm is the practice instruction, not a filmed guardian response. L2 uses the cleanup-only easier path. L3 shows logging; L4 shows the next familiar route. L5 is three short separate examples: wipe, record, prepare the next route. They are not one dog or one continuous event. Record fields, safe cleaner use and supply storage remain practice instructions, not all visible actions.',
    '5-3': 'One short action clip per Level. Cue and waste cleanup are practice instructions, not confirmed recorded actions. Sniffing is not elimination. L4 uses general distance-from-distractions practice as the existing easier path, without appending another demonstration. L5 reuses the short potty trip example, not an entire ordinary walk.',
}
