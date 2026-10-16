"""Build Section 6 with the existing training clip export pipeline."""
import argparse
import importlib.util
from pathlib import Path
import training_section6_content as content

spec = importlib.util.spec_from_file_location('clip_builder', Path(__file__).with_name('build-sections23-clips.py'))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--ffmpeg', required=True)
    parser.add_argument('--render-skills', nargs='+')
    args = parser.parse_args()
    builder.build(args.source, args.ffmpeg, args.render_skills, content, 'section6', 'SECTION6_ASSETS')

