# Game UI alignment with Train — 2026-10-28

## Visual source of truth

The current Train components and `src/constants/design.ts` are the visual source of truth. Original Game main supplies the illustration language. External references inform the review principles, not the screen appearance: NN/g's [consistency and standards](https://www.nngroup.com/articles/consistency-and-standards/) supports reusing established product patterns; [aesthetic and minimalist design](https://www.nngroup.com/articles/aesthetic-minimalist-design/) supports keeping useful content and removing decoration that competes with the task.

Read these implementation references before designing another Game screen:

- `src/constants/design.ts`: current colors, typography, spacing, radii and control sizes.
- `src/features/train/components/TopicHeader.tsx`: compact pastel feature card, text left, contextual illustration right.
- `src/features/train/components/flow/TrainingFlowScreen.tsx`: flow header, progress, content spacing and footer buttons.
- `src/features/train/components/flow/TrainingReviewQuiz.tsx`: rounded options and explicit selected states.
- `src/features/train/components/TrainingClipScreen.tsx`: dark media region inside a white application surface.
- `src/features/train/components/flow/TrainingRoundComplete.tsx`: restrained completion hierarchy.
- `app/(tabs)/game.tsx`: original Game mode illustrations and entry-card character.

## Why the previous pass felt too clinical

The previous Game pass reduced repeated artwork and marketing copy, but relied heavily on white panels, divider lines and small 14px text. Its outlined circular header controls, 54px buttons, mixed panel radii and dark green full-screen session shell differed from Train. Matching the dog drawings alone did not resolve those structural differences.

The current pass restores pastel feature cards and compact contextual art, plain balanced header controls, 16px main body text, 56px yellow pill buttons, rounded selection surfaces and white session chrome. Color groups related content and communicates state. Setup, recording, review and results retain distinct purposes without repeating a decorative mascot on each screen.

## Agreed tokens and patterns

| Element | Existing application reference | Game application |
| --- | --- | --- |
| Font family | System font; `fonts.display` and `fonts.text` are undefined by platform | Keep the system font; do not introduce a new display font |
| Main text | Page title 28/31, weight 600; section 20/24, weight 600; body 16/23, weight 400 | Use for page purpose, sections and primary explanation |
| Supporting text | Supporting 14/20; caption 12/16 | Use for secondary instructions, status and metadata; compact cards may use TopicHeader's 13/18 description |
| Foreground | Primary `#1C1B1A`, secondary `#686762` | Preserve readable hierarchy across pastel surfaces |
| Surfaces | White canvas; subtle `#F4F4F2`; butter `#FCF8E0`, sky `#E7F1FB`, mint `#E6F3EA`, peach `#FDEFE3` | Pastel feature cards and meaningful groups; white remains the page surface |
| Geometry | Gutter 24; common gaps 8/12/16/20; card radius 18; sheet radius 32 | Use the shared spacing scale; TopicHeader-style feature cards use radius 26 |
| Header | Bare 44×44 control, centered supporting label, balanced sides | Back/close and preview-information controls share the hit area |
| Primary action | Minimum height 56; pill radius; `#FCD46F`; 16/20 label, weight 700 | One clear primary task action; icons only when useful, no automatic arrow on every button |
| Choice | Rounded option surface; checked/selected state; soft yellow emphasis | Use semantic checkbox/radio controls and visible selection; preserve group labels |
| Progress | Five-pixel segments, eight-pixel gaps, gold fill | Show the four actual stages: setup, round, review, result; distinguish stage progress from elapsed time |
| Media | Train keeps video dark and surrounding sheet/footer white | Light setup/review placeholders; dark stage for the active round; white surrounding chrome |
| Illustration | TopicHeader places a small illustration beside useful text | Selection cards use compact art; rules may use one contextual pastel illustration stage; later flow pages use content and state |

Game continues to use the existing Higgsfield-generated images in `assets/images/game/`. Generation provenance remains in `assets/images/game/provenance.json`. The current alignment pass does not imply new asset generation.

## Reusable agent design prompt

> Design or update the requested PAWS Game page using the current Train implementation as the visual source of truth. First read `src/constants/design.ts`, `TopicHeader.tsx`, `TrainingFlowScreen.tsx`, `TrainingReviewQuiz.tsx` and `TrainingClipScreen.tsx`; compare the original Game main. Reuse their system typography, white canvas, pastel surfaces, 24px gutters, 8/12/16/20px spacing, rounded cards and 56px yellow pill CTA. Use a balanced header with 44px bare icon hit areas. Main instructions use body16/23; reserve14/20 and12/16 for supporting information. Give the page one clear purpose and primary action. Keep copy practical and short. Use illustrations only where they help choose or understand a game; reuse the existing Higgsfield art and provenance. If additional illustration is required, use Higgsfield and match the original Game main. Do not add a repeated hero, motivational slogan, large dog illustration or decorative icon to every page. Group related information with a restrained pastel surface; avoid turning every paragraph into a card. Use rounded, clearly selected checkbox/radio options and expose their state to assistive technology. Stage progress must describe actual flow stages, and review statuses need explicit accessible text. Keep only the media region dark during a session. Preserve the Solo, Duel and Tournament navigation, readiness gates, retry behavior and target selection. Camera, QR, networking and AI are UI previews: retain clear sample labels and do not imply a real upload, connection, score or saved reward. Review narrow layouts, longer text, font scaling, keyboard access and native screen-reader semantics. Report checks actually performed and any untested environments.

## Validation and preview

- Reviewed all five flow components; applied the accessibility review findings: the stage progress exposes an accessible stage description, and review rows announce completed/current/pending sample states.
- `npm run typecheck` and `git diff --check` passed after the final changes.
- Checked the Solo setup/countdown/round/review/result/retry flow at 390px. Combo commands advance to the final cue; the leave confirmation returns to Solo.
- Checked invalid and valid demo room codes, readiness gates, Duel game selection, and the four-player Tournament room.
- Checked target selection and Tournament results at 360px. Retry preserves the platform target and resets the three preparation checks.
- Captured all 26 screens/states and matched them to the preceding design. Gallery zoom and category filters were exercised.
- Native iOS/Android devices, large system font settings, real camera/QR/networking/AI integration remain untested. These are still UI previews; no real scores or rewards are saved.

Gallery: `http://127.0.0.1:8091/` while the local server runs. The persistent artifact directory is `C:/Users/Minjae/.codex/visualizations/2026/10/20/01a15a4b-d233-75d1-9798-e9b202dc000b/game-train-alignment/`; it includes the HTML gallery, all before/after captures, three comparison boards and a local `server.mjs`.
