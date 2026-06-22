# PAWS Dog AI

Accuracy-first verification backend for PAWS activity videos and future ranked games.

Primary judging is dog-specific pose estimation, not a general multimodal LLM. LLMs may be added later only for uncertain fallback review, coaching text, or explanation layers.

## Setup

```bash
cd /Users/taehoonkang/Desktop/paws/paws-dog-ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

`requirements.txt` is the lightweight API/runtime install. It intentionally does not install DeepLabCut yet, so the backend can start and expose `/health` while you configure Supabase.

Install the heavier AI dependencies only when you are ready to run pose inference:

```bash
pip install -r requirements-ai.txt
```

Create `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The service-role key belongs only in this backend environment. Never put it in the Expo app.

For a quick local health check, the backend can start without `.env`; analysis persistence to Supabase will be skipped until these values are present.

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

For testing from your iPhone on the same Wi-Fi, bind to all interfaces:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Then open:

```text
http://10.0.0.37:8000/health
```

Then open:

```text
http://127.0.0.1:8000/health
```

## Current Status

The API contract, classifier interfaces, persistence path, and safety boundaries are implemented. DeepLabCut inference and tuned activity classifiers are intentionally TODO until model setup and validation videos are available.

## Sit Verification Status

The `SitClassifier` now contains real deterministic pose-sequence logic for:

- starting stand check
- hip/hindquarter drop
- shoulder-to-hip relationship
- front-paw stability
- stable ending sit duration
- keypoint visibility gates
- low-confidence retry states

It still must not be called production-ready until DeepLabCut output parsing is mapped for the installed package version and labeled validation videos pass with acceptable false-positive/false-negative rates.

## Validation Data

Place videos here:

```text
validation_data/sit/positive
validation_data/sit/negative
validation_data/sit/retry_angle
validation_data/sit/retry_visibility
validation_data/sit/retry_multiple_dogs
validation_data/sit/retry_low_confidence
```

Run:

```bash
python scripts/run_sit_validation.py
```

The script prints totals, false positives, false negatives, retry-state accuracy, average confidence, per-video results, and writes:

```text
validation_data/sit/validation_report.json
```

## Current Limitation

DeepLabCut and PyTorch are optional heavy dependencies. On a Mac, CPU inference may be slow; Apple Silicon MPS support depends on PyTorch and DeepLabCut compatibility. The safest next step for production accuracy is to run this same FastAPI service on a GPU host, keep Supabase service-role keys only on that host, and point `EXPO_PUBLIC_DOG_AI_BASE_URL` at that backend after HTTPS is configured.
