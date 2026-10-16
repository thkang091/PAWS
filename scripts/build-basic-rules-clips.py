"""Build Levels 1–5 from acquired footage; no narration or added title cards.

Usage: python scripts/build-basic-rules-clips.py --source PATH [--ffmpeg PATH]
Caption times refer to source seconds. The app applies 0.6x playback separately.
"""
import argparse
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Each source entry: step title, then (source second, action caption) pairs.
CAPTIONS = {
    '1-3': {
        'C01': ('Introduce the cue', [(0, 'Start with an empty mouth and say “Drop”.'), (1.5, 'Scatter a few treats just after the cue.'), (4.8, 'Let your dog finish, then reset.')]),
        'C02': ('Trade and return', [(0, 'Start with an easy, safe toy.'), (2.5, 'Say “Drop”, then offer the treat trade.'), (5.5, 'Pick up the toy while your dog eats.'), (7, 'Return the toy to keep the trade friendly.')]),
        'B02': ('An easier trade example', [(0, 'If release is difficult, make the trade easier.'), (4.5, 'Scatter treats so your dog can let go.'), (8, 'Return the safe toy after the trade.')]),
        'C03': ('Release before reward', [(0, 'Say “Drop” once and give your dog a moment.'), (1.7, 'Mark the release, then bring the reward.'), (3.8, 'Offer the safe item again.')]),
        'C04': ('Practise while standing', [(0, 'Practise the same trade while standing nearby.'), (3.5, 'Reward when your dog lets go.'), (5.5, 'Return the safe item, then step away.')]),
        'B01': ('Drop during play', [(0, 'Begin a gentle game with a safe toy.'), (4.5, 'Pause the game and say “Drop”.'), (6.8, 'Reward the release before restarting play.')]),
    },
    '1-4': {
        'C01': ('Practise going to a spot', [(0, 'Movement example: practise this at your potty area.'), (2, 'Guide your dog to the chosen spot.'), (5, 'Reward arriving calmly; no sit or down needed.')]),
        'C02': ('Repeat and release', [(0, 'Another movement example: guide to the same spot.'), (2.5, 'Reward your dog at the spot.'), (4.8, 'Release and move away calmly.')]),
        'C03': ('Wait briefly at the spot', [(0, 'Movement example: use your potty area, not a bed.'), (3, 'Reward arrival, then allow a short quiet pause.'), (8, 'Release to finish this practice repetition.')]),
        'C10': ('Another arrival example', [(0, 'Another movement example: guide to the chosen spot.'), (3.5, 'Reward arriving at the spot.'), (6.5, 'Repeat calmly without requiring a sit or down.')]),
        'C11': ('Finish the practice', [(0, 'Release example: signal that the repetition is over.'), (2, 'Let your dog move away.')]),
        'C04': ('Go outside together', [(0, 'Open the door calmly and head outside.'), (4.5, 'Walk with your dog to the potty area.')]),
        'C05': ('Reward after finishing', [(0, 'Wait quietly while your dog finishes.'), (2.5, 'Reward promptly after your dog finishes.'), (6, 'Move on calmly together.')]),
        'C06': ('Another potty example', [(0, 'Another dog: wait quietly during the potty break.'), (6, 'Let your dog finish without interruption.'), (9.5, 'Praise and reward after finishing.')]),
        'C07': ('A calm return example', [(0, 'Separate example: finish the outing calmly.'), (5, 'Walk together away from the potty area.'), (12, 'Head back indoors without rushing.')]),
        'C08': ('Start the morning routine', [(0, 'Plan a potty trip soon after waking.'), (5, 'Get ready to take your puppy outside.')]),
        'C09': ('Allow time outside', [(0, 'Give your puppy a quiet chance to explore the grass.'), (3, 'Wait patiently; this clip does not show elimination.')]),
    },
    '1-5': {
        'C01': ('Notice natural calm', [(0, 'Notice your dog resting quietly.'), (2.5, 'Deliver a small reward calmly.')]),
        'C02': ('Another calm example', [(0, 'Another example: notice your dog settling.'), (2, 'Mark and reward calm; lying down is optional.')]),
        'C03': ('Introduce the quiet cue', [(0, 'While your dog is quiet, say your quiet cue once.'), (1, 'Reward calmly to build the association.')]),
        'C04': ('Turn back to you', [(0, 'Say the familiar quiet cue once.'), (1.5, 'Mark the turn toward you and reward.')]),
        'C05': ('Repeat a quiet response', [(0, 'Another repetition: cue once, then wait.'), (2.5, 'Praise and reward attention back to you.')]),
        'C06': ('Move to the resting spot', [(0, 'Guide your dog onto the resting spot.'), (2.5, 'Reward on the spot.'), (4.8, 'Release to finish the short repetition.')]),
        'C07': ('A short calm wait', [(0, 'Another repetition: guide onto the resting spot.'), (2.5, 'Reward calmly in place.'), (5, 'Keep the quiet pause short and easy.')]),
        'C08': ('A release example', [(0, 'Separate example: give the release cue.'), (1.5, 'Let your dog leave the spot.')]),
        'C09': ('Keep a distraction small', [(0, 'Movement example: touch the handle briefly.'), (1.3, 'Reward a calm response; reduce movement if needed.')]),
        'C10': ('Use the cue at home', [(0, 'Say the familiar quiet cue once near the window.'), (3, 'Let your dogs turn away and come toward you.'), (7, 'Praise their attention back to you.')]),
    },
}
COURSES = {
    '1-3': ('drop-it', '', [['C01'], ['C02', 'B02'], ['C03'], ['C04'], ['B01']]),
    '1-4': ('potty-routine', 'v2', [['C01', 'C02'], ['C03', 'C10', 'C11'], ['C04', 'C06', 'C07'], ['C08', 'C09', 'C04', 'C05', 'C07'], ['C08', 'C04', 'C05', 'C07']]),
    '1-5': ('quiet-moments', '', [['C01', 'C02', 'C03', 'C08'], ['C04', 'C05', 'C08'], ['C06', 'C05', 'C07', 'C08'], ['C09', 'C05', 'C07', 'C08'], ['C10', 'C07', 'C08']]),
}

def build(source, ffmpeg):
    lessons = {}
    asset_lines = ['// Generated by scripts/build-basic-rules-clips.py.', 'export const BASIC_RULES_ASSETS: Record<string, Record<number, { source: number; poster: number }>> = {']
    for skill, (slug, subdir, sequences) in COURSES.items():
        folder = source / skill / subdir
        manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8-sig'))
        sources = {a['id']: a for a in manifest['assets']}
        dest = ROOT / 'assets/training' / slug
        dest.mkdir(parents=True, exist_ok=True)
        lessons[skill] = []
        asset_lines.append(f'  "{skill}": {{')
        for level, sequence in enumerate(sequences, 1):
            cmd = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y']
            filters, steps, total_frames = [], [], 0
            for index, source_id in enumerate(sequence):
                asset = sources[source_id]
                frames = round(asset['actual_duration_s'] * 30)
                cmd += ['-i', str(folder / asset['file'])]
                # Some source containers end a frame or two after their video
                # stream. Normalize that tail so all join/caption offsets are exact.
                filters.append(f'[{index}:v]setpts=PTS-STARTPTS,fps=30,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,tpad=stop_mode=clone:stop_duration=1,trim=end_frame={frames},setpts=PTS-STARTPTS[v{index}]')
                title, cues = CAPTIONS[skill][source_id]
                assert all(0 <= at < frames / 30 for at, _ in cues)
                steps.append({'title': title, 'cues': [{'at': round(total_frames / 30 + at, 6), 'text': text} for at, text in cues]})
                total_frames += frames
            filters.append(''.join(f'[v{i}]' for i in range(len(sequence))) + f'concat=n={len(sequence)}:v=1:a=0,fps=30,tpad=stop_mode=clone:stop_duration=0.1,trim=end_frame={total_frames},settb=1/30,setpts=N[out]')
            output = dest / f'level-{level}.mp4'
            subprocess.run(cmd + ['-filter_complex', ';'.join(filters), '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-threads', '2', '-r', '30', '-fps_mode', 'cfr', '-frames:v', str(total_frames), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output)], check=True)
            decoded = subprocess.run([ffmpeg, '-v', 'error', '-i', str(output), '-progress', 'pipe:1', '-f', 'null', '-'], check=True, capture_output=True, text=True)
            decoded_frames = [int(line.split('=')[1]) for line in decoded.stdout.splitlines() if line.startswith('frame=')][-1]
            assert decoded_frames == total_frames, (output, decoded_frames, total_frames)
            poster_time = 6 if skill == '1-4' and level >= 4 else 1
            subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(poster_time), '-i', str(output), '-frames:v', '1', '-q:v', '3', str(dest / f'level-{level}.jpg')], check=True)
            note = 'Separate demonstration examples, not one continuous repetition.'
            if skill == '1-4' and level <= 2:
                note += ' Mat/bed footage illustrates movement only; practise at the potty area. No elimination is shown and no sit/down is required.'
            lessons[skill].append({'id': f'{slug}-l{level}', 'levelNumber': level, 'duration': round(total_frames / 30, 6), 'coverageNote': note, 'steps': steps})
            asset_lines.append(f'    {level}: {{ source: require("../../../../assets/training/{slug}/level-{level}.mp4"), poster: require("../../../../assets/training/{slug}/level-{level}.jpg") }},')
            print(f'{skill} Level {level}: {total_frames / 30:.3f}s ({", ".join(sequence)})', flush=True)
        asset_lines.append('  },')
    asset_lines.append('};')
    generated = ROOT / 'src/features/train/media'
    (generated / 'basicRulesLessons.generated.json').write_text(json.dumps(lessons, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    (generated / 'basicRulesAssets.generated.ts').write_text('\n'.join(asset_lines) + '\n', encoding='utf-8')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--ffmpeg', default=shutil.which('ffmpeg'))
    args = parser.parse_args()
    if not args.ffmpeg:
        parser.error('--ffmpeg is required when ffmpeg is not on PATH')
    build(args.source, args.ffmpeg)
