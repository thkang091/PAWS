"""Reproduce the reviewed short Section 5 source excerpts without changing originals."""
import argparse
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--research-root', type=Path, required=True)
    parser.add_argument('--source', type=Path, required=True, help='PAWS_vid/Actual')
    parser.add_argument('--ffmpeg', required=True)
    args = parser.parse_args()
    excerpts = [
        ('indoor-potty-and-reward', args.research_root/'AVCV8k3xvGY/AVCV8k3xvGY.mp4', 281, 290.5),
        ('notice-an-accident', args.research_root/'t68E7g4D4dU/t68E7g4D4dU.mp4', 115.05, 117.3),
        ('recovery-clean', args.source/'5-2/PAWS_5-2_03_Wipe_the_Floor_and_Lift_the_Cloth.mp4', 7.2, 11.2),
        ('recovery-record', args.source/'5-2/PAWS_5-2_04_Write_a_Potty_Log.mp4', 2, 6),
    ]
    dest = ROOT/'assets/training/sources/section5'
    dest.mkdir(parents=True, exist_ok=True)
    for name, source, start, end in excerpts:
        subprocess.run([args.ffmpeg, '-v', 'error', '-y', '-ss', str(start), '-i', str(source),
                        '-t', str(end-start), '-an', '-vf', 'setpts=PTS-STARTPTS,fps=30',
                        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-threads', '2',
                        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(dest/f'{name}.mp4')], check=True)
        print(name, flush=True)
